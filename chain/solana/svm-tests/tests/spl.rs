// SPL-token behavioral tests for aid_escrow via litesvm: register a mint, fund a
// donor, donate_token, record a token proof, release up to the approved amount,
// and refund. Mirrors the EVM proof-bound model.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use std::str::FromStr;

const PROGRAM_ID: &str = "AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT";
const SO_PATH: &str = "../target/deploy/aid_escrow.so";
const FUNDED: u64 = 1_000_000;
const PH: [u8; 32] = [7u8; 32];

fn disc(name: &str) -> Vec<u8> {
    Sha256::digest(format!("global:{name}").as_bytes())[..8].to_vec()
}

fn pid() -> Pubkey {
    Pubkey::from_str(PROGRAM_ID).unwrap()
}

fn send(svm: &mut LiteSVM, signers: &[&Keypair], payer: &Pubkey, ixs: &[Instruction]) {
    svm.expire_blockhash();
    let tx = Transaction::new_signed_with_payer(ixs, Some(payer), signers, svm.latest_blockhash());
    svm.send_transaction(tx).expect("tx failed");
}

fn try_send(svm: &mut LiteSVM, signer: &Keypair, ix: Instruction) -> bool {
    svm.expire_blockhash();
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&signer.pubkey()), &[signer], svm.latest_blockhash());
    svm.send_transaction(tx).is_ok()
}

fn token_amount(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    let a = svm.get_account(ata).expect("ata missing");
    u64::from_le_bytes(a.data[64..72].try_into().unwrap())
}

/// svm with a registered mint, a campaign, and FUNDED tokens donated by `payer`.
fn funded_fixture() -> (LiteSVM, Pubkey, Keypair, Pubkey, Pubkey) {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();

    // mint
    let mint = Keypair::new();
    let create_mint = system_instruction::create_account(
        &payer.pubkey(),
        &mint.pubkey(),
        10_000_000,
        spl_token::state::Mint::LEN as u64,
        &spl_token::id(),
    );
    let init_mint =
        spl_token::instruction::initialize_mint2(&spl_token::id(), &mint.pubkey(), &payer.pubkey(), None, 6).unwrap();
    send(&mut svm, &[&payer, &mint], &payer.pubkey(), &[create_mint, init_mint]);

    // donor ATA + mint tokens
    let donor_ata = get_associated_token_address(&payer.pubkey(), &mint.pubkey());
    let create_ata = spl_associated_token_account::instruction::create_associated_token_account(
        &payer.pubkey(),
        &payer.pubkey(),
        &mint.pubkey(),
        &spl_token::id(),
    );
    let mint_to =
        spl_token::instruction::mint_to(&spl_token::id(), &mint.pubkey(), &donor_ata, &payer.pubkey(), &[], FUNDED)
            .unwrap();
    send(&mut svm, &[&payer], &payer.pubkey(), &[create_ata, mint_to]);

    // register_token
    let (allowed_mint, _) = Pubkey::find_program_address(&[b"mint", mint.pubkey().as_ref()], &program_id);
    let mut rdata = disc("register_token");
    rdata.push(1u8);
    send(
        &mut svm,
        &[&payer],
        &payer.pubkey(),
        &[Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(allowed_mint, false),
                AccountMeta::new_readonly(mint.pubkey(), false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data: rdata,
        }],
    );

    // initialize_campaign (no bps)
    let id: u64 = 1;
    let (campaign, _) = Pubkey::find_program_address(&[b"campaign", &id.to_le_bytes()], &program_id);
    let mut idata = disc("initialize_campaign");
    idata.extend_from_slice(&id.to_le_bytes());
    idata.push(2u8);
    send(
        &mut svm,
        &[&payer],
        &payer.pubkey(),
        &[Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(campaign, false),
                AccountMeta::new_readonly(payer.pubkey(), false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data: idata,
        }],
    );

    // donate_token FUNDED
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.pubkey().as_ref()], &program_id);
    let (donor_token_stat, _) =
        Pubkey::find_program_address(&[b"donor_token", payer.pubkey().as_ref(), mint.pubkey().as_ref()], &program_id);
    let (contrib_tok, _) = Pubkey::find_program_address(
        &[b"ctok", campaign.as_ref(), payer.pubkey().as_ref(), mint.pubkey().as_ref()],
        &program_id,
    );
    let escrow_ata = get_associated_token_address(&campaign, &mint.pubkey());
    let mut ddata = disc("donate_token");
    ddata.extend_from_slice(&FUNDED.to_le_bytes());
    ddata.push(0u8);
    send(
        &mut svm,
        &[&payer],
        &payer.pubkey(),
        &[Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(campaign, false),
                AccountMeta::new_readonly(allowed_mint, false),
                AccountMeta::new(campaign_asset, false),
                AccountMeta::new_readonly(mint.pubkey(), false),
                AccountMeta::new(donor_ata, false),
                AccountMeta::new(escrow_ata, false),
                AccountMeta::new(donor_token_stat, false),
                AccountMeta::new(contrib_tok, false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(spl_token::id(), false),
                AccountMeta::new_readonly(spl_associated_token_account::id(), false),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data: ddata,
        }],
    );

    (svm, program_id, payer, mint.pubkey(), campaign)
}

fn approval_token(program_id: &Pubkey, campaign: &Pubkey, tranche: u64, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"appr", campaign.as_ref(), &tranche.to_le_bytes(), mint.as_ref()],
        program_id,
    )
    .0
}

#[test]
fn donate_token_tracks_per_asset() {
    let (svm, program_id, _payer, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let raised = u64::from_le_bytes(svm.get_account(&campaign_asset).unwrap().data[72..80].try_into().unwrap());
    assert_eq!(raised, FUNDED);
}

#[test]
fn release_token_bounded_by_approved() {
    let (mut svm, program_id, payer, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let approval = approval_token(&program_id, &campaign, 0, &mint);
    let escrow_ata = get_associated_token_address(&campaign, &mint);

    // recipient + ATA
    let recipient = Keypair::new();
    let recipient_ata = get_associated_token_address(&recipient.pubkey(), &mint);
    let create_recipient_ata = spl_associated_token_account::instruction::create_associated_token_account(
        &payer.pubkey(),
        &recipient.pubkey(),
        &mint,
        &spl_token::id(),
    );
    send(&mut svm, &[&payer], &payer.pubkey(), &[create_recipient_ata]);

    // approver records a token proof approving 400_000
    let mut pdata = disc("record_proof_token");
    pdata.extend_from_slice(&0u64.to_le_bytes());
    pdata.extend_from_slice(&PH);
    pdata.extend_from_slice(&400_000u64.to_le_bytes());
    send(
        &mut svm,
        &[&payer],
        &payer.pubkey(),
        &[Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new_readonly(campaign, false),
                AccountMeta::new(approval, false),
                AccountMeta::new_readonly(mint, false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data: pdata,
        }],
    );

    let release_ix = |amount: u64| Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new(campaign_asset, false),
            AccountMeta::new(approval, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(escrow_ata, false),
            AccountMeta::new(recipient_ata, false),
            AccountMeta::new_readonly(recipient.pubkey(), false),
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: {
            let mut d = disc("release_token");
            d.extend_from_slice(&0u64.to_le_bytes());
            d.extend_from_slice(&amount.to_le_bytes());
            d
        },
    };

    // over approved fails, within approved succeeds
    assert!(!try_send(&mut svm, &payer, release_ix(500_000)));
    assert!(try_send(&mut svm, &payer, release_ix(400_000)));
    assert_eq!(token_amount(&svm, &recipient_ata), 400_000);
    assert_eq!(token_amount(&svm, &escrow_ata), FUNDED - 400_000);
}

#[test]
fn release_token_needs_proof() {
    let (mut svm, program_id, payer, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let approval = approval_token(&program_id, &campaign, 0, &mint);
    let escrow_ata = get_associated_token_address(&campaign, &mint);
    let recipient = Keypair::new();
    let recipient_ata = get_associated_token_address(&recipient.pubkey(), &mint);
    send(
        &mut svm,
        &[&payer],
        &payer.pubkey(),
        &[spl_associated_token_account::instruction::create_associated_token_account(
            &payer.pubkey(),
            &recipient.pubkey(),
            &mint,
            &spl_token::id(),
        )],
    );
    // release with no recorded proof -> the approval PDA does not exist -> fails
    let mut d = disc("release_token");
    d.extend_from_slice(&0u64.to_le_bytes());
    d.extend_from_slice(&100_000u64.to_le_bytes());
    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new(campaign_asset, false),
            AccountMeta::new(approval, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(escrow_ata, false),
            AccountMeta::new(recipient_ata, false),
            AccountMeta::new_readonly(recipient.pubkey(), false),
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: d,
    };
    assert!(!try_send(&mut svm, &payer, ix));
}

#[test]
fn refund_token_returns_undisbursed() {
    let (mut svm, program_id, payer, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let (contrib_tok, _) = Pubkey::find_program_address(
        &[b"ctok", campaign.as_ref(), payer.pubkey().as_ref(), mint.as_ref()],
        &program_id,
    );
    let escrow_ata = get_associated_token_address(&campaign, &mint);
    let donor_ata = get_associated_token_address(&payer.pubkey(), &mint);

    let refund_ix = || Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(campaign, false),
            AccountMeta::new_readonly(campaign_asset, false),
            AccountMeta::new(contrib_tok, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(escrow_ata, false),
            AccountMeta::new(donor_ata, false),
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: disc("refund_token"),
    };

    assert!(!try_send(&mut svm, &payer, refund_ix())); // before enable
    let enable = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data: disc("enable_refunds"),
    };
    assert!(try_send(&mut svm, &payer, enable));
    assert!(try_send(&mut svm, &payer, refund_ix()));
    assert_eq!(token_amount(&svm, &donor_ata), FUNDED);
    assert_eq!(token_amount(&svm, &escrow_ata), 0);
    assert!(!try_send(&mut svm, &payer, refund_ix())); // double
}

// SPL-token behavioral tests for aid_escrow via litesvm: initialize the admin
// config, register a mint, fund a donor, donate_token, record a token proof,
// release up to the approved amount, and refund. Mirrors the EVM proof-bound
// model. Post-remediation: register_token is admin-gated and the approver is a
// distinct key from the authority.

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

fn config_pda(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"config"], program_id).0
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

/// Initialize the admin Config PDA with `admin` as the protocol admin.
fn init_config(svm: &mut LiteSVM, program_id: &Pubkey, payer: &Keypair, admin: &Pubkey) {
    let config = config_pda(program_id);
    let mut data = disc("initialize_config");
    data.extend_from_slice(admin.as_ref());
    send(
        svm,
        &[payer],
        &payer.pubkey(),
        &[Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(config, false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data,
        }],
    );
}

/// Build a register_token instruction (admin-gated).
fn register_token_ix(program_id: &Pubkey, admin: &Pubkey, mint: &Pubkey, is_stable: bool) -> Instruction {
    let config = config_pda(program_id);
    let (allowed_mint, _) = Pubkey::find_program_address(&[b"mint", mint.as_ref()], program_id);
    let mut rdata = disc("register_token");
    rdata.push(if is_stable { 1u8 } else { 0u8 });
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(allowed_mint, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(*admin, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: rdata,
    }
}

/// Build a set_admin instruction (rotates Config.admin; current admin signs).
fn set_admin_ix(program_id: &Pubkey, current_admin: &Pubkey, new_admin: &Pubkey) -> Instruction {
    let config = config_pda(program_id);
    let mut data = disc("set_admin");
    data.extend_from_slice(new_admin.as_ref());
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(config, false),
            AccountMeta::new_readonly(*current_admin, true),
        ],
        data,
    }
}

/// Create + initialize a classic SPL mint owned by `payer`.
fn create_mint(svm: &mut LiteSVM, payer: &Keypair) -> Keypair {
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
    send(svm, &[payer, &mint], &payer.pubkey(), &[create_mint, init_mint]);
    mint
}

/// svm with admin config, a registered mint, a campaign (distinct approver), and
/// FUNDED tokens donated by `payer`. Returns (svm, pid, payer/authority, approver,
/// mint, campaign).
fn funded_fixture() -> (LiteSVM, Pubkey, Keypair, Keypair, Pubkey, Pubkey) {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    let approver = Keypair::new();
    svm.airdrop(&approver.pubkey(), 10_000_000_000).unwrap();

    // admin config (payer is admin)
    init_config(&mut svm, &program_id, &payer, &payer.pubkey());

    // mint
    let mint = create_mint(&mut svm, &payer);

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

    // register_token (admin-gated)
    send(&mut svm, &[&payer], &payer.pubkey(), &[register_token_ix(&program_id, &payer.pubkey(), &mint.pubkey(), true)]);

    // initialize_campaign with distinct approver
    let id: u64 = 1;
    let (campaign, _) = Pubkey::find_program_address(&[b"campaign", &id.to_le_bytes()], &program_id);
    let mut idata = disc("initialize_campaign");
    idata.extend_from_slice(&id.to_le_bytes());
    idata.push(2u8);
    idata.extend_from_slice(approver.pubkey().as_ref());
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
    let allowed_mint = Pubkey::find_program_address(&[b"mint", mint.pubkey().as_ref()], &program_id).0;
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

    (svm, program_id, payer, approver, mint.pubkey(), campaign)
}

fn approval_token(program_id: &Pubkey, campaign: &Pubkey, tranche: u64, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"appr", campaign.as_ref(), &tranche.to_le_bytes(), mint.as_ref()],
        program_id,
    )
    .0
}

/// Record a token proof for `tranche` / `amount`, signed by `approver`.
fn record_proof_token(
    svm: &mut LiteSVM,
    program_id: &Pubkey,
    approver: &Keypair,
    campaign: &Pubkey,
    mint: &Pubkey,
    tranche: u64,
    amount: u64,
) -> bool {
    let approval = approval_token(program_id, campaign, tranche, mint);
    let campaign_asset = Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], program_id).0;
    let mut pdata = disc("record_proof_token");
    pdata.extend_from_slice(&tranche.to_le_bytes());
    pdata.extend_from_slice(&PH);
    pdata.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*campaign, false),
            AccountMeta::new(campaign_asset, false),
            AccountMeta::new(approval, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(approver.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: pdata,
    };
    try_send(svm, approver, ix)
}

#[test]
fn donate_token_tracks_per_asset() {
    let (svm, program_id, _payer, _approver, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let raised = u64::from_le_bytes(svm.get_account(&campaign_asset).unwrap().data[72..80].try_into().unwrap());
    assert_eq!(raised, FUNDED);
}

#[test]
fn release_token_bounded_by_approved() {
    let (mut svm, program_id, payer, approver, mint, campaign) = funded_fixture();
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
    assert!(record_proof_token(&mut svm, &program_id, &approver, &campaign, &mint, 0, 400_000));

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
    let (mut svm, program_id, payer, _approver, mint, campaign) = funded_fixture();
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
    let (mut svm, program_id, payer, _approver, mint, campaign) = funded_fixture();
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

// ---- Security remediation tests (SPL) ----

// Finding 1 / CC-A: a non-admin signer cannot register a mint.
#[test]
fn register_token_rejects_non_admin() {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    init_config(&mut svm, &program_id, &admin, &admin.pubkey());

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();
    let mint = create_mint(&mut svm, &attacker);

    // attacker (non-admin) signs register_token -> has_one = admin fails
    let ix = register_token_ix(&program_id, &attacker.pubkey(), &mint.pubkey(), true);
    assert!(!try_send(&mut svm, &attacker, ix), "non-admin register_token must revert");
    let allowed_mint = Pubkey::find_program_address(&[b"mint", mint.pubkey().as_ref()], &program_id).0;
    assert!(svm.get_account(&allowed_mint).is_none(), "mint must not be allowlisted");
}

// Finding 1 / CC-A: admin registers once; a second register for the same mint reverts.
#[test]
fn register_token_admin_succeeds_once_then_fails() {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    init_config(&mut svm, &program_id, &admin, &admin.pubkey());
    let mint = create_mint(&mut svm, &admin);

    assert!(try_send(&mut svm, &admin, register_token_ix(&program_id, &admin.pubkey(), &mint.pubkey(), true)));
    // second register for the same mint -> account already in use (init)
    assert!(!try_send(&mut svm, &admin, register_token_ix(&program_id, &admin.pubkey(), &mint.pubkey(), false)));
}

// Admin rotation: a non-admin signer cannot change the admin.
#[test]
fn set_admin_rejects_non_admin() {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    init_config(&mut svm, &program_id, &admin, &admin.pubkey());

    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();
    let new_admin = Keypair::new();
    // attacker (not the admin) tries to rotate -> has_one = admin fails
    let ix = set_admin_ix(&program_id, &attacker.pubkey(), &new_admin.pubkey());
    assert!(!try_send(&mut svm, &attacker, ix), "non-admin set_admin must revert");
}

// Admin rotation: the current admin (standing in for a Squads multisig vault)
// hands off to a new admin; afterwards the new admin controls the allowlist and
// the old admin does not.
#[test]
fn set_admin_rotates_to_new_admin() {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let admin = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    init_config(&mut svm, &program_id, &admin, &admin.pubkey());

    let new_admin = Keypair::new();
    svm.airdrop(&new_admin.pubkey(), 10_000_000_000).unwrap();

    // current admin rotates to new_admin
    assert!(
        try_send(&mut svm, &admin, set_admin_ix(&program_id, &admin.pubkey(), &new_admin.pubkey())),
        "admin rotation must succeed"
    );

    // old admin can no longer register a mint
    let mint_old = create_mint(&mut svm, &admin);
    assert!(
        !try_send(&mut svm, &admin, register_token_ix(&program_id, &admin.pubkey(), &mint_old.pubkey(), true)),
        "old admin must lose allowlist rights after rotation"
    );

    // new admin can register a mint
    let mint_new = create_mint(&mut svm, &new_admin);
    assert!(
        try_send(&mut svm, &new_admin, register_token_ix(&program_id, &new_admin.pubkey(), &mint_new.pubkey(), true)),
        "new admin must control the allowlist after rotation"
    );
}

// Finding 1 (regression): donate_token still rejects an unregistered mint.
#[test]
fn donate_token_rejects_unregistered_mint() {
    let program_id = pid();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    let approver = Keypair::new();
    svm.airdrop(&approver.pubkey(), 10_000_000_000).unwrap();
    init_config(&mut svm, &program_id, &payer, &payer.pubkey());

    // a mint that is NOT registered
    let mint = create_mint(&mut svm, &payer);
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

    let id: u64 = 1;
    let (campaign, _) = Pubkey::find_program_address(&[b"campaign", &id.to_le_bytes()], &program_id);
    let mut idata = disc("initialize_campaign");
    idata.extend_from_slice(&id.to_le_bytes());
    idata.push(2u8);
    idata.extend_from_slice(approver.pubkey().as_ref());
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

    let allowed_mint = Pubkey::find_program_address(&[b"mint", mint.pubkey().as_ref()], &program_id).0;
    let campaign_asset =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.pubkey().as_ref()], &program_id).0;
    let donor_token_stat =
        Pubkey::find_program_address(&[b"donor_token", payer.pubkey().as_ref(), mint.pubkey().as_ref()], &program_id).0;
    let contrib_tok = Pubkey::find_program_address(
        &[b"ctok", campaign.as_ref(), payer.pubkey().as_ref(), mint.pubkey().as_ref()],
        &program_id,
    )
    .0;
    let escrow_ata = get_associated_token_address(&campaign, &mint.pubkey());
    let mut ddata = disc("donate_token");
    ddata.extend_from_slice(&FUNDED.to_le_bytes());
    ddata.push(0u8);
    let ix = Instruction {
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
    };
    // allowed_mint PDA does not exist -> donate_token reverts
    assert!(!try_send(&mut svm, &payer, ix));
}

// Finding 2 / CC-C: release_token cannot push released past raised (it cannot even
// approve past raised). Here raised == FUNDED; approving FUNDED+1 reverts.
#[test]
fn release_token_cannot_exceed_raised() {
    let (mut svm, program_id, _payer, approver, mint, campaign) = funded_fixture();
    // approving more than raised reverts (ExceedsRaised) at record time
    assert!(!record_proof_token(&mut svm, &program_id, &approver, &campaign, &mint, 0, FUNDED + 1));
    // approving exactly raised succeeds
    assert!(record_proof_token(&mut svm, &program_id, &approver, &campaign, &mint, 0, FUNDED));
    // a second tranche beyond raised reverts
    assert!(!record_proof_token(&mut svm, &program_id, &approver, &campaign, &mint, 1, 1));
}

// Finding 9: release_token rejects a self-transfer (recipient == campaign /
// recipient_ata == escrow_ata) and does not advance released counters.
#[test]
fn release_token_rejects_self_transfer() {
    let (mut svm, program_id, payer, approver, mint, campaign) = funded_fixture();
    let (campaign_asset, _) =
        Pubkey::find_program_address(&[b"casset", campaign.as_ref(), mint.as_ref()], &program_id);
    let approval = approval_token(&program_id, &campaign, 0, &mint);
    let escrow_ata = get_associated_token_address(&campaign, &mint);

    assert!(record_proof_token(&mut svm, &program_id, &approver, &campaign, &mint, 0, 400_000));

    // recipient == campaign -> recipient_ata == escrow_ata (self transfer)
    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new(campaign_asset, false),
            AccountMeta::new(approval, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(escrow_ata, false),
            AccountMeta::new(escrow_ata, false), // recipient_ata == escrow_ata
            AccountMeta::new_readonly(campaign, false), // recipient == campaign
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: {
            let mut d = disc("release_token");
            d.extend_from_slice(&0u64.to_le_bytes());
            d.extend_from_slice(&100_000u64.to_le_bytes());
            d
        },
    };
    assert!(!try_send(&mut svm, &payer, ix), "self-transfer release must revert");
    // released counter unchanged
    let released = u64::from_le_bytes(svm.get_account(&campaign_asset).unwrap().data[80..88].try_into().unwrap());
    assert_eq!(released, 0);
}

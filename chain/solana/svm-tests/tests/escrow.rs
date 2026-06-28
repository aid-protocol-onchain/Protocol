// In-process behavioral tests for aid_escrow (SOL paths) using litesvm.
// Covers the proof-bound release model (approver records hash + approved amount,
// authority releases up to it), separation of duties, freeze, and refunds.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use std::str::FromStr;

const PROGRAM_ID: &str = "AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT";
const SO_PATH: &str = "../target/deploy/aid_escrow.so";
const NATIVE: [u8; 32] = [0u8; 32];
const PH: [u8; 32] = [7u8; 32]; // non-zero proof hash

// Campaign: disc8 authority32 approver32 requester32 id8 tier1 raised_sol8 released_sol8 frozen1 refunding1 bump1
const OFF_RAISED: usize = 8 + 32 + 32 + 32 + 8 + 1; // 113
const OFF_RELEASED: usize = OFF_RAISED + 8; // 121
const OFF_FROZEN: usize = OFF_RELEASED + 8; // 129

fn disc(name: &str) -> Vec<u8> {
    Sha256::digest(format!("global:{name}").as_bytes())[..8].to_vec()
}

fn setup() -> (LiteSVM, Pubkey, Keypair) {
    let program_id = Pubkey::from_str(PROGRAM_ID).unwrap();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, program_id, payer)
}

fn send(svm: &mut LiteSVM, signer: &Keypair, ix: Instruction) -> bool {
    svm.expire_blockhash();
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&signer.pubkey()), &[signer], svm.latest_blockhash());
    svm.send_transaction(tx).is_ok()
}

fn campaign_pda(pid: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"campaign", &id.to_le_bytes()], pid).0
}

fn approval_native(pid: &Pubkey, campaign: &Pubkey, tranche: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"appr", campaign.as_ref(), &tranche.to_le_bytes(), &NATIVE], pid).0
}

fn init_campaign(svm: &mut LiteSVM, pid: &Pubkey, payer: &Keypair, id: u64) -> Pubkey {
    let campaign = campaign_pda(pid, id);
    let mut data = disc("initialize_campaign");
    data.extend_from_slice(&id.to_le_bytes());
    data.push(2u8); // tier
    let ix = Instruction {
        program_id: *pid,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new_readonly(payer.pubkey(), false),
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };
    assert!(send(svm, payer, ix), "init campaign should succeed");
    campaign
}

fn donate(svm: &mut LiteSVM, pid: &Pubkey, donor: &Keypair, campaign: &Pubkey, amount: u64) -> bool {
    let donor_profile = Pubkey::find_program_address(&[b"donor", donor.pubkey().as_ref()], pid).0;
    let contrib_sol = Pubkey::find_program_address(&[b"csol", campaign.as_ref(), donor.pubkey().as_ref()], pid).0;
    let mut data = disc("donate");
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(0u8);
    let ix = Instruction {
        program_id: *pid,
        accounts: vec![
            AccountMeta::new(*campaign, false),
            AccountMeta::new(donor_profile, false),
            AccountMeta::new(contrib_sol, false),
            AccountMeta::new(donor.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };
    send(svm, donor, ix)
}

fn record_proof(svm: &mut LiteSVM, pid: &Pubkey, approver: &Keypair, campaign: &Pubkey, tranche: u64, amount: u64) -> bool {
    let approval = approval_native(pid, campaign, tranche);
    let mut data = disc("record_proof");
    data.extend_from_slice(&tranche.to_le_bytes());
    data.extend_from_slice(&PH);
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: *pid,
        accounts: vec![
            AccountMeta::new_readonly(*campaign, false),
            AccountMeta::new(approval, false),
            AccountMeta::new(approver.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };
    send(svm, approver, ix)
}

fn release(svm: &mut LiteSVM, pid: &Pubkey, authority: &Keypair, campaign: &Pubkey, tranche: u64, amount: u64, recipient: &Pubkey) -> bool {
    let approval = approval_native(pid, campaign, tranche);
    let mut data = disc("release");
    data.extend_from_slice(&tranche.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: *pid,
        accounts: vec![
            AccountMeta::new(*campaign, false),
            AccountMeta::new(approval, false),
            AccountMeta::new(*recipient, false),
            AccountMeta::new_readonly(authority.pubkey(), true),
        ],
        data,
    };
    send(svm, authority, ix)
}

fn u64_at(svm: &LiteSVM, key: &Pubkey, off: usize) -> u64 {
    let a = svm.get_account(key).unwrap();
    u64::from_le_bytes(a.data[off..off + 8].try_into().unwrap())
}

#[test]
fn initialize_and_donate() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    assert!(donate(&mut svm, &pid, &payer, &c, 2_000_000));
    assert_eq!(u64_at(&svm, &c, OFF_RAISED), 2_000_000);
}

#[test]
fn release_needs_proof() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    // no proof yet -> release fails
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn release_bounded_by_approved() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    assert!(record_proof(&mut svm, &pid, &payer, &c, 0, 4_000_000));
    // over approved fails
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 5_000_000, &recipient));
    // within approved succeeds
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    assert_eq!(u64_at(&svm, &c, OFF_RELEASED), 4_000_000);
}

#[test]
fn release_does_not_grow_with_donations() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    record_proof(&mut svm, &pid, &payer, &c, 0, 4_000_000);
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    // more donations arrive, but the fixed approval does not grow
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn separation_of_duties() {
    let (mut svm, pid, payer) = setup(); // payer is authority + approver by default
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);

    let other = Keypair::new();
    svm.airdrop(&other.pubkey(), 1_000_000_000).unwrap();
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();

    // non-approver cannot record proof
    assert!(!record_proof(&mut svm, &pid, &other, &c, 0, 1_000_000));
    // approver records
    assert!(record_proof(&mut svm, &pid, &payer, &c, 0, 4_000_000));
    // non-authority cannot release
    assert!(!release(&mut svm, &pid, &other, &c, 0, 1_000_000, &recipient));
    // authority can
    assert!(release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn set_approver_rotates_role() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    let new_approver = Keypair::new();
    svm.airdrop(&new_approver.pubkey(), 1_000_000_000).unwrap();

    // authority sets a distinct approver
    let mut data = disc("set_approver");
    data.extend_from_slice(new_approver.pubkey().as_ref());
    let ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data,
    };
    assert!(send(&mut svm, &payer, ix));

    // old approver (authority) can no longer record proof; new one can
    assert!(!record_proof(&mut svm, &pid, &payer, &c, 0, 1_000_000));
    assert!(record_proof(&mut svm, &pid, &new_approver, &c, 0, 1_000_000));
}

#[test]
fn freeze_blocks_donation() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    let ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data: disc("freeze"),
    };
    assert!(send(&mut svm, &payer, ix));
    assert_eq!(svm.get_account(&c).unwrap().data[OFF_FROZEN], 1u8);
    assert!(!donate(&mut svm, &pid, &payer, &c, 1_000_000));
}

#[test]
fn non_authority_cannot_freeze() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();
    let ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(attacker.pubkey(), true),
        ],
        data: disc("freeze"),
    };
    assert!(!send(&mut svm, &attacker, ix));
    assert_eq!(svm.get_account(&c).unwrap().data[OFF_FROZEN], 0u8);
}

#[test]
fn refund_sol_returns_undisbursed() {
    let (mut svm, pid, payer) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, 1);
    let donor = Keypair::new();
    svm.airdrop(&donor.pubkey(), 10_000_000_000).unwrap();
    assert!(donate(&mut svm, &pid, &donor, &c, 5_000_000));

    let (contrib, _) = Pubkey::find_program_address(&[b"csol", c.as_ref(), donor.pubkey().as_ref()], &pid);
    let refund_ix = || Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new(contrib, false),
            AccountMeta::new(donor.pubkey(), true),
        ],
        data: disc("refund_sol"),
    };

    // before enable_refunds
    assert!(!send(&mut svm, &donor, refund_ix()));
    // enable
    let enable = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data: disc("enable_refunds"),
    };
    assert!(send(&mut svm, &payer, enable));
    // claim
    assert!(send(&mut svm, &donor, refund_ix()));
    let refunded = u64::from_le_bytes(svm.get_account(&contrib).unwrap().data[16..24].try_into().unwrap());
    assert_eq!(refunded, 5_000_000);
    // double claim fails
    assert!(!send(&mut svm, &donor, refund_ix()));
}

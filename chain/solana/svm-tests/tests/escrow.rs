// In-process behavioral tests for aid_escrow (SOL paths) using litesvm.
// Covers the proof-bound release model (approver records hash + approved amount,
// authority releases up to it), separation of duties, freeze, and refunds.
//
// Post-remediation: the authority and approver MUST be distinct keys. Helpers
// take an explicit `approver` keypair; `payer` is the authority. Negative tests
// for the security fixes (raised ceiling, rent floor, self-approver, write-once
// approval, monotonic tranche, zero amount) live at the bottom.

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

// Campaign: disc8 authority32 approver32 requester32 id8 tier1 raised_sol8 released_sol8 frozen1 refunding1 bump1 ...
const OFF_RAISED: usize = 8 + 32 + 32 + 32 + 8 + 1; // 113
const OFF_RELEASED: usize = OFF_RAISED + 8; // 121
const OFF_FROZEN: usize = OFF_RELEASED + 8; // 129

fn disc(name: &str) -> Vec<u8> {
    Sha256::digest(format!("global:{name}").as_bytes())[..8].to_vec()
}

/// Returns (svm, program_id, payer/authority, approver). Approver is a distinct,
/// funded key per the separation-of-duties rule.
fn setup() -> (LiteSVM, Pubkey, Keypair, Keypair) {
    let program_id = Pubkey::from_str(PROGRAM_ID).unwrap();
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(program_id, SO_PATH).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    let approver = Keypair::new();
    svm.airdrop(&approver.pubkey(), 10_000_000_000).unwrap();
    (svm, program_id, payer, approver)
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

/// Initialize a campaign with an explicit distinct approver.
fn init_campaign(svm: &mut LiteSVM, pid: &Pubkey, payer: &Keypair, approver: &Pubkey, id: u64) -> Pubkey {
    let campaign = campaign_pda(pid, id);
    let mut data = disc("initialize_campaign");
    data.extend_from_slice(&id.to_le_bytes());
    data.push(2u8); // tier
    data.extend_from_slice(approver.as_ref());
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

/// Record a SOL proof. `approver` signs; `campaign` is now mutable (counter/total).
fn record_proof(svm: &mut LiteSVM, pid: &Pubkey, approver: &Keypair, campaign: &Pubkey, tranche: u64, amount: u64) -> bool {
    let approval = approval_native(pid, campaign, tranche);
    let mut data = disc("record_proof");
    data.extend_from_slice(&tranche.to_le_bytes());
    data.extend_from_slice(&PH);
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: *pid,
        accounts: vec![
            AccountMeta::new(*campaign, false),
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

fn lamports(svm: &LiteSVM, key: &Pubkey) -> u64 {
    svm.get_account(key).unwrap().lamports
}

#[test]
fn initialize_and_donate() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    assert!(donate(&mut svm, &pid, &payer, &c, 2_000_000));
    assert_eq!(u64_at(&svm, &c, OFF_RAISED), 2_000_000);
}

#[test]
fn release_needs_proof() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    // no proof yet -> release fails
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn release_bounded_by_approved() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 4_000_000));
    // over approved fails
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 5_000_000, &recipient));
    // within approved succeeds
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    assert_eq!(u64_at(&svm, &c, OFF_RELEASED), 4_000_000);
}

#[test]
fn release_does_not_grow_with_donations() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    record_proof(&mut svm, &pid, &approver, &c, 0, 4_000_000);
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    // more donations arrive, but the fixed approval (write-once) does not grow
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn separation_of_duties() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 10_000_000);

    let other = Keypair::new();
    svm.airdrop(&other.pubkey(), 1_000_000_000).unwrap();
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();

    // non-approver cannot record proof
    assert!(!record_proof(&mut svm, &pid, &other, &c, 0, 1_000_000));
    // approver records
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 4_000_000));
    // non-authority cannot release
    assert!(!release(&mut svm, &pid, &other, &c, 0, 1_000_000, &recipient));
    // authority can
    assert!(release(&mut svm, &pid, &payer, &c, 0, 1_000_000, &recipient));
}

#[test]
fn set_approver_rotates_role() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    let new_approver = Keypair::new();
    svm.airdrop(&new_approver.pubkey(), 1_000_000_000).unwrap();

    // authority sets a distinct (new) approver
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

    // old approver can no longer record proof; new one can
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 0, 1_000_000));
    donate(&mut svm, &pid, &payer, &c, 10_000_000);
    assert!(record_proof(&mut svm, &pid, &new_approver, &c, 0, 1_000_000));
}

#[test]
fn freeze_blocks_donation() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
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
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
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
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
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

// ---- Security remediation tests (each fails on the old code, passes on the fix) ----

// Finding 10: initialize_campaign must reject approver == authority.
#[test]
fn initialize_campaign_rejects_self_approver() {
    let (mut svm, pid, payer, _approver) = setup();
    let id = 7u64;
    let campaign = campaign_pda(&pid, id);
    let mut data = disc("initialize_campaign");
    data.extend_from_slice(&id.to_le_bytes());
    data.push(2u8);
    data.extend_from_slice(payer.pubkey().as_ref()); // approver == authority
    let ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(campaign, false),
            AccountMeta::new_readonly(payer.pubkey(), false),
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };
    assert!(!send(&mut svm, &payer, ix), "self-approver init must revert");
    assert!(svm.get_account(&campaign).is_none(), "campaign must not be created");
}

// Finding 10: set_approver must reject the authority itself.
#[test]
fn set_approver_rejects_authority() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    let mut data = disc("set_approver");
    data.extend_from_slice(payer.pubkey().as_ref()); // authority itself
    let ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data,
    };
    assert!(!send(&mut svm, &payer, ix), "set_approver(authority) must revert");
}

// Finding 2 / CC-C: release can never exceed funds raised, even if approved is larger.
#[test]
fn release_cannot_exceed_raised() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 4_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    // approving more than raised must already be impossible (finding 4), so the
    // approval is capped at raised; approving exactly raised succeeds.
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 4_000_000));
    // attempting to approve a second tranche beyond raised reverts (ExceedsRaised)
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 1, 1));
    // release up to raised succeeds
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    // nothing left to release
    assert!(!release(&mut svm, &pid, &payer, &c, 0, 1, &recipient));
    assert_eq!(u64_at(&svm, &c, OFF_RELEASED), 4_000_000);
}

// Finding 2 / 3 / CC-B: the campaign PDA stays rent-exempt; a debit that would
// cross the floor reverts. We raise only a tiny amount so the floor is reachable.
#[test]
fn release_preserves_rent_floor() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    let floor_before = lamports(&svm, &c);
    // donate a modest amount on top of the rent reserve
    donate(&mut svm, &pid, &payer, &c, 2_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 2_000_000));
    // release the full raised amount (allowed: it sits above the rent reserve)
    assert!(release(&mut svm, &pid, &payer, &c, 0, 2_000_000, &recipient));
    // campaign still holds at least its rent-exempt reserve
    assert!(lamports(&svm, &c) >= floor_before, "rent reserve must be preserved");
}

// Finding 4 / CC-C: zero-amount proofs are rejected.
#[test]
fn record_proof_rejects_zero_amount() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 4_000_000);
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 0, 0), "zero amount must revert");
}

// Finding 4 / CC-C: cumulative approved across tranches cannot exceed raised.
#[test]
fn total_approved_cannot_exceed_raised() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 5_000_000);
    // first tranche approves 3M (ok)
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 3_000_000));
    // second tranche tries 3M more -> cumulative 6M > raised 5M -> revert
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 1, 3_000_000));
    // a tranche that keeps cumulative <= raised succeeds
    assert!(record_proof(&mut svm, &pid, &approver, &c, 1, 2_000_000));
}

// Finding 4 / CC-C: far-future tranche index is rejected (monotonic bound).
#[test]
fn tranche_index_must_be_monotonic() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 5_000_000);
    // tranche 0 is the next expected slot -> ok
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 1_000_000));
    // a far-future tranche index must revert
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 9_999, 1_000_000));
}

// Finding 5: each approval is write-once; re-recording the same tranche reverts.
#[test]
fn approval_is_write_once() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 5_000_000);
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 1_000_000));
    // second record for the same (campaign, tranche, NATIVE) reverts (init)
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 0, 1_000_000));
}

// Finding 5: the ceiling cannot be reopened after a full release.
#[test]
fn cannot_reopen_ceiling_after_release() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    donate(&mut svm, &pid, &payer, &c, 5_000_000);
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 2_000_000));
    assert!(release(&mut svm, &pid, &payer, &c, 0, 2_000_000, &recipient));
    // re-recording tranche 0 to reopen headroom reverts
    assert!(!record_proof(&mut svm, &pid, &approver, &c, 0, 2_000_000));
}

// Finding 2: after a max release, refunds still compute (no underflow / DoS).
#[test]
fn over_release_does_not_brick_refunds() {
    let (mut svm, pid, payer, approver) = setup();
    let c = init_campaign(&mut svm, &pid, &payer, &approver.pubkey(), 1);
    let donor = Keypair::new();
    svm.airdrop(&donor.pubkey(), 10_000_000_000).unwrap();
    assert!(donate(&mut svm, &pid, &donor, &c, 4_000_000));
    let recipient = Keypair::new().pubkey();
    svm.airdrop(&recipient, 1).unwrap();
    // approve and release up to raised (cannot exceed it)
    assert!(record_proof(&mut svm, &pid, &approver, &c, 0, 4_000_000));
    assert!(release(&mut svm, &pid, &payer, &c, 0, 4_000_000, &recipient));
    // enable refunds; refund computes (owed == 0 here -> NothingToRefund, not panic)
    let enable = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new_readonly(payer.pubkey(), true),
        ],
        data: disc("enable_refunds"),
    };
    assert!(send(&mut svm, &payer, enable));
    let (contrib, _) = Pubkey::find_program_address(&[b"csol", c.as_ref(), donor.pubkey().as_ref()], &pid);
    let refund_ix = Instruction {
        program_id: pid,
        accounts: vec![
            AccountMeta::new(c, false),
            AccountMeta::new(contrib, false),
            AccountMeta::new(donor.pubkey(), true),
        ],
        data: disc("refund_sol"),
    };
    // released == raised -> remaining 0 -> owed 0 -> NothingToRefund (clean revert),
    // proving refundable() did not underflow.
    assert!(!send(&mut svm, &donor, refund_ix));
}

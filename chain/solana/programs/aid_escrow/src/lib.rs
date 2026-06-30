use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};

declare_id!("AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT");

/// Sentinel asset key for native SOL approvals (mints use their own pubkey).
pub const NATIVE_ASSET: [u8; 32] = [0u8; 32];

/// Aid Protocol escrow program (Solana side of ADR-001, multi-asset per ADR-008).
/// Holds native SOL and admin-whitelisted SPL tokens (USDC, USDT), tracked per
/// asset. Release is proof-bound: the `approver` commits a content hash and an
/// approved amount per tranche per asset, and the distinct `authority` may release
/// only up to that approved amount (separation of duties; no live-percentage cap).
/// When fraud is found, donors claim pro-rata refunds (SOL and tokens).
///
/// Token support is CLASSIC SPL TOKEN ONLY (finding 8). The program pins
/// `anchor_spl::token::{Mint, TokenAccount, Token}`, which deserialize/validate
/// against the classic SPL Token program (`spl_token::ID`) and reject Token-2022
/// mints and accounts. Token-2022 extensions (transfer fee, permanent delegate,
/// transfer hooks, mint-close authority) are intentionally NOT handled in this
/// program; admitting a fee-bearing mint would desync escrow accounting. If
/// Token-2022 is ever adopted, migrate to `anchor_spl::token_interface`, switch to
/// `transfer_checked`, validate mint extensions, and add delta-aware accounting.
///
/// The proof `hash` recorded per tranche is an OFF-CHAIN attestation only
/// (finding 12). The on-chain check is presence (`hash != NATIVE_ASSET`), not
/// verification; the content the hash represents is never validated on-chain and
/// is not bound to `amount` / `recipient`. Do not read the on-chain check as proof
/// verification.
#[program]
pub mod aid_escrow {
    use super::*;

    /// Create the single program `Config` PDA and set the protocol admin (CC-A).
    /// Privileged state (AD-2): it gates the mint allowlist and never touches
    /// campaign money. Created once with `init` (not `init_if_needed`).
    pub fn initialize_config(ctx: Context<InitializeConfig>, admin: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = admin;
        cfg.bump = ctx.bumps.config;
        emit!(ConfigInitialized { admin });
        Ok(())
    }

    /// Allowlist a classic-SPL mint. Admin-gated (CC-A, finding 1): only the
    /// `Config.admin` may register a mint or set its `is_stable` flag. Uses `init`
    /// so a mint cannot be silently re-registered with a flipped `is_stable`.
    pub fn register_token(ctx: Context<RegisterToken>, is_stable: bool) -> Result<()> {
        let m = &mut ctx.accounts.allowed_mint;
        m.mint = ctx.accounts.mint.key();
        m.is_stable = is_stable;
        m.bump = ctx.bumps.allowed_mint;
        emit!(TokenRegistered { mint: m.mint, is_stable });
        Ok(())
    }

    /// Create a campaign. The `approver` is explicit and MUST differ from the
    /// `authority` (AD-3 separation of duties, finding 10): never one key for both.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        id: u64,
        tier: u8,
        approver: Pubkey,
    ) -> Result<()> {
        require!(approver != ctx.accounts.authority.key(), AidError::ApproverIsAuthority);
        let c = &mut ctx.accounts.campaign;
        c.authority = ctx.accounts.authority.key();
        c.approver = approver;
        c.requester = ctx.accounts.requester.key();
        c.id = id;
        c.tier = tier;
        c.raised_sol = 0;
        c.released_sol = 0;
        c.frozen = false;
        c.refunding = false;
        c.bump = ctx.bumps.campaign;
        c.approved_sol = 0;
        c.next_tranche_sol = 0;
        emit!(CampaignCreated { id, requester: c.requester, tier });
        Ok(())
    }

    /// Rotate the approver. The new approver MUST differ from the authority
    /// (AD-3 separation of duties, finding 10).
    pub fn set_approver(ctx: Context<AuthorityOnly>, new_approver: Pubkey) -> Result<()> {
        require!(new_approver != ctx.accounts.campaign.authority, AidError::ApproverIsAuthority);
        ctx.accounts.campaign.approver = new_approver;
        emit!(ApproverChanged { campaign: ctx.accounts.campaign.key(), approver: new_approver });
        Ok(())
    }

    /// Rotate the protocol admin. The current `Config.admin` authorizes the
    /// change, so a Squads multisig vault set as admin can hand off to a new
    /// admin via its own M-of-N approval. The new admin must be a real key.
    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        require!(new_admin != Pubkey::default(), AidError::InvalidAdmin);
        ctx.accounts.config.admin = new_admin;
        emit!(AdminChanged { admin: new_admin });
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64, anonymous: bool) -> Result<()> {
        require!(!ctx.accounts.campaign.frozen, AidError::Frozen);
        let cpi = CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer { from: ctx.accounts.donor.to_account_info(), to: ctx.accounts.campaign.to_account_info() },
        );
        transfer(cpi, amount)?;

        let c = &mut ctx.accounts.campaign;
        c.raised_sol = c.raised_sol.checked_add(amount).ok_or(AidError::Overflow)?;
        let p = &mut ctx.accounts.donor_profile;
        p.donor = ctx.accounts.donor.key();
        p.sol_donated = p.sol_donated.checked_add(amount).ok_or(AidError::Overflow)?;
        p.donation_count = p.donation_count.saturating_add(1);
        p.bump = ctx.bumps.donor_profile;
        let cs = &mut ctx.accounts.contrib_sol;
        cs.amount = cs.amount.checked_add(amount).ok_or(AidError::Overflow)?;
        cs.bump = ctx.bumps.contrib_sol;
        emit!(DonationSol { campaign: c.key(), donor: ctx.accounts.donor.key(), amount, anonymous });
        Ok(())
    }

    pub fn donate_token(ctx: Context<DonateToken>, amount: u64, anonymous: bool) -> Result<()> {
        require!(!ctx.accounts.campaign.frozen, AidError::Frozen);
        let ca = &mut ctx.accounts.campaign_asset;
        ca.campaign = ctx.accounts.campaign.key();
        ca.mint = ctx.accounts.mint.key();
        ca.raised = ca.raised.checked_add(amount).ok_or(AidError::Overflow)?;
        ca.bump = ctx.bumps.campaign_asset;
        let s = &mut ctx.accounts.donor_token_stat;
        s.donor = ctx.accounts.donor.key();
        s.mint = ctx.accounts.mint.key();
        s.total_donated = s.total_donated.checked_add(amount).ok_or(AidError::Overflow)?;
        s.bump = ctx.bumps.donor_token_stat;
        let ct = &mut ctx.accounts.contrib_tok;
        ct.amount = ct.amount.checked_add(amount).ok_or(AidError::Overflow)?;
        ct.bump = ctx.bumps.contrib_tok;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                SplTransfer {
                    from: ctx.accounts.donor_ata.to_account_info(),
                    to: ctx.accounts.escrow_ata.to_account_info(),
                    authority: ctx.accounts.donor.to_account_info(),
                },
            ),
            amount,
        )?;
        emit!(DonationToken {
            campaign: ctx.accounts.campaign.key(),
            donor: ctx.accounts.donor.key(),
            mint: ctx.accounts.mint.key(),
            amount,
            anonymous
        });
        Ok(())
    }

    /// Approver commits a proof hash and approved amount for a tranche (native SOL).
    /// Enforces (finding 4, CC-C): non-zero amount, cumulative `approved_sol <=
    /// raised_sol`, and a monotonic tranche bound so tranches cannot be sprayed
    /// across the `u64` space. With `init` on the approval (finding 5) each
    /// `(campaign, tranche, NATIVE)` proof is a one-time, non-reopenable commitment.
    pub fn record_proof(ctx: Context<RecordProof>, tranche: u64, hash: [u8; 32], amount: u64) -> Result<()> {
        require!(hash != NATIVE_ASSET, AidError::NotApproved);
        require!(amount > 0, AidError::ZeroAmount);
        // Monotonic tranche bound (CC-C): accept only the next slot or backfill of
        // an already-allowed slot; reject far-future indices.
        require!(tranche <= ctx.accounts.campaign.next_tranche_sol, AidError::BadTranche);

        let raised = ctx.accounts.campaign.raised_sol;
        let new_total = ctx
            .accounts
            .campaign
            .approved_sol
            .checked_add(amount)
            .ok_or(AidError::Overflow)?;
        require!(new_total <= raised, AidError::ExceedsRaised);

        let a = &mut ctx.accounts.approval;
        a.hash = hash;
        a.approved = a.approved.checked_add(amount).ok_or(AidError::Overflow)?;
        a.bump = ctx.bumps.approval;

        let c = &mut ctx.accounts.campaign;
        c.approved_sol = new_total;
        if tranche == c.next_tranche_sol {
            c.next_tranche_sol = c.next_tranche_sol.checked_add(1).ok_or(AidError::Overflow)?;
        }
        emit!(ProofRecorded { campaign: c.key(), asset: Pubkey::default(), amount });
        Ok(())
    }

    /// Approver commits a proof hash and approved amount for a tranche (SPL token).
    /// Same CC-C invariants against the per-asset `campaign_asset` totals.
    pub fn record_proof_token(ctx: Context<RecordProofToken>, tranche: u64, hash: [u8; 32], amount: u64) -> Result<()> {
        require!(hash != NATIVE_ASSET, AidError::NotApproved);
        require!(amount > 0, AidError::ZeroAmount);
        require!(tranche <= ctx.accounts.campaign_asset.next_tranche, AidError::BadTranche);

        let raised = ctx.accounts.campaign_asset.raised;
        let new_total = ctx
            .accounts
            .campaign_asset
            .total_approved
            .checked_add(amount)
            .ok_or(AidError::Overflow)?;
        require!(new_total <= raised, AidError::ExceedsRaised);

        let a = &mut ctx.accounts.approval;
        a.hash = hash;
        a.approved = a.approved.checked_add(amount).ok_or(AidError::Overflow)?;
        a.bump = ctx.bumps.approval;

        let ca = &mut ctx.accounts.campaign_asset;
        ca.total_approved = new_total;
        if tranche == ca.next_tranche {
            ca.next_tranche = ca.next_tranche.checked_add(1).ok_or(AidError::Overflow)?;
        }
        emit!(ProofRecorded { campaign: ctx.accounts.campaign.key(), asset: ctx.accounts.mint.key(), amount });
        Ok(())
    }

    pub fn release(ctx: Context<Release>, _tranche: u64, amount: u64) -> Result<()> {
        require!(!ctx.accounts.campaign.frozen, AidError::Frozen);
        // Belt-and-suspenders separation of duties (AD-3, finding 10).
        require!(
            ctx.accounts.campaign.approver != ctx.accounts.campaign.authority,
            AidError::ApproverIsAuthority
        );
        let hash = ctx.accounts.approval.hash;
        let approved = ctx.accounts.approval.approved;
        let already = ctx.accounts.approval.released;
        require!(hash != NATIVE_ASSET, AidError::NotApproved);
        let new_released = already.checked_add(amount).ok_or(AidError::Overflow)?;
        require!(new_released <= approved, AidError::ExceedsApproved);
        // CC-C: release can never exceed funds actually raised, per asset.
        let new_released_sol = ctx
            .accounts
            .campaign
            .released_sol
            .checked_add(amount)
            .ok_or(AidError::Overflow)?;
        require!(new_released_sol <= ctx.accounts.campaign.raised_sol, AidError::ExceedsRaised);

        // CC-B: never drop the campaign below its rent-exempt floor.
        debit_with_rent_floor(
            &ctx.accounts.campaign.to_account_info(),
            &ctx.accounts.recipient.to_account_info(),
            amount,
            Campaign::SPACE,
        )?;

        ctx.accounts.campaign.released_sol = new_released_sol;
        ctx.accounts.approval.released = new_released;
        emit!(ReleasedSol { campaign: ctx.accounts.campaign.key(), to: ctx.accounts.recipient.key(), amount });
        Ok(())
    }

    pub fn release_token(ctx: Context<ReleaseToken>, _tranche: u64, amount: u64) -> Result<()> {
        require!(!ctx.accounts.campaign.frozen, AidError::Frozen);
        require!(
            ctx.accounts.campaign.approver != ctx.accounts.campaign.authority,
            AidError::ApproverIsAuthority
        );
        // Forbid self-transfer / no-op release (finding 9).
        require!(
            ctx.accounts.recipient_ata.key() != ctx.accounts.escrow_ata.key(),
            AidError::InvalidRecipient
        );
        require!(
            ctx.accounts.recipient.key() != ctx.accounts.campaign.key(),
            AidError::InvalidRecipient
        );
        let hash = ctx.accounts.approval.hash;
        let approved = ctx.accounts.approval.approved;
        let already = ctx.accounts.approval.released;
        require!(hash != NATIVE_ASSET, AidError::NotApproved);
        let new_released = already.checked_add(amount).ok_or(AidError::Overflow)?;
        require!(new_released <= approved, AidError::ExceedsApproved);
        // CC-C: per-asset released ceiling bound by raised.
        let new_asset_released = ctx
            .accounts
            .campaign_asset
            .released
            .checked_add(amount)
            .ok_or(AidError::Overflow)?;
        require!(new_asset_released <= ctx.accounts.campaign_asset.raised, AidError::ExceedsRaised);

        // CC-D: the campaign account is re-derived in the context (seeds + bump),
        // so the bump used for invoke_signed is verified, not trusted from data.
        let id = ctx.accounts.campaign.id;
        let bump = ctx.accounts.campaign.bump;
        let seeds: &[&[u8]] = &[b"campaign", &id.to_le_bytes()[..], &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SplTransfer {
                    from: ctx.accounts.escrow_ata.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        ctx.accounts.campaign_asset.released = new_asset_released;
        ctx.accounts.approval.released = new_released;
        emit!(ReleasedToken { campaign: ctx.accounts.campaign.key(), mint: ctx.accounts.campaign_asset.mint, amount });
        Ok(())
    }

    pub fn freeze(ctx: Context<AuthorityOnly>) -> Result<()> {
        ctx.accounts.campaign.frozen = true;
        emit!(CampaignFrozen { campaign: ctx.accounts.campaign.key() });
        Ok(())
    }

    pub fn enable_refunds(ctx: Context<AuthorityOnly>) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        c.frozen = true;
        c.refunding = true;
        emit!(RefundsEnabled { campaign: c.key() });
        Ok(())
    }

    pub fn refund_sol(ctx: Context<RefundSol>) -> Result<()> {
        require!(ctx.accounts.campaign.refunding, AidError::NotRefunding);
        let raised = ctx.accounts.campaign.raised_sol;
        let released = ctx.accounts.campaign.released_sol;
        let contributed = ctx.accounts.contrib_sol.amount;
        let already = ctx.accounts.contrib_sol.refunded;
        let owed = refundable(contributed, raised, released).checked_sub(already).ok_or(AidError::Overflow)?;
        require!(owed > 0, AidError::NothingToRefund);
        // CC-B: never drop the campaign below its rent-exempt floor (finding 3).
        debit_with_rent_floor(
            &ctx.accounts.campaign.to_account_info(),
            &ctx.accounts.donor.to_account_info(),
            owed,
            Campaign::SPACE,
        )?;
        ctx.accounts.contrib_sol.refunded = already.checked_add(owed).ok_or(AidError::Overflow)?;
        emit!(SolRefunded { campaign: ctx.accounts.campaign.key(), donor: ctx.accounts.donor.key(), amount: owed });
        Ok(())
    }

    pub fn refund_token(ctx: Context<RefundToken>) -> Result<()> {
        require!(ctx.accounts.campaign.refunding, AidError::NotRefunding);
        let raised = ctx.accounts.campaign_asset.raised;
        let released = ctx.accounts.campaign_asset.released;
        let contributed = ctx.accounts.contrib_tok.amount;
        let already = ctx.accounts.contrib_tok.refunded;
        let owed = refundable(contributed, raised, released).checked_sub(already).ok_or(AidError::Overflow)?;
        require!(owed > 0, AidError::NothingToRefund);
        // CC-D: campaign re-derived in context; bump verified for invoke_signed.
        let id = ctx.accounts.campaign.id;
        let bump = ctx.accounts.campaign.bump;
        let seeds: &[&[u8]] = &[b"campaign", &id.to_le_bytes()[..], &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SplTransfer {
                    from: ctx.accounts.escrow_ata.to_account_info(),
                    to: ctx.accounts.donor_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                &[seeds],
            ),
            owed,
        )?;
        ctx.accounts.contrib_tok.refunded = already.checked_add(owed).ok_or(AidError::Overflow)?;
        emit!(TokenRefunded {
            campaign: ctx.accounts.campaign.key(),
            donor: ctx.accounts.donor.key(),
            mint: ctx.accounts.campaign_asset.mint,
            amount: owed
        });
        Ok(())
    }
}

/// CC-B rent-floor helper: debit `amount` lamports from `from` to `to`, but only
/// the portion above `from`'s rent-exempt minimum for `space` is debitable. Any
/// debit that would push `from` below the rent-exempt floor is rejected
/// (`AidError::BelowRentFloor`). The rent reserve stays in the data-bearing PDA
/// for its entire lifetime so it can never be garbage-collected (finding 3).
fn debit_with_rent_floor(
    from: &AccountInfo,
    to: &AccountInfo,
    amount: u64,
    space: usize,
) -> Result<()> {
    let floor = Rent::get()?.minimum_balance(space);
    let current = from.lamports();
    let available = current.checked_sub(floor).ok_or(AidError::BelowRentFloor)?;
    require!(amount <= available, AidError::BelowRentFloor);
    **from.try_borrow_mut_lamports()? = current.checked_sub(amount).ok_or(AidError::Overflow)?;
    let to_current = to.lamports();
    **to.try_borrow_mut_lamports()? = to_current.checked_add(amount).ok_or(AidError::Overflow)?;
    Ok(())
}

fn refundable(contributed: u64, raised: u64, released: u64) -> u64 {
    if raised == 0 {
        return 0;
    }
    let remaining = (raised - released) as u128;
    ((contributed as u128 * remaining) / raised as u128) as u64
}

// ---- state ----

/// Privileged program config (CC-A). Single PDA at `[b"config"]`. Gates the mint
/// allowlist; never holds or moves campaign money (AD-2).
#[account]
pub struct Config {
    pub admin: Pubkey,
    pub bump: u8,
}
impl Config {
    pub const SPACE: usize = 8 + 32 + 1;
}

#[account]
pub struct Campaign {
    pub authority: Pubkey,
    pub approver: Pubkey,
    pub requester: Pubkey,
    pub id: u64,
    pub tier: u8,
    pub raised_sol: u64,
    pub released_sol: u64,
    pub frozen: bool,
    pub refunding: bool,
    pub bump: u8,
    // Appended (after `bump`) so existing account-data offsets for raised/released/
    // frozen are preserved. CC-C: cumulative SOL approved across tranches, and a
    // monotonic next-tranche counter.
    pub approved_sol: u64,
    pub next_tranche_sol: u64,
}
impl Campaign {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 8 + 8;
}

#[account]
pub struct AllowedMint {
    pub mint: Pubkey,
    pub is_stable: bool,
    pub bump: u8,
}
impl AllowedMint {
    pub const SPACE: usize = 8 + 32 + 1 + 1;
}

#[account]
pub struct CampaignAsset {
    pub campaign: Pubkey,
    pub mint: Pubkey,
    pub raised: u64,
    pub released: u64,
    pub bump: u8,
    // Appended (after `bump`) so the existing `raised` offset is preserved.
    // CC-C: cumulative approved per asset, and a monotonic next-tranche counter.
    pub total_approved: u64,
    pub next_tranche: u64,
}
impl CampaignAsset {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 8;
}

#[account]
pub struct DonorProfile {
    pub donor: Pubkey,
    pub sol_donated: u64,
    pub donation_count: u32,
    pub bump: u8,
}
impl DonorProfile {
    pub const SPACE: usize = 8 + 32 + 8 + 4 + 1;
}

#[account]
pub struct DonorTokenStat {
    pub donor: Pubkey,
    pub mint: Pubkey,
    pub total_donated: u64,
    pub bump: u8,
}
impl DonorTokenStat {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct ContribSol {
    pub amount: u64,
    pub refunded: u64,
    pub bump: u8,
}
impl ContribSol {
    pub const SPACE: usize = 8 + 8 + 8 + 1;
}

#[account]
pub struct ContribTok {
    pub amount: u64,
    pub refunded: u64,
    pub bump: u8,
}
impl ContribTok {
    pub const SPACE: usize = 8 + 8 + 8 + 1;
}

/// Per-(campaign, tranche, asset) approval: committed hash + approved/released amounts.
#[account]
pub struct Approval {
    pub hash: [u8; 32],
    pub approved: u64,
    pub released: u64,
    pub bump: u8,
}
impl Approval {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 1;
}

// ---- accounts ----

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = payer, space = Config::SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterToken<'info> {
    // CC-A / finding 1: admin-gated allowlist. `has_one = admin` ties the signer to
    // the protocol admin stored in the single Config PDA.
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    // `init` (not init_if_needed): a mint cannot be silently re-registered with a
    // flipped `is_stable`.
    #[account(init, payer = admin, space = AllowedMint::SPACE, seeds = [b"mint", mint.key().as_ref()], bump)]
    pub allowed_mint: Account<'info, AllowedMint>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    // Only the current Config.admin (which may be a Squads multisig vault) may
    // rotate the admin. `mut` so the new admin is written into the PDA.
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeCampaign<'info> {
    #[account(init, payer = authority, space = Campaign::SPACE, seeds = [b"campaign", id.to_le_bytes().as_ref()], bump)]
    pub campaign: Account<'info, Campaign>,
    /// CHECK: stored for reference only; the public requester identity (ADR-004).
    pub requester: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    // CC-D: re-derive and verify the canonical campaign PDA.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(init_if_needed, payer = donor, space = DonorProfile::SPACE, seeds = [b"donor", donor.key().as_ref()], bump)]
    pub donor_profile: Account<'info, DonorProfile>,
    #[account(init_if_needed, payer = donor, space = ContribSol::SPACE, seeds = [b"csol", campaign.key().as_ref(), donor.key().as_ref()], bump)]
    pub contrib_sol: Account<'info, ContribSol>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DonateToken<'info> {
    // CC-D: re-derive and verify the canonical campaign PDA.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(seeds = [b"mint", mint.key().as_ref()], bump = allowed_mint.bump)]
    pub allowed_mint: Account<'info, AllowedMint>,
    #[account(init_if_needed, payer = donor, space = CampaignAsset::SPACE, seeds = [b"casset", campaign.key().as_ref(), mint.key().as_ref()], bump)]
    pub campaign_asset: Account<'info, CampaignAsset>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = donor)]
    pub donor_ata: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = donor, associated_token::mint = mint, associated_token::authority = campaign)]
    pub escrow_ata: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = donor, space = DonorTokenStat::SPACE, seeds = [b"donor_token", donor.key().as_ref(), mint.key().as_ref()], bump)]
    pub donor_token_stat: Account<'info, DonorTokenStat>,
    #[account(init_if_needed, payer = donor, space = ContribTok::SPACE, seeds = [b"ctok", campaign.key().as_ref(), donor.key().as_ref(), mint.key().as_ref()], bump)]
    pub contrib_tok: Account<'info, ContribTok>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tranche: u64)]
pub struct RecordProof<'info> {
    // CC-D + has_one approver. `mut` so the monotonic counter / approved total can
    // be updated.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump, has_one = approver)]
    pub campaign: Account<'info, Campaign>,
    // finding 5: `init` (not init_if_needed) so each (campaign, tranche, NATIVE)
    // proof is a one-time, non-reopenable commitment.
    #[account(init, payer = approver, space = Approval::SPACE, seeds = [b"appr", campaign.key().as_ref(), tranche.to_le_bytes().as_ref(), NATIVE_ASSET.as_ref()], bump)]
    pub approval: Account<'info, Approval>,
    #[account(mut)]
    pub approver: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tranche: u64)]
pub struct RecordProofToken<'info> {
    #[account(seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump, has_one = approver)]
    pub campaign: Account<'info, Campaign>,
    // `mut`: per-asset approved total + monotonic counter live here.
    #[account(mut, seeds = [b"casset", campaign.key().as_ref(), mint.key().as_ref()], bump = campaign_asset.bump)]
    pub campaign_asset: Account<'info, CampaignAsset>,
    // finding 5: write-once approval.
    #[account(init, payer = approver, space = Approval::SPACE, seeds = [b"appr", campaign.key().as_ref(), tranche.to_le_bytes().as_ref(), mint.key().as_ref()], bump)]
    pub approval: Account<'info, Approval>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub approver: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tranche: u64)]
pub struct Release<'info> {
    // CC-D: canonical campaign re-derivation.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump, has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"appr", campaign.key().as_ref(), tranche.to_le_bytes().as_ref(), NATIVE_ASSET.as_ref()], bump = approval.bump)]
    pub approval: Account<'info, Approval>,
    /// CHECK: recipient wallet for released lamports.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(tranche: u64)]
pub struct ReleaseToken<'info> {
    // CC-D: canonical campaign re-derivation; the bump used for invoke_signed is
    // therefore verified, not trusted from account data (finding 7).
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump, has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"casset", campaign.key().as_ref(), mint.key().as_ref()], bump = campaign_asset.bump)]
    pub campaign_asset: Account<'info, CampaignAsset>,
    #[account(mut, seeds = [b"appr", campaign.key().as_ref(), tranche.to_le_bytes().as_ref(), mint.key().as_ref()], bump = approval.bump)]
    pub approval: Account<'info, Approval>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = campaign)]
    pub escrow_ata: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = recipient)]
    pub recipient_ata: Account<'info, TokenAccount>,
    /// CHECK: recipient wallet (ATA authority).
    pub recipient: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AuthorityOnly<'info> {
    // CC-D: canonical campaign re-derivation.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump, has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RefundSol<'info> {
    // CC-D: canonical campaign re-derivation.
    #[account(mut, seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut, seeds = [b"csol", campaign.key().as_ref(), donor.key().as_ref()], bump = contrib_sol.bump)]
    pub contrib_sol: Account<'info, ContribSol>,
    #[account(mut)]
    pub donor: Signer<'info>,
}

#[derive(Accounts)]
pub struct RefundToken<'info> {
    // CC-D: canonical campaign re-derivation (read-only; bump verified for the
    // invoke_signed seeds).
    #[account(seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(seeds = [b"casset", campaign.key().as_ref(), mint.key().as_ref()], bump = campaign_asset.bump)]
    pub campaign_asset: Account<'info, CampaignAsset>,
    #[account(mut, seeds = [b"ctok", campaign.key().as_ref(), donor.key().as_ref(), mint.key().as_ref()], bump = contrib_tok.bump)]
    pub contrib_tok: Account<'info, ContribTok>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = campaign)]
    pub escrow_ata: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = donor)]
    pub donor_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ---- events ----

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
}
#[event]
pub struct AdminChanged {
    pub admin: Pubkey,
}
#[event]
pub struct CampaignCreated {
    pub id: u64,
    pub requester: Pubkey,
    pub tier: u8,
}
#[event]
pub struct ApproverChanged {
    pub campaign: Pubkey,
    pub approver: Pubkey,
}
#[event]
pub struct TokenRegistered {
    pub mint: Pubkey,
    pub is_stable: bool,
}
#[event]
pub struct DonationSol {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
    pub anonymous: bool,
}
#[event]
pub struct DonationToken {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub anonymous: bool,
}
#[event]
pub struct ProofRecorded {
    pub campaign: Pubkey,
    pub asset: Pubkey,
    pub amount: u64,
}
#[event]
pub struct ReleasedSol {
    pub campaign: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}
#[event]
pub struct ReleasedToken {
    pub campaign: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}
#[event]
pub struct CampaignFrozen {
    pub campaign: Pubkey,
}
#[event]
pub struct RefundsEnabled {
    pub campaign: Pubkey,
}
#[event]
pub struct SolRefunded {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}
#[event]
pub struct TokenRefunded {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum AidError {
    #[msg("Caller is not the campaign authority")]
    NotAuthority,
    #[msg("Caller is not the campaign approver")]
    NotApprover,
    #[msg("Campaign is frozen")]
    Frozen,
    #[msg("No proof recorded for this tranche/asset")]
    NotApproved,
    #[msg("Release exceeds the approved amount")]
    ExceedsApproved,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Campaign is not in refund mode")]
    NotRefunding,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Approved/released amount exceeds funds raised")]
    ExceedsRaised,
    #[msg("Debit would drop the account below its rent-exempt minimum")]
    BelowRentFloor,
    #[msg("Approver must differ from the authority (separation of duties)")]
    ApproverIsAuthority,
    #[msg("Proof amount must be non-zero")]
    ZeroAmount,
    #[msg("Tranche index is out of the allowed monotonic range")]
    BadTranche,
    #[msg("Invalid release recipient (self-transfer or escrow)")]
    InvalidRecipient,
    #[msg("New admin must be a valid (non-default) key")]
    InvalidAdmin,
}

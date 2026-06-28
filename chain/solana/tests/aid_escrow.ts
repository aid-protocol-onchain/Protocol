import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AidEscrow } from "../target/types/aid_escrow";
import { assert } from "chai";

// Minimal happy-path test: initialize a campaign and donate to it.
// Run with: make solana-test (Anchor + local validator inside Docker, AD-10).
describe("aid_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AidEscrow as Program<AidEscrow>;

  const id = new anchor.BN(1);
  const idBuf = id.toArrayLike(Buffer, "le", 8);

  const [campaign] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), idBuf],
    program.programId
  );

  it("initializes a campaign", async () => {
    await program.methods
      .initializeCampaign(id, 2, new anchor.BN(100_000_000), 4000)
      .accounts({
        campaign,
        requester: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    const c = await program.account.campaign.fetch(campaign);
    assert.equal(c.tier, 2);
    assert.equal(c.firstTrancheBps, 4000);
    assert.ok(c.raised.eqn(0));
  });

  it("accepts a donation", async () => {
    const donor = provider.wallet.publicKey;
    const [donorProfile] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), donor.toBuffer()],
      program.programId
    );

    await program.methods
      .donate(new anchor.BN(2_000_000), false)
      .accounts({ campaign, donorProfile, donor })
      .rpc();

    const c = await program.account.campaign.fetch(campaign);
    assert.ok(c.raised.eqn(2_000_000));
  });
});

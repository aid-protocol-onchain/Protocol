// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/AidEscrowFactory.sol";
import "../src/CampaignEscrow.sol";

// --- mock tokens ---

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function approve(address, uint256) external returns (bool) {
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        balanceOf[f] -= a;
        balanceOf[t] += a;
        return true;
    }
}

contract MockNoReturnERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function transfer(address to, uint256 a) external {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
    }

    function transferFrom(address f, address t, uint256 a) external {
        balanceOf[f] -= a;
        balanceOf[t] += a;
    }
}

contract MockFalseERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract MockRevertERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("nope");
    }
}

contract MockFailOnTransfer {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

contract MockRevertOnTransfer {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert("no");
    }
}

contract RejectEther {}

/// @notice Force-sends its balance to a target via selfdestruct (bypasses the
///         missing receive()), used to drive forced-ETH / over-release scenarios.
contract ForceEth {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract AidTest is Test {
    AidEscrowFactory factory;
    CampaignEscrow esc;
    MockERC20 usdc;
    address authority = makeAddr("authority"); // releases
    address approver = makeAddr("approver"); // records proof
    address requester = makeAddr("requester");
    address donorA = makeAddr("donorA");
    address donorB = makeAddr("donorB");
    address payable recipient = payable(makeAddr("recipient"));
    bytes32 id = keccak256("ve-quake");
    bytes32 constant PH = keccak256("proof-bundle-0");
    address constant NATIVE = address(0);

    event AuthorityTransferStarted(address indexed previous, address indexed pending);
    event AuthorityChanged(address indexed previous, address indexed next);
    event ApproverTransferStarted(address indexed previous, address indexed pending);
    event ApproverChanged(address indexed previous, address indexed next);
    event TokenRegistered(address indexed token, bool stable);
    event CampaignCreated(bytes32 indexed id, address indexed escrow, address requester, uint8 tier);

    function setUp() public {
        factory = new AidEscrowFactory(authority, approver);
        usdc = new MockERC20();
        vm.startPrank(authority);
        factory.registerToken(address(usdc), true);
        address a = factory.createCampaign(id, requester, 2);
        vm.stopPrank();
        esc = CampaignEscrow(a);
    }

    /// @dev complete a two-step authority transfer to `next`.
    function _transferAuthority(address next) internal {
        vm.prank(authority);
        factory.setAuthority(next);
        vm.prank(next);
        factory.acceptAuthority();
    }

    /// @dev complete a two-step approver transfer to `next`.
    function _transferApprover(address next) internal {
        vm.prank(authority);
        factory.setApprover(next);
        vm.prank(next);
        factory.acceptApprover();
    }

    function _fundNative(address who, uint256 amount) internal {
        vm.deal(who, amount);
        vm.prank(who);
        esc.donateNative{value: amount}(false);
    }

    function _fundToken(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        esc.donateToken(address(usdc), amount, false);
    }

    function _approveNative(uint256 tranche, uint256 amount) internal {
        vm.prank(approver);
        esc.recordProof(tranche, PH, NATIVE, amount);
    }

    function _approveToken(address token, uint256 tranche, uint256 amount) internal {
        vm.prank(approver);
        esc.recordProof(tranche, PH, token, amount);
    }

    // ============ factory ============

    function testFactoryRolesAreDistinct() public view {
        // approver and authority are distinct by construction (CC-D)
        assertEq(factory.authority(), authority);
        assertEq(factory.approver(), approver);
    }

    function testFactoryRejectsEqualRoles() public {
        // constructing with approver == authority reverts (CC-D / finding 5)
        vm.expectRevert(AidEscrowFactory.RolesMustDiffer.selector);
        new AidEscrowFactory(authority, authority);
    }

    function testFactoryZeroApproverReverts() public {
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        new AidEscrowFactory(authority, address(0));
    }

    function testFactoryDeploysIsolatedEscrow() public view {
        assertEq(factory.campaignOf(id), address(esc));
        assertEq(factory.campaignCount(), 1);
        assertEq(esc.factory(), address(factory));
        assertEq(esc.requester(), requester);
        assertEq(esc.tier(), 2);
    }

    function testFactoryZeroAuthorityReverts() public {
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        new AidEscrowFactory(address(0), approver);
    }

    function testCreateDuplicateReverts() public {
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.AlreadyExists.selector);
        factory.createCampaign(id, requester, 2);
    }

    function testCreateOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotAuthority.selector);
        factory.createCampaign(keccak256("x"), requester, 1);
    }

    function testRegisterTokenEmitsAndSets() public {
        MockERC20 t = new MockERC20();
        vm.expectEmit(true, false, false, true);
        emit TokenRegistered(address(t), true);
        vm.prank(authority);
        factory.registerToken(address(t), true);
        assertTrue(factory.isAllowed(address(t)));
        assertTrue(factory.isStableToken(address(t)));
    }

    function testRegisterTokenZeroReverts() public {
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        factory.registerToken(address(0), true);
    }

    function testRegisterOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotAuthority.selector);
        factory.registerToken(address(usdc), true);
    }

    function testUnregisterToken() public {
        vm.prank(authority);
        factory.unregisterToken(address(usdc));
        assertFalse(factory.isAllowed(address(usdc)));
    }

    function testUnregisterOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotAuthority.selector);
        factory.unregisterToken(address(usdc));
    }

    // ---- two-step authority transfer (CC-E / finding 6) ----

    function testTwoStepAuthorityTransfer() public {
        address next = makeAddr("next");
        // propose: emits TransferStarted, does NOT change authority
        vm.expectEmit(true, true, false, false);
        emit AuthorityTransferStarted(authority, next);
        vm.prank(authority);
        factory.setAuthority(next);
        assertEq(factory.authority(), authority); // unchanged on propose
        assertEq(factory.pendingAuthority(), next);
        // accept from the new key: now it moves
        vm.expectEmit(true, true, false, false);
        emit AuthorityChanged(authority, next);
        vm.prank(next);
        factory.acceptAuthority();
        assertEq(factory.authority(), next);
        assertEq(factory.pendingAuthority(), address(0));
    }

    function testAcceptAuthorityOnlyPending() public {
        address next = makeAddr("next");
        vm.prank(authority);
        factory.setAuthority(next);
        vm.prank(donorA); // not the pending authority
        vm.expectRevert(AidEscrowFactory.NotPending.selector);
        factory.acceptAuthority();
        assertEq(factory.authority(), authority);
    }

    function testBadPendingNeverBricksLiveAuthority() public {
        // a mistyped pending address can be overwritten; the live role never moves
        address bad = makeAddr("bad");
        address good = makeAddr("good");
        vm.prank(authority);
        factory.setAuthority(bad);
        vm.prank(authority);
        factory.setAuthority(good); // overwrite the typo
        // bad can no longer accept
        vm.prank(bad);
        vm.expectRevert(AidEscrowFactory.NotPending.selector);
        factory.acceptAuthority();
        // good takes the role; the live authority was never bricked
        vm.prank(good);
        factory.acceptAuthority();
        assertEq(factory.authority(), good);
    }

    function testSetAuthorityZeroReverts() public {
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        factory.setAuthority(address(0));
    }

    function testSetAuthorityOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotAuthority.selector);
        factory.setAuthority(donorA);
    }

    function testTwoStepRejectsRoleCollapseAuthority() public {
        // proposing the current approver as the new authority must fail at accept
        vm.prank(authority);
        factory.setAuthority(approver);
        vm.prank(approver);
        vm.expectRevert(AidEscrowFactory.RolesMustDiffer.selector);
        factory.acceptAuthority();
        assertEq(factory.authority(), authority);
    }

    // ---- two-step approver transfer (CC-E / finding 6) ----

    function testTwoStepApproverTransfer() public {
        address next = makeAddr("nextApprover");
        vm.expectEmit(true, true, false, false);
        emit ApproverTransferStarted(approver, next);
        vm.prank(authority);
        factory.setApprover(next);
        assertEq(factory.approver(), approver); // unchanged on propose
        assertEq(factory.pendingApprover(), next);
        vm.expectEmit(true, true, false, false);
        emit ApproverChanged(approver, next);
        vm.prank(next);
        factory.acceptApprover();
        assertEq(factory.approver(), next);
        assertEq(factory.pendingApprover(), address(0));
    }

    function testAcceptApproverOnlyPending() public {
        address next = makeAddr("nextApprover");
        vm.prank(authority);
        factory.setApprover(next);
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotPending.selector);
        factory.acceptApprover();
    }

    function testSetApproverZeroReverts() public {
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        factory.setApprover(address(0));
    }

    function testSetApproverOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(AidEscrowFactory.NotAuthority.selector);
        factory.setApprover(donorA);
    }

    function testTwoStepRejectsRoleCollapseApprover() public {
        // proposing the current authority as the new approver must fail at accept
        vm.prank(authority);
        factory.setApprover(authority);
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.RolesMustDiffer.selector);
        factory.acceptApprover();
        assertEq(factory.approver(), approver);
    }

    function testUnregisterTokenZeroReverts() public {
        vm.prank(authority);
        vm.expectRevert(AidEscrowFactory.ZeroAddress.selector);
        factory.unregisterToken(address(0));
    }

    // ============ separation of duties ============

    function testApproverRecordsAuthorityCannot() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 1 ether); // approver succeeds (in helper)
        assertEq(esc.proofHash(0), PH);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.NotApprover.selector);
        esc.recordProof(1, PH, NATIVE, 1 ether);
    }

    function testRecordProofDonorCannot() public {
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotApprover.selector);
        esc.recordProof(0, PH, NATIVE, 1 ether);
    }

    function testRecordProofZeroHashReverts() public {
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.NotApproved.selector);
        esc.recordProof(0, bytes32(0), NATIVE, 1 ether);
    }

    function testAuthorityReleasesApproverCannot() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.NotAuthority.selector);
        esc.releaseNative(0, 1 ether, recipient);
        vm.prank(authority);
        esc.releaseNative(0, 1 ether, recipient);
        assertEq(recipient.balance, 1 ether);
    }

    // ============ native release ============

    function testDonateNativeAccrues() public {
        _fundNative(donorA, 5 ether);
        assertEq(esc.raisedNative(), 5 ether);
        assertEq(esc.donorNative(donorA), 5 ether);
    }

    function testDonateNativeFrozenReverts() public {
        vm.prank(authority);
        esc.freeze();
        vm.deal(donorA, 1 ether);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.FrozenCampaign.selector);
        esc.donateNative{value: 1 ether}(false);
    }

    function testReleaseNativeNeedsProof() public {
        _fundNative(donorA, 10 ether);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.NotApproved.selector);
        esc.releaseNative(0, 1 ether, recipient);
    }

    function testReleaseNativeBoundedByApproved() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ExceedsApproved.selector);
        esc.releaseNative(0, 5 ether, recipient);
        // within approved, cumulative
        vm.startPrank(authority);
        esc.releaseNative(0, 3 ether, recipient);
        esc.releaseNative(0, 1 ether, recipient);
        vm.expectRevert(CampaignEscrow.ExceedsApproved.selector);
        esc.releaseNative(0, 1 ether, recipient); // now exceeds the 4 approved
        vm.stopPrank();
        assertEq(recipient.balance, 4 ether);
        assertEq(esc.releasedNative(), 4 ether);
    }

    function testReleaseNativeDoesNotGrowWithDonations() public {
        // the cap-growth bypass is gone: approval is fixed, later donations do not raise it
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        esc.releaseNative(0, 4 ether, recipient);
        _fundNative(donorB, 10 ether); // raised now 20, but approval stays 4
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ExceedsApproved.selector);
        esc.releaseNative(0, 1 ether, recipient);
    }

    function testReleaseNativeZeroRecipient() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ZeroAddress.selector);
        esc.releaseNative(0, 1 ether, payable(address(0)));
    }

    function testReleaseNativeFrozen() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.startPrank(authority);
        esc.freeze();
        vm.expectRevert(CampaignEscrow.FrozenCampaign.selector);
        esc.releaseNative(0, 1 ether, recipient);
        vm.stopPrank();
    }

    function testReleaseNativeTransferFailed() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        address payable bad = payable(address(new RejectEther()));
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.releaseNative(0, 1 ether, bad);
    }

    // ============ token release ============

    function testDonateTokenAccrues() public {
        _fundToken(donorA, 1000e6);
        assertEq(esc.raisedToken(address(usdc)), 1000e6);
        assertEq(esc.donorToken(donorA, address(usdc)), 1000e6);
    }

    function testDonateNoReturnToken() public {
        MockNoReturnERC20 usdt = new MockNoReturnERC20();
        vm.prank(authority);
        factory.registerToken(address(usdt), true);
        usdt.mint(donorA, 500e6);
        vm.prank(donorA);
        esc.donateToken(address(usdt), 500e6, false);
        assertEq(esc.raisedToken(address(usdt)), 500e6);
    }

    function testDonateTokenNotAllowed() public {
        MockERC20 other = new MockERC20();
        other.mint(donorA, 100e6);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.TokenNotAllowed.selector);
        esc.donateToken(address(other), 100e6, false);
    }

    function testDonateTokenFrozenReverts() public {
        vm.prank(authority);
        esc.freeze();
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.FrozenCampaign.selector);
        esc.donateToken(address(usdc), 1, false);
    }

    function testDonateTokenFalseReturn() public {
        MockFalseERC20 bad = new MockFalseERC20();
        vm.prank(authority);
        factory.registerToken(address(bad), true);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.donateToken(address(bad), 1, false);
    }

    function testDonateTokenReverting() public {
        MockRevertERC20 bad = new MockRevertERC20();
        vm.prank(authority);
        factory.registerToken(address(bad), true);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.donateToken(address(bad), 1, false);
    }

    function testReleaseTokenNeedsProof() public {
        _fundToken(donorA, 1000e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.NotApproved.selector);
        esc.releaseToken(address(usdc), 0, 1e6, recipient);
    }

    function testReleaseTokenBoundedByApproved() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 400e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ExceedsApproved.selector);
        esc.releaseToken(address(usdc), 0, 500e6, recipient);
        vm.prank(authority);
        esc.releaseToken(address(usdc), 0, 400e6, recipient);
        assertEq(usdc.balanceOf(recipient), 400e6);
    }

    function testReleaseTokenZeroRecipient() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 400e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ZeroAddress.selector);
        esc.releaseToken(address(usdc), 0, 1e6, address(0));
    }

    function testReleaseTokenFrozen() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 400e6);
        vm.startPrank(authority);
        esc.freeze();
        vm.expectRevert(CampaignEscrow.FrozenCampaign.selector);
        esc.releaseToken(address(usdc), 0, 1e6, recipient);
        vm.stopPrank();
    }

    function testReleaseTokenTransferReturnsFalse() public {
        MockFailOnTransfer bad = new MockFailOnTransfer();
        vm.prank(authority);
        factory.registerToken(address(bad), false);
        vm.prank(donorA);
        esc.donateToken(address(bad), 1000e6, false);
        _approveToken(address(bad), 0, 400e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.releaseToken(address(bad), 0, 100e6, recipient);
    }

    function testReleaseTokenTransferReverts() public {
        MockRevertOnTransfer bad = new MockRevertOnTransfer();
        vm.prank(authority);
        factory.registerToken(address(bad), false);
        vm.prank(donorA);
        esc.donateToken(address(bad), 1000e6, false);
        _approveToken(address(bad), 0, 400e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.releaseToken(address(bad), 0, 100e6, recipient);
    }

    function testReleaseTokenOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotAuthority.selector);
        esc.releaseToken(address(usdc), 0, 1, recipient);
    }

    function testReleaseNativeOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotAuthority.selector);
        esc.releaseNative(0, 1, recipient);
    }

    function testFreezeOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotAuthority.selector);
        esc.freeze();
    }

    function testCreateZeroRequesterReverts() public {
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.ZeroAddress.selector);
        factory.createCampaign(keccak256("zr"), address(0), 1);
    }

    function testReleaseNoReturnToken() public {
        MockNoReturnERC20 usdt = new MockNoReturnERC20();
        vm.prank(authority);
        factory.registerToken(address(usdt), true);
        usdt.mint(donorA, 1000e6);
        vm.prank(donorA);
        esc.donateToken(address(usdt), 1000e6, false);
        _approveToken(address(usdt), 0, 400e6);
        vm.prank(authority);
        esc.releaseToken(address(usdt), 0, 400e6, recipient);
        assertEq(usdt.balanceOf(recipient), 400e6);
    }

    // ============ refunds ============

    function testEnableRefundsOnlyAuthority() public {
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotAuthority.selector);
        esc.enableRefunds();
    }

    function testRefundBeforeEnableReverts() public {
        _fundNative(donorA, 1 ether);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotRefunding.selector);
        esc.refundNative();
    }

    function testFullRefundWhenNothingReleased() public {
        _fundNative(donorA, 5 ether);
        vm.prank(authority);
        esc.enableRefunds();
        uint256 before = donorA.balance;
        vm.prank(donorA);
        esc.refundNative();
        assertEq(donorA.balance - before, 5 ether);
    }

    function testProRataRefundAfterRelease() public {
        _fundNative(donorA, 10 ether);
        _fundNative(donorB, 10 ether); // raised 20
        _approveNative(0, 8 ether);
        vm.prank(authority);
        esc.releaseNative(0, 8 ether, recipient); // 8 out, remaining 12
        vm.prank(authority);
        esc.enableRefunds();
        uint256 a0 = donorA.balance;
        vm.prank(donorA);
        esc.refundNative();
        assertEq(donorA.balance - a0, 6 ether); // 10 * 12/20
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        esc.refundNative();
        uint256 b0 = donorB.balance;
        vm.prank(donorB);
        esc.refundNative();
        assertEq(donorB.balance - b0, 6 ether);
    }

    function testRefundNothingForNonDonor() public {
        vm.prank(authority);
        esc.enableRefunds();
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        esc.refundNative();
    }

    function testTokenRefund() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 400e6);
        vm.prank(authority);
        esc.releaseToken(address(usdc), 0, 400e6, recipient);
        vm.prank(authority);
        esc.enableRefunds();
        vm.prank(donorA);
        esc.refundToken(address(usdc));
        assertEq(usdc.balanceOf(donorA), 600e6);
    }

    function testTokenRefundBeforeEnableReverts() public {
        _fundToken(donorA, 1000e6);
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NotRefunding.selector);
        esc.refundToken(address(usdc));
    }

    function testTokenRefundNothingForNonDonor() public {
        vm.prank(authority);
        esc.enableRefunds();
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        esc.refundToken(address(usdc));
    }

    function testTokenRefundTransferFailed() public {
        MockFailOnTransfer bad = new MockFailOnTransfer();
        vm.prank(authority);
        factory.registerToken(address(bad), false);
        vm.prank(donorA);
        esc.donateToken(address(bad), 1000e6, false);
        vm.prank(authority);
        esc.enableRefunds();
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.refundToken(address(bad));
    }

    // ============ finding 1 / CC-A: release bounded by raised ============

    function testReleaseNativeCannotExceedRaised() public {
        _fundNative(donorA, 4 ether); // raised 4
        // approve up to raised across one tranche
        _approveNative(0, 4 ether);
        // release the full raised amount succeeds
        vm.startPrank(authority);
        esc.releaseNative(0, 4 ether, recipient);
        assertEq(esc.releasedNative(), 4 ether);
        vm.stopPrank();
        // a further proof cannot even be approved beyond raised (record-time ceiling)
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.recordProof(1, PH, NATIVE, 1);
    }

    function testReleaseNativeExceedsRaisedReverts() public {
        // Defense-in-depth: even if the approved ceiling were somehow corrupted
        // above raised, the release-time funds-on-hand cap (CC-A) still bites. We
        // corrupt approved[0][NATIVE] directly to simulate a broken/legacy ceiling.
        _fundNative(donorA, 4 ether); // raised 4
        _approveNative(0, 4 ether); // legitimate approved == raised
        // approved mapping: slot 10, key tranche=0 then asset=NATIVE
        bytes32 inner = keccak256(abi.encode(uint256(0), uint256(10)));
        bytes32 slot = keccak256(abi.encode(uint256(uint160(NATIVE)), inner));
        vm.store(address(esc), slot, bytes32(uint256(100 ether))); // headroom now huge
        assertEq(esc.approved(0, NATIVE), 100 ether);
        vm.startPrank(authority);
        esc.releaseNative(0, 4 ether, recipient); // releases up to raised
        // approved headroom remains (96 ether), but releasedNative 4 == raised 4,
        // so the next wei is capped by the funds-on-hand bound, not the ceiling.
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.releaseNative(0, 1, recipient);
        vm.stopPrank();
    }

    function testReleaseTokenCannotExceedRaised() public {
        _fundToken(donorA, 1000e6); // raised 1000
        _approveToken(address(usdc), 0, 1000e6);
        vm.startPrank(authority);
        esc.releaseToken(address(usdc), 0, 1000e6, recipient);
        assertEq(esc.releasedToken(address(usdc)), 1000e6);
        vm.stopPrank();
        // cannot approve beyond raised on a fresh tranche
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.recordProof(1, PH, address(usdc), 1);
    }

    function testRecordProofTotalApprovedCannotExceedRaised() public {
        _fundNative(donorA, 10 ether); // raised 10
        _approveNative(0, 6 ether); // total approved 6 <= 10 OK
        // second tranche pushes cumulative approved past raised
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.recordProof(1, PH, NATIVE, 5 ether); // 6 + 5 = 11 > 10
    }

    function testRecordProofTokenTotalApprovedCannotExceedRaised() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 600e6);
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.recordProof(1, PH, address(usdc), 500e6); // 600 + 500 > 1000
    }

    function testOverReleaseDoesNotBrickRefunds() public {
        // after releasing the maximum (== raised), refunds still compute (return 0)
        _fundNative(donorA, 4 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        esc.releaseNative(0, 4 ether, recipient);
        vm.prank(authority);
        esc.enableRefunds();
        // remaining is 0; donor is owed nothing but the call does not panic-revert
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        esc.refundNative();
    }

    // ============ finding 9 / CC-A: forced ETH does not enable over-release =====

    function testForcedEthDoesNotEnableOverRelease() public {
        _fundNative(donorA, 4 ether); // raised 4
        // force 10 ether of un-raised ETH into the escrow
        new ForceEth{value: 10 ether}(payable(address(esc)));
        assertEq(address(esc).balance, 14 ether);
        // approver (faulty) cannot approve beyond raised (record-time ceiling)
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.recordProof(0, PH, NATIVE, 5 ether);
        // Even if the ceiling were corrupted huge, native release is capped at
        // raised regardless of the inflated 14 ether raw balance (forced ETH).
        _approveNative(0, 4 ether);
        bytes32 inner = keccak256(abi.encode(uint256(0), uint256(10)));
        bytes32 slot = keccak256(abi.encode(uint256(uint160(NATIVE)), inner));
        vm.store(address(esc), slot, bytes32(uint256(100 ether)));
        vm.startPrank(authority);
        esc.releaseNative(0, 4 ether, recipient); // up to raised only
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.releaseNative(0, 1, recipient); // forced ETH does not lift the cap
        vm.stopPrank();
        assertEq(esc.releasedNative(), 4 ether);
    }

    // ============ finding 2 / CC-B: saturating refund math ============

    function testRefundableSaturatesWhenOverReleased() public {
        // drive releasedNative > raisedNative by manipulating the storage counter,
        // proving _refundable saturates instead of underflow-reverting.
        _fundNative(donorA, 10 ether);
        // Corrupt the releasedNative counter above raisedNative to prove the
        // saturating math (CC-B) cannot underflow-revert. Storage layout (immutables
        // are not in storage): slot 0 packs frozen+refunding, slot 1 raisedNative,
        // slot 2 releasedNative (confirmed via `forge inspect storage-layout`).
        vm.store(address(esc), bytes32(uint256(2)), bytes32(uint256(11 ether)));
        assertEq(esc.releasedNative(), 11 ether);
        assertGt(esc.releasedNative(), esc.raisedNative());
        vm.prank(authority);
        esc.enableRefunds();
        // _refundable returns 0 (saturated) -> NothingToRefund, NOT an arithmetic panic
        vm.prank(donorA);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        esc.refundNative();
    }

    function testProRataUnchangedNormalCase() public {
        // regression: the normal released <= raised pro-rata math is unchanged
        _fundNative(donorA, 10 ether);
        _fundNative(donorB, 10 ether); // raised 20
        _approveNative(0, 8 ether);
        vm.prank(authority);
        esc.releaseNative(0, 8 ether, recipient); // remaining 12
        vm.prank(authority);
        esc.enableRefunds();
        uint256 a0 = donorA.balance;
        vm.prank(donorA);
        esc.refundNative();
        assertEq(donorA.balance - a0, 6 ether); // 10 * 12/20
    }

    // ============ finding 3 / CC-C: write-once monotonic proof ============

    function testRecordProofIsWriteOnce() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.AlreadyApproved.selector);
        esc.recordProof(0, PH, NATIVE, 1 ether); // same (tranche, asset) re-record
    }

    function testCannotReopenCeilingAfterRelease() public {
        // the finding-3 exploit: release the full approved, then try to reopen it
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        esc.releaseNative(0, 4 ether, recipient);
        // re-recording the same tranche to reopen headroom must revert
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.AlreadyApproved.selector);
        esc.recordProof(0, keccak256("new"), NATIVE, 4 ether);
    }

    function testRecordProofRejectsZeroAmount() public {
        _fundNative(donorA, 10 ether);
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.ZeroAmount.selector);
        esc.recordProof(0, PH, NATIVE, 0);
    }

    function testTrancheIndexMustBeMonotonic() public {
        _fundNative(donorA, 10 ether);
        // tranche 0 is the only valid next index; a far-future tranche reverts
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.BadTranche.selector);
        esc.recordProof(5, PH, NATIVE, 1 ether);
    }

    function testTrancheCounterAdvancesSequentially() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 2 ether);
        assertEq(esc.nextTrancheNative(), 1);
        _approveNative(1, 2 ether); // next valid index
        assertEq(esc.nextTrancheNative(), 2);
        // tranche 1 again is write-once
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.AlreadyApproved.selector);
        esc.recordProof(1, PH, NATIVE, 1 ether);
    }

    function testTokenTrancheIndexMustBeMonotonic() public {
        _fundToken(donorA, 1000e6);
        vm.prank(approver);
        vm.expectRevert(CampaignEscrow.BadTranche.selector);
        esc.recordProof(5, PH, address(usdc), 100e6);
    }

    function testReleaseTokenExceedsRaisedReverts() public {
        // defense-in-depth: a corrupted token approved ceiling is still capped at
        // raisedToken by the release-time funds-on-hand bound (CC-A).
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 1000e6);
        // approved mapping slot 10: key tranche=0 then asset=usdc
        bytes32 inner = keccak256(abi.encode(uint256(0), uint256(10)));
        bytes32 slot = keccak256(abi.encode(uint256(uint160(address(usdc))), inner));
        vm.store(address(esc), slot, bytes32(uint256(5000e6)));
        vm.startPrank(authority);
        esc.releaseToken(address(usdc), 0, 1000e6, recipient); // up to raised
        vm.expectRevert(CampaignEscrow.ExceedsRaised.selector);
        esc.releaseToken(address(usdc), 0, 1, recipient);
        vm.stopPrank();
    }

    function testTokenTrancheMonotonicIndependentOfNative() public {
        _fundNative(donorA, 10 ether);
        _fundToken(donorA, 1000e6);
        _approveNative(0, 2 ether); // advances native counter only
        // token tranche 0 is still valid (per-asset counter)
        _approveToken(address(usdc), 0, 100e6);
        assertEq(esc.nextTrancheToken(address(usdc)), 1);
    }

    // ============ finding 7: self-/escrow-directed release rejected ============

    function testReleaseTokenRejectsSelfTransfer() public {
        _fundToken(donorA, 1000e6);
        _approveToken(address(usdc), 0, 400e6);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.InvalidRecipient.selector);
        esc.releaseToken(address(usdc), 0, 100e6, address(esc));
        // counters did not advance
        assertEq(esc.releasedToken(address(usdc)), 0);
        assertEq(esc.releasedForTranche(0, address(usdc)), 0);
    }

    function testRefundNativeTransferFailed() public {
        // a donor contract that rejects ETH makes its own refund send fail
        RejectEther badDonor = new RejectEther();
        vm.deal(address(badDonor), 5 ether);
        vm.prank(address(badDonor));
        esc.donateNative{value: 5 ether}(false);
        vm.prank(authority);
        esc.enableRefunds();
        vm.prank(address(badDonor));
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        esc.refundNative();
    }

    function testReleaseNativeRejectsSelfTransfer() public {
        _fundNative(donorA, 10 ether);
        _approveNative(0, 4 ether);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.InvalidRecipient.selector);
        esc.releaseNative(0, 1 ether, payable(address(esc)));
        assertEq(esc.releasedNative(), 0);
    }
}

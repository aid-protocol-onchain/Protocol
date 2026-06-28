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

    event AuthorityChanged(address indexed previous, address indexed next);
    event ApproverChanged(address indexed previous, address indexed next);
    event TokenRegistered(address indexed token, bool stable);
    event CampaignCreated(bytes32 indexed id, address indexed escrow, address requester, uint8 tier);

    function setUp() public {
        factory = new AidEscrowFactory(authority);
        usdc = new MockERC20();
        vm.startPrank(authority);
        factory.registerToken(address(usdc), true);
        factory.setApprover(approver);
        address a = factory.createCampaign(id, requester, 2);
        vm.stopPrank();
        esc = CampaignEscrow(a);
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

    function testFactoryDefaultsApproverToAuthority() public view {
        // a fresh factory defaults approver to authority until set
        assertEq(factory.authority(), authority);
        assertEq(factory.approver(), approver); // setUp changed it
    }

    function testFreshFactoryApproverEqualsAuthority() public {
        AidEscrowFactory f = new AidEscrowFactory(authority);
        assertEq(f.approver(), authority);
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
        new AidEscrowFactory(address(0));
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

    function testSetAuthority() public {
        address next = makeAddr("next");
        vm.expectEmit(true, true, false, false);
        emit AuthorityChanged(authority, next);
        vm.prank(authority);
        factory.setAuthority(next);
        assertEq(factory.authority(), next);
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

    function testSetApprover() public {
        address next = makeAddr("nextApprover");
        vm.expectEmit(true, true, false, false);
        emit ApproverChanged(approver, next);
        vm.prank(authority);
        factory.setApprover(next);
        assertEq(factory.approver(), next);
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

    // ============ separation of duties ============

    function testApproverRecordsAuthorityCannot() public {
        _approveNative(0, 1 ether); // approver succeeds (in helper)
        assertEq(esc.proofHash(0), PH);
        vm.prank(authority);
        vm.expectRevert(CampaignEscrow.NotApprover.selector);
        esc.recordProof(0, PH, NATIVE, 1 ether);
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
}

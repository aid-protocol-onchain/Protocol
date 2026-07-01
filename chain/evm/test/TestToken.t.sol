// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/TestToken.sol";

/// @notice Coverage for the testnet-only faucet token. TestToken is not a
///         protocol-trust component (open `mint`), but the suite exercises it so
///         the total coverage bar reflects real behavior rather than an untested
///         gap. Do not deploy TestToken to mainnet.
contract TestTokenTest is Test {
    TestToken token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        token = new TestToken("Test USDC", "USDC", 6);
    }

    function testMetadata() public view {
        assertEq(token.name(), "Test USDC");
        assertEq(token.symbol(), "USDC");
        assertEq(token.decimals(), 6);
        assertEq(token.totalSupply(), 0);
    }

    function testMintFaucet() public {
        token.mint(alice, 1000e6);
        assertEq(token.balanceOf(alice), 1000e6);
        assertEq(token.totalSupply(), 1000e6);
    }

    function testTransfer() public {
        token.mint(alice, 1000e6);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 400e6));
        assertEq(token.balanceOf(alice), 600e6);
        assertEq(token.balanceOf(bob), 400e6);
    }

    function testTransferInsufficientBalanceReverts() public {
        token.mint(alice, 10e6);
        vm.prank(alice);
        vm.expectRevert(bytes("balance"));
        token.transfer(bob, 11e6);
    }

    function testApproveAndTransferFrom() public {
        token.mint(alice, 1000e6);
        vm.prank(alice);
        assertTrue(token.approve(bob, 500e6));
        assertEq(token.allowance(alice, bob), 500e6);
        vm.prank(bob);
        assertTrue(token.transferFrom(alice, carol, 300e6));
        assertEq(token.balanceOf(carol), 300e6);
        assertEq(token.allowance(alice, bob), 200e6); // allowance decremented
    }

    function testTransferFromInfiniteAllowanceNotDecremented() public {
        token.mint(alice, 1000e6);
        vm.prank(alice);
        token.approve(bob, type(uint256).max);
        vm.prank(bob);
        token.transferFrom(alice, carol, 300e6);
        assertEq(token.allowance(alice, bob), type(uint256).max); // unchanged
    }

    function testTransferFromInsufficientAllowanceReverts() public {
        token.mint(alice, 1000e6);
        vm.prank(alice);
        token.approve(bob, 100e6);
        vm.prank(bob);
        vm.expectRevert(bytes("allowance"));
        token.transferFrom(alice, carol, 101e6);
    }
}

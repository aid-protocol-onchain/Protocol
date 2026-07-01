// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/AidEscrowFactory.sol";

/// @notice Deploys the AidEscrowFactory to an EVM network (Ethereum mainnet or Base, NFR6).
///         The authority and approver must be DISTINCT Safe multisigs for that network
///         (FR12, AD-3 separation of duties). Campaigns are then created through the
///         factory, each as its own isolated CampaignEscrow.
/// Usage: forge script script/Deploy.s.sol --rpc-url base --broadcast
contract Deploy is Script {
    function run() external {
        address authority = vm.envAddress("AID_AUTHORITY_SAFE");
        address approver = vm.envAddress("AID_APPROVER_SAFE");
        vm.startBroadcast();
        AidEscrowFactory factory = new AidEscrowFactory(authority, approver);
        vm.stopBroadcast();
        console2.log("AidEscrowFactory deployed at", address(factory));
        console2.log("authority (Safe)", authority);
        console2.log("approver (Safe)", approver);
    }
}

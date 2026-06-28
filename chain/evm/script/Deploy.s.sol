// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/AidEscrowFactory.sol";

/// @notice Deploys the AidEscrowFactory to an EVM network (Ethereum mainnet or Base, NFR6).
///         The authority must be the Safe multisig for that network (FR12). Campaigns are
///         then created through the factory, each as its own isolated CampaignEscrow.
/// Usage: forge script script/Deploy.s.sol --rpc-url base --broadcast
contract Deploy is Script {
    function run() external {
        address authority = vm.envAddress("AID_AUTHORITY_SAFE");
        vm.startBroadcast();
        AidEscrowFactory factory = new AidEscrowFactory(authority);
        vm.stopBroadcast();
        console2.log("AidEscrowFactory deployed at", address(factory));
        console2.log("authority (Safe)", authority);
    }
}

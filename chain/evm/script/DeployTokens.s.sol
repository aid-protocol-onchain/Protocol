// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/TestToken.sol";
import "../src/AidEscrowFactory.sol";

/// @notice Deploys test USDC + USDT (6 decimals) and registers them on the factory
///         allowlist. Testnet only. Usage:
///   FACTORY=0x... forge script script/DeployTokens.s.sol --rpc-url <rpc> --broadcast --private-key <pk>
contract DeployTokens is Script {
    function run() external {
        AidEscrowFactory factory = AidEscrowFactory(vm.envAddress("FACTORY"));
        vm.startBroadcast();
        TestToken usdc = new TestToken("Test USDC", "USDC", 6);
        TestToken usdt = new TestToken("Test USDT", "USDT", 6);
        factory.registerToken(address(usdc), true);
        factory.registerToken(address(usdt), true);
        vm.stopBroadcast();
        console2.log("USDC", address(usdc));
        console2.log("USDT", address(usdt));
    }
}

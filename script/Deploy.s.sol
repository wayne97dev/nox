// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

import {NoxGenesis} from "../src/NoxGenesis.sol";
import {NoxHook} from "../src/NoxHook.sol";
import {NoxToken} from "../src/NoxToken.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";
import {StealthRegistry} from "../src/stealth/StealthRegistry.sol";
import {StealthAnnouncer} from "../src/stealth/StealthAnnouncer.sol";
import {NoxStealthSender} from "../src/stealth/NoxStealthSender.sol";
import {StealthMining} from "../src/stealth/StealthMining.sol";

/// @notice Deploy NOX Genesis + Hook on Base.
///
/// Required env vars:
///   POOL_MANAGER    — address of the Uniswap v4 PoolManager on the target chain
///   TREASURY        — address that receives the 1% hook fee
///   CONTROLLER      — address that can force `seedPool` if cap not reached after window
///   GENESIS_WINDOW  — seconds the genesis sale is open (e.g. 604800 for 7 days)
///   DEPLOYER_PK     — private key for the deployer (also the CREATE2 sender for the hook)
contract Deploy is Script {
    uint160 internal constant HOOK_FLAGS = uint160(Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);

    function run() external {
        address poolManager = vm.envAddress("POOL_MANAGER");
        address treasury = vm.envAddress("TREASURY");
        address controller = vm.envAddress("CONTROLLER");
        uint256 genesisWindow = vm.envUint("GENESIS_WINDOW");
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerPk);

        bytes memory hookCreationCode = type(NoxHook).creationCode;
        bytes memory hookArgs = abi.encode(poolManager, treasury);
        (address expectedHook, bytes32 salt) = HookMiner.find(deployer, HOOK_FLAGS, hookCreationCode, hookArgs);

        console.log("Deployer:           ", deployer);
        console.log("PoolManager:        ", poolManager);
        console.log("Treasury:           ", treasury);
        console.log("Controller:         ", controller);
        console.log("Genesis window (s): ", genesisWindow);
        console.log("Expected hook addr: ", expectedHook);
        console.logBytes32(salt);

        vm.startBroadcast(deployerPk);

        NoxHook hook = new NoxHook{salt: salt}(IPoolManager(poolManager), treasury);
        require(address(hook) == expectedHook, "hook addr mismatch");

        NoxGenesis genesis = new NoxGenesis(IPoolManager(poolManager), IHooks(address(hook)), controller, genesisWindow);
        NoxToken token = genesis.token();
        StealthMining mining = genesis.mining();

        StealthRegistry registry = new StealthRegistry();
        StealthAnnouncer announcer = new StealthAnnouncer();
        NoxStealthSender stealthSender = new NoxStealthSender(token, announcer, mining);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment complete ===");
        console.log("NoxHook:           ", address(hook));
        console.log("NoxGenesis:        ", address(genesis));
        console.log("NoxToken:          ", address(token));
        console.log("StealthMining:     ", address(mining));
        console.log("StealthRegistry:   ", address(registry));
        console.log("StealthAnnouncer:  ", address(announcer));
        console.log("NoxStealthSender:  ", address(stealthSender));
        console.log("");
        console.log("NEXT: controller must call mining.setStealthSender(", address(stealthSender), ")");
        console.log("");
        console.log("Buyers call: genesis.mintGenesis{value: units * GENESIS_PRICE}(units)");
        console.log("Seed: anyone can call genesis.seedPool() once cap is hit");
        console.log("Stealth recv:  registry.registerKeys(0, metaAddress)");
        console.log("Stealth send:  approve(stealthSender, amount) then sendStealthNox(...)");
    }
}

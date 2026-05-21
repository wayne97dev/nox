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

    // Foundry routes salted `new X{salt}()` through the deterministic CREATE2 factory
    // (forge-std exposes its address as CREATE2_FACTORY), so the hook address must be
    // mined against THAT sender, not the deployer EOA.

    struct Deployed {
        NoxHook hook;
        NoxGenesis genesis;
        NoxToken token;
        StealthMining mining;
        StealthRegistry registry;
        StealthAnnouncer announcer;
        NoxStealthSender stealthSender;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address controller = vm.envAddress("CONTROLLER");

        bytes memory hookArgs = abi.encode(vm.envAddress("POOL_MANAGER"), vm.envAddress("TREASURY"));
        (address expectedHook, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, HOOK_FLAGS, type(NoxHook).creationCode, hookArgs);

        console.log("Deployer:           ", deployer);
        console.log("Controller:         ", controller);
        console.log("Expected hook addr: ", expectedHook);
        console.logBytes32(salt);

        vm.startBroadcast(pk);
        Deployed memory d = _deploy(salt, expectedHook, deployer, controller);
        vm.stopBroadcast();

        require(address(d.hook) == expectedHook, "hook addr mismatch");
        _log(d);
    }

    function _deploy(bytes32 salt, address expectedHook, address deployer, address controller)
        internal
        returns (Deployed memory d)
    {
        // The hook only depends on (poolManager, treasury). If an identical one already
        // exists at the mined address (e.g. from a prior deploy), reuse it — CREATE2 to an
        // existing address would revert. A single fee-router hook can serve multiple pools.
        d.hook = expectedHook.code.length > 0
            ? NoxHook(payable(expectedHook))
            : new NoxHook{salt: salt}(IPoolManager(vm.envAddress("POOL_MANAGER")), vm.envAddress("TREASURY"));
        d.genesis = new NoxGenesis(
            vm.envOr("TOKEN_NAME", string("Nox")),
            vm.envOr("TOKEN_SYMBOL", string("NOX")),
            IPoolManager(vm.envAddress("POOL_MANAGER")),
            IHooks(address(d.hook)),
            controller,
            vm.envUint("GENESIS_WINDOW")
        );
        d.token = d.genesis.token();
        d.mining = d.genesis.mining();
        d.registry = new StealthRegistry();
        d.announcer = new StealthAnnouncer();
        d.stealthSender = new NoxStealthSender(d.token, d.announcer, d.mining);

        // Auto-wire mining if the deployer is also the controller; otherwise the
        // controller must call mining.setStealthSender(stealthSender) post-deploy.
        if (deployer == controller) {
            d.mining.setStealthSender(address(d.stealthSender));
        }
    }

    function _log(Deployed memory d) internal view {
        console.log("");
        console.log("=== Deployment complete ===");
        console.log("NoxHook:           ", address(d.hook));
        console.log("NoxGenesis:        ", address(d.genesis));
        console.log("NoxToken:          ", address(d.token));
        console.log("StealthMining:     ", address(d.mining));
        console.log("StealthRegistry:   ", address(d.registry));
        console.log("StealthAnnouncer:  ", address(d.announcer));
        console.log("NoxStealthSender:  ", address(d.stealthSender));
    }
}

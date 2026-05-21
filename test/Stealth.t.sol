// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";

import {PoolManager} from "v4-core/src/PoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

import {NoxToken} from "../src/NoxToken.sol";
import {NoxGenesis} from "../src/NoxGenesis.sol";
import {NoxHook} from "../src/NoxHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";

import {StealthRegistry} from "../src/stealth/StealthRegistry.sol";
import {StealthAnnouncer} from "../src/stealth/StealthAnnouncer.sol";
import {NoxStealthSender} from "../src/stealth/NoxStealthSender.sol";
import {StealthMining} from "../src/stealth/StealthMining.sol";

contract StealthTest is Test {
    PoolManager internal poolManager;
    NoxToken internal token;
    NoxGenesis internal genesis;
    NoxHook internal hook;
    StealthMining internal mining;

    StealthRegistry internal registry;
    StealthAnnouncer internal announcer;
    NoxStealthSender internal sender;

    uint160 internal constant HOOK_FLAGS = uint160(Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);

    address internal treasury = address(0x7EEA);
    address internal controller = address(0xC047);
    address internal alice;
    uint256 internal alicePk;
    address internal bob = address(0xB0B);
    address internal stealth = address(0x57EA17);

    function setUp() public {
        (alice, alicePk) = makeAddrAndKey("alice");

        poolManager = new PoolManager(address(this));

        bytes memory hookCreationCode = type(NoxHook).creationCode;
        bytes memory hookArgs = abi.encode(poolManager, treasury);
        (address expectedHook, bytes32 salt) = HookMiner.find(address(this), HOOK_FLAGS, hookCreationCode, hookArgs);
        bytes memory bytecode = abi.encodePacked(hookCreationCode, hookArgs);
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(deployed == expectedHook, "hook addr");
        hook = NoxHook(payable(deployed));

        genesis = new NoxGenesis(poolManager, IHooks(address(hook)), controller, 7 days);
        token = genesis.token();
        mining = genesis.mining();

        registry = new StealthRegistry();
        announcer = new StealthAnnouncer();
        sender = new NoxStealthSender(token, announcer, mining);

        vm.prank(controller);
        mining.setStealthSender(address(sender));

        _seedTokenForAlice();
    }

    // ------------------------------------------------------------------
    // Registry
    // ------------------------------------------------------------------

    function test_registerKeys_storesMetaAddress() public {
        bytes memory meta = hex"deadbeef";
        vm.prank(alice);
        registry.registerKeys(0, meta);
        assertEq(registry.stealthMetaAddressOf(alice, 0), meta);
    }

    function test_registerKeys_emitsEvent() public {
        bytes memory meta = hex"010203";
        vm.expectEmit(true, true, false, true);
        emit StealthRegistry.StealthMetaAddressSet(alice, 0, meta);
        vm.prank(alice);
        registry.registerKeys(0, meta);
    }

    function test_registerKeysOnBehalf_acceptsValidSignature() public {
        bytes memory meta = hex"cafebabe";
        bytes32 digest = keccak256(abi.encode(uint256(0), meta));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePk, ethSigned);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(bob);
        registry.registerKeysOnBehalf(alice, 0, sig, meta);
        assertEq(registry.stealthMetaAddressOf(alice, 0), meta);
    }

    function test_registerKeysOnBehalf_rejectsBadSignature() public {
        bytes memory meta = hex"f00d";
        bytes32 digest = keccak256(abi.encode(uint256(0), meta));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePk, ethSigned);
        bytes memory sig = abi.encodePacked(r, s, v);

        // tamper with the meta-address — signature no longer matches
        bytes memory tampered = hex"f00daa";
        vm.expectRevert(StealthRegistry.InvalidSignature.selector);
        registry.registerKeysOnBehalf(alice, 0, sig, tampered);
    }

    // ------------------------------------------------------------------
    // Announcer
    // ------------------------------------------------------------------

    function test_announce_emitsEvent() public {
        bytes memory ephemeral = hex"02abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
        bytes memory metadata = abi.encodePacked(bytes1(0xaa), address(token), uint256(42 ether));

        vm.expectEmit(true, true, true, true);
        emit StealthAnnouncer.Announcement(0, stealth, address(this), ephemeral, metadata);
        announcer.announce(0, stealth, ephemeral, metadata);
    }

    // ------------------------------------------------------------------
    // NoxStealthSender — full flow
    // ------------------------------------------------------------------

    function test_sendStealthNox_movesTokensAndAnnouncesAndPaysReward() public {
        uint256 amount = 5_000 ether;
        bytes memory ephemeral = hex"031111111111111111111111111111111111111111111111111111111111111111";
        bytes1 viewTag = 0x42;

        vm.prank(alice);
        token.approve(address(sender), amount);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 stealthBefore = token.balanceOf(stealth);
        uint256 expectedReward = mining.currentReward();
        assertEq(expectedReward, mining.INITIAL_REWARD(), "era 0 = initial reward");

        bytes memory expectedMetadata = abi.encodePacked(viewTag, address(token), amount);
        vm.expectEmit(true, true, true, true);
        emit StealthAnnouncer.Announcement(0, stealth, address(sender), ephemeral, expectedMetadata);

        vm.prank(alice);
        uint256 reward = sender.sendStealthNox(0, stealth, amount, ephemeral, viewTag);

        assertEq(reward, expectedReward);
        assertEq(token.balanceOf(alice), aliceBefore - amount + reward, "alice loses amount, gains reward");
        assertEq(token.balanceOf(stealth), stealthBefore + amount);
        assertEq(mining.totalMined(), reward);
        assertEq(mining.txCount(), 1);
    }

    function test_mining_halvesAtEraBoundary() public {
        // Storage layout: slot 0 = stealthSender, slot 1 = txCount, slot 2 = totalMined.
        // Poke txCount to era boundary - 1 so the next send is the last of era 0.
        uint256 eraBoundary = mining.ERA_TX_COUNT();
        vm.store(address(mining), bytes32(uint256(1)), bytes32(eraBoundary - 1));

        assertEq(mining.txCount(), eraBoundary - 1, "slot 1 should be txCount");

        uint256 amount = 1 ether;
        bytes memory ephemeral = hex"0322222222222222222222222222222222222222222222222222222222222222ff";
        vm.prank(alice);
        token.approve(address(sender), amount * 2);

        // Last tx of era 0 — full reward
        vm.prank(alice);
        uint256 reward0 = sender.sendStealthNox(0, stealth, amount, ephemeral, 0x00);
        assertEq(reward0, mining.INITIAL_REWARD(), "still era 0");

        // First tx of era 1 — halved
        vm.prank(alice);
        uint256 reward1 = sender.sendStealthNox(0, stealth, amount, ephemeral, 0x00);
        assertEq(reward1, mining.INITIAL_REWARD() / 2, "halved in era 1");
    }

    function test_mining_onlyCallableByStealthSender() public {
        vm.prank(alice);
        vm.expectRevert(StealthMining.NotStealthSender.selector);
        mining.recordAndReward(alice);
    }

    function test_mining_setSenderOnlyOnce() public {
        // Already set in setUp. A second call from controller should revert.
        vm.prank(controller);
        vm.expectRevert(StealthMining.SenderAlreadySet.selector);
        mining.setStealthSender(address(0xC0FFEE));
    }

    function test_mining_setSenderOnlyByController() public {
        // Spin up a fresh genesis so mining.stealthSender is unset.
        NoxGenesis fresh = new NoxGenesis(poolManager, IHooks(address(hook)), controller, 7 days);
        StealthMining freshMining = fresh.mining();

        vm.prank(alice);
        vm.expectRevert(StealthMining.NotController.selector);
        freshMining.setStealthSender(address(0xC0FFEE));
    }

    function test_sendStealthNox_revertsOnZeroAmount() public {
        bytes memory ephemeral = hex"021111111111111111111111111111111111111111111111111111111111111111";
        vm.expectRevert(NoxStealthSender.ZeroAmount.selector);
        vm.prank(alice);
        sender.sendStealthNox(0, stealth, 0, ephemeral, 0x00);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _seedTokenForAlice() internal {
        // Fill genesis cap so we can seed the pool and unlock transfers, then make alice rich.
        uint256 cap = genesis.GENESIS_CAP_LOTS();
        uint256 perTx = genesis.MAX_LOTS_PER_TX();
        uint256 perBlock = genesis.MAX_MINTS_PER_BLOCK();
        uint256 price = genesis.LOT_PRICE();
        vm.deal(alice, cap * price);

        uint256 sold;
        while (sold < cap) {
            vm.roll(block.number + 1);
            for (uint256 i; i < perBlock && sold < cap; i++) {
                uint256 units = perTx;
                if (sold + units > cap) units = cap - sold;
                vm.prank(alice);
                genesis.mintGenesis{value: units * price}(units);
                sold += units;
            }
        }
        genesis.seedPool();
    }
}

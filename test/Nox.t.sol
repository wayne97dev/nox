// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";

import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";

import {NoxToken} from "../src/NoxToken.sol";
import {NoxGenesis} from "../src/NoxGenesis.sol";
import {NoxHook} from "../src/NoxHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";

contract NoxTest is Test {
    PoolManager internal poolManager;
    PoolSwapTest internal swapRouter;

    NoxToken internal token;
    NoxGenesis internal genesis;
    NoxHook internal hook;

    address internal treasury = address(0x7EEA);
    address internal controller = address(0xC047);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint160 internal constant HOOK_FLAGS = uint160(Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);

    function setUp() public {
        poolManager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(poolManager);

        bytes memory hookCreationCode = type(NoxHook).creationCode;
        bytes memory hookArgs = abi.encode(poolManager, treasury);

        (address expectedHook, bytes32 salt) = HookMiner.find(address(this), HOOK_FLAGS, hookCreationCode, hookArgs);

        bytes memory bytecode = abi.encodePacked(hookCreationCode, hookArgs);
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(deployed == expectedHook, "test: wrong hook address");
        hook = NoxHook(payable(deployed));

        genesis = new NoxGenesis(poolManager, IHooks(address(hook)), controller, 7 days);
        token = genesis.token();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ------------------------------------------------------------------
    // Hook permissions
    // ------------------------------------------------------------------

    function test_hookAddressEncodesAfterSwapFlags() public view {
        uint160 mask = uint160((1 << 14) - 1);
        assertEq(uint160(address(hook)) & mask, HOOK_FLAGS, "wrong flags in hook address");
    }

    // ------------------------------------------------------------------
    // Genesis sale
    // ------------------------------------------------------------------

    function test_mintGenesis_basicBuy() public {
        uint256 units = 100;
        uint256 cost = units * genesis.GENESIS_PRICE();

        vm.prank(alice);
        genesis.mintGenesis{value: cost}(units);

        assertEq(token.balanceOf(alice), units * genesis.GENESIS_UNIT());
        assertEq(genesis.unitsSold(), units);
        assertEq(address(genesis).balance, cost);
    }

    function test_mintGenesis_revertsOnWrongPayment() public {
        vm.prank(alice);
        vm.expectRevert(NoxGenesis.WrongPayment.selector);
        genesis.mintGenesis{value: 1}(100);
    }

    function test_mintGenesis_revertsOnExceedTxLimit() public {
        uint256 units = genesis.MAX_UNITS_PER_TX() + 1;
        uint256 cost = units * genesis.GENESIS_PRICE();
        vm.deal(alice, cost);
        vm.prank(alice);
        vm.expectRevert(NoxGenesis.TooManyUnits.selector);
        genesis.mintGenesis{value: cost}(units);
    }

    function test_mintGenesis_revertsOnExceedBlockLimit() public {
        uint256 cost = genesis.GENESIS_PRICE();
        uint256 maxPerBlock = genesis.MAX_MINTS_PER_BLOCK();
        for (uint256 i; i < maxPerBlock; i++) {
            vm.prank(alice);
            genesis.mintGenesis{value: cost}(1);
        }
        vm.prank(alice);
        vm.expectRevert(NoxGenesis.BlockLimitHit.selector);
        genesis.mintGenesis{value: cost}(1);
    }

    function test_transfer_blockedBeforeSeed() public {
        uint256 cost = 100 * genesis.GENESIS_PRICE();
        vm.prank(alice);
        genesis.mintGenesis{value: cost}(100);

        vm.prank(alice);
        vm.expectRevert(NoxToken.TransfersLocked.selector);
        token.transfer(bob, 1);
    }

    // ------------------------------------------------------------------
    // Pool seeding
    // ------------------------------------------------------------------

    function test_seedPool_revertsBeforeWindowEndsAndCapNotReached() public {
        vm.expectRevert(NoxGenesis.WindowOpen.selector);
        genesis.seedPool();
    }

    function test_seedPool_anyoneCanSeedWhenCapReached() public {
        _fillCap();
        vm.prank(bob);
        genesis.seedPool();
        assertTrue(genesis.seeded());
        assertTrue(token.mintingClosed());
    }

    function test_seedPool_onlyControllerWhenWindowEndsButCapNotReached() public {
        uint256 cost = 100 * genesis.GENESIS_PRICE();
        vm.prank(alice);
        genesis.mintGenesis{value: cost}(100);

        vm.warp(block.timestamp + 8 days);

        vm.prank(alice);
        vm.expectRevert(NoxGenesis.NotController.selector);
        genesis.seedPool();

        vm.prank(controller);
        genesis.seedPool();
        assertTrue(genesis.seeded());
    }

    function test_seedPool_initializesPoolWithCorrectKey() public {
        _fillCap();
        genesis.seedPool();

        (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks h) = genesis.poolKey();
        assertEq(Currency.unwrap(c0), address(0));
        assertEq(Currency.unwrap(c1), address(token));
        assertEq(fee, 0);
        assertEq(tickSpacing, 60);
        assertEq(address(h), address(hook));
    }

    function test_seedPool_canTransferAfterSeed() public {
        uint256 units = 100;
        uint256 cost = units * genesis.GENESIS_PRICE();
        vm.prank(alice);
        genesis.mintGenesis{value: cost}(units);

        uint256 aliceBefore = token.balanceOf(alice);
        assertEq(aliceBefore, units * genesis.GENESIS_UNIT(), "alice didn't actually mint");

        _fillCapFrom(bob);
        genesis.seedPool();

        vm.prank(alice);
        token.transfer(bob, 1 ether);
        assertEq(token.balanceOf(alice), aliceBefore - 1 ether);
    }

    // ------------------------------------------------------------------
    // Refund flow
    // ------------------------------------------------------------------

    function test_refund_revertsBeforeGrace() public {
        uint256 cost = 100 * genesis.GENESIS_PRICE();
        vm.prank(alice);
        genesis.mintGenesis{value: cost}(100);

        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        vm.expectRevert(NoxGenesis.GraceNotPassed.selector);
        genesis.refund();
    }

    function test_refund_paysOutAfterGrace() public {
        uint256 cost = 100 * genesis.GENESIS_PRICE();
        vm.prank(alice);
        genesis.mintGenesis{value: cost}(100);

        vm.warp(block.timestamp + 8 days + 49 hours);

        uint256 beforeBal = alice.balance;
        vm.prank(alice);
        genesis.refund();
        assertEq(alice.balance, beforeBal + cost);
    }

    // ------------------------------------------------------------------
    // Swap with fee
    // ------------------------------------------------------------------

    function test_swapAfterSeed_chargesOnePercent() public {
        _fillCap();
        genesis.seedPool();

        PoolKey memory key;
        {
            (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks h) = genesis.poolKey();
            key = PoolKey(c0, c1, fee, tickSpacing, h);
        }

        uint256 swapEth = 0.1 ether;
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(swapEth),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        uint256 noxBefore = token.balanceOf(address(this));
        swapRouter.swap{value: swapEth}(key, params, settings, "");
        uint256 noxAfter = token.balanceOf(address(this));

        uint256 received = noxAfter - noxBefore;
        assertGt(received, 0, "no NOX received");

        uint256 feeClaim = poolManager.balanceOf(address(hook), uint256(uint160(address(token))));
        assertGt(feeClaim, 0, "no fee taken by hook");

        uint256 grossOut = received + feeClaim;
        assertApproxEqRel(feeClaim, grossOut / 100, 0.01e18, "fee should be ~1% of gross output");
    }

    function test_withdrawFees_sendsToTreasury() public {
        _fillCap();
        genesis.seedPool();

        PoolKey memory key;
        {
            (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks h) = genesis.poolKey();
            key = PoolKey(c0, c1, fee, tickSpacing, h);
        }

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -0.1 ether,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        swapRouter.swap{value: 0.1 ether}(key, params, settings, "");

        uint256 before = token.balanceOf(treasury);
        uint256 withdrawn = hook.withdrawFees(Currency.wrap(address(token)));
        assertGt(withdrawn, 0);
        assertEq(token.balanceOf(treasury), before + withdrawn);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _fillCap() internal {
        _fillCapFrom(bob);
    }

    function _fillCapFrom(address from) internal {
        uint256 cap = genesis.GENESIS_CAP_UNITS();
        uint256 perTx = genesis.MAX_UNITS_PER_TX();
        uint256 perBlock = genesis.MAX_MINTS_PER_BLOCK();
        uint256 price = genesis.GENESIS_PRICE();
        vm.deal(from, cap * price);

        uint256 sold = genesis.unitsSold();
        while (sold < cap) {
            vm.roll(block.number + 1);
            for (uint256 i; i < perBlock && sold < cap; i++) {
                uint256 units = perTx;
                if (sold + units > cap) units = cap - sold;
                uint256 cost = units * price;
                vm.prank(from);
                genesis.mintGenesis{value: cost}(units);
                sold += units;
            }
        }
    }
}

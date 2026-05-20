// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {LiquidityAmounts} from "v4-periphery/src/libraries/LiquidityAmounts.sol";

import {NoxToken} from "./NoxToken.sol";
import {StealthMining} from "./stealth/StealthMining.sol";

/// @title NoxGenesis
/// @notice Fixed-price genesis sale + automatic Uniswap v4 pool seeding.
///
/// Lifecycle:
///   1. Open phase: anyone calls `mintGenesis(units)` and pays GENESIS_PRICE per unit. NOX is
///      minted to the buyer immediately, but NOX is non-transferable until `seedPool()` runs
///      because the token's transfer hook isn't engaged here — instead, the genesis simply
///      tracks the ETH and enforces the cap.
///   2. Close trigger: when the genesis cap is hit, OR when `closeWindow` expires, anyone can
///      call `seedPool()`. This initializes the v4 pool with NoxHook, mints the 20% LP
///      allocation, deposits ETH + NOX as full-range liquidity owned by this contract
///      (permanently locked — no remove function), and seals NOX minting forever.
///   3. Refund fallback: if `seedPool()` is never called and `REFUND_GRACE` passes after the
///      window closes, buyers can `refund()` their ETH proportionally.
contract NoxGenesis is IUnlockCallback {
    NoxToken public immutable token;
    StealthMining public immutable mining;
    IPoolManager public immutable poolManager;
    IHooks public immutable hook;
    address public immutable controller;

    uint256 public constant GENESIS_SUPPLY = 600_000_000 ether;
    uint256 public constant LP_SUPPLY = 200_000_000 ether;
    uint256 public constant MINING_SUPPLY = 200_000_000 ether;

    uint256 public constant GENESIS_UNIT = 1_000 ether;
    uint256 public constant GENESIS_PRICE = 0.00001 ether;
    uint256 public constant GENESIS_CAP_UNITS = 600_000;

    uint256 public constant MAX_UNITS_PER_TX = 10_000;
    uint256 public constant MAX_MINTS_PER_BLOCK = 5;

    uint256 public constant REFUND_GRACE = 48 hours;

    int24 public constant TICK_SPACING = 60;
    int24 public constant TICK_LOWER = -887220;
    int24 public constant TICK_UPPER = 887220;
    uint24 public constant LP_FEE = 0;

    uint256 public immutable closeAt;

    uint256 public unitsSold;
    mapping(address => uint256) public ethPaid;
    mapping(uint256 => uint256) public mintsInBlock;

    bool public seeded;
    PoolKey public poolKey;

    event GenesisBought(address indexed buyer, uint256 units, uint256 ethPaid);
    event PoolSeeded(uint256 ethSeeded, uint256 noxSeeded, uint160 sqrtPriceX96, uint128 liquidity);
    event Refunded(address indexed buyer, uint256 amount);

    error NotController();
    error WindowClosed();
    error WindowOpen();
    error CapReached();
    error ZeroUnits();
    error TooManyUnits();
    error BlockLimitHit();
    error WrongPayment();
    error AlreadySeeded();
    error NothingToRefund();
    error GraceNotPassed();
    error CapNotReached();
    error NotPoolManager();
    error NoEthRaised();

    constructor(IPoolManager _poolManager, IHooks _hook, address _controller, uint256 _windowSeconds) {
        poolManager = _poolManager;
        hook = _hook;
        controller = _controller;
        closeAt = block.timestamp + _windowSeconds;
        token = new NoxToken(address(this));
        mining = new StealthMining(token, _controller);
    }

    // ------------------------------------------------------------------
    // Genesis sale
    // ------------------------------------------------------------------

    function mintGenesis(uint256 units) external payable {
        if (seeded) revert WindowClosed();
        if (block.timestamp >= closeAt) revert WindowClosed();
        if (units == 0) revert ZeroUnits();
        if (units > MAX_UNITS_PER_TX) revert TooManyUnits();
        if (unitsSold + units > GENESIS_CAP_UNITS) revert CapReached();
        if (msg.value != units * GENESIS_PRICE) revert WrongPayment();

        uint256 mints = ++mintsInBlock[block.number];
        if (mints > MAX_MINTS_PER_BLOCK) revert BlockLimitHit();

        unitsSold += units;
        ethPaid[msg.sender] += msg.value;
        token.mint(msg.sender, units * GENESIS_UNIT);

        emit GenesisBought(msg.sender, units, msg.value);
    }

    // ------------------------------------------------------------------
    // Pool seeding
    // ------------------------------------------------------------------

    function seedPool() external {
        if (seeded) revert AlreadySeeded();
        bool capReached = unitsSold == GENESIS_CAP_UNITS;
        bool windowEnded = block.timestamp >= closeAt;
        if (!capReached && !windowEnded) revert WindowOpen();
        if (!capReached && msg.sender != controller) revert NotController();

        seeded = true;

        uint256 ethRaised = address(this).balance;
        if (ethRaised == 0) revert NoEthRaised();

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(token)),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolKey = key;

        uint160 sqrtPriceX96 = _initialSqrtPriceX96(ethRaised, LP_SUPPLY);
        poolManager.initialize(key, sqrtPriceX96);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(TICK_LOWER),
            TickMath.getSqrtPriceAtTick(TICK_UPPER),
            ethRaised,
            LP_SUPPLY
        );

        poolManager.unlock(abi.encode(key, liquidity));

        // Mint the mining supply to the StealthMining contract before sealing.
        token.mint(address(mining), MINING_SUPPLY);

        token.sealMinting();
        emit PoolSeeded(ethRaised, LP_SUPPLY, sqrtPriceX96, liquidity);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (PoolKey memory key, uint128 liquidity) = abi.decode(data, (PoolKey, uint128));

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );

        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();

        if (d0 < 0) {
            uint256 owed0 = uint256(uint128(-d0));
            poolManager.settle{value: owed0}();
        }
        if (d1 < 0) {
            uint256 owed1 = uint256(uint128(-d1));
            token.mint(address(this), owed1);
            poolManager.sync(key.currency1);
            token.transfer(address(poolManager), owed1);
            poolManager.settle();
        }

        return "";
    }

    // ------------------------------------------------------------------
    // Refund fallback
    // ------------------------------------------------------------------

    function refund() external {
        if (seeded) revert AlreadySeeded();
        if (block.timestamp < closeAt + REFUND_GRACE) revert GraceNotPassed();
        uint256 amount = ethPaid[msg.sender];
        if (amount == 0) revert NothingToRefund();
        ethPaid[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "refund failed");
        emit Refunded(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Views / helpers
    // ------------------------------------------------------------------

    /// @dev sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96, computed with overflow-safe math.
    ///      For currency0 = ETH, currency1 = NOX, price represents NOX per ETH.
    function _initialSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 ratio = (amount1 * (1 << 96)) / amount0;
        return uint160(_sqrt(ratio) << 48);
    }

    /// @dev Babylonian sqrt.
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    receive() external payable {}
}

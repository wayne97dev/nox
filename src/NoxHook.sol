// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {SafeCast} from "v4-core/src/libraries/SafeCast.sol";
import {BaseHook} from "./utils/BaseHook.sol";

/// @title NoxHook
/// @notice Uniswap v4 hook that takes a flat 1% fee from the output side of every swap and
///         forwards it to a fixed treasury at withdraw time. The hook contract custodies the
///         fees as ERC-6909 claims on the PoolManager (or native ETH) until `withdrawFees` is
///         called.
contract NoxHook is BaseHook {
    using SafeCast for uint256;

    uint128 public constant SWAP_FEE_BPS = 100;
    uint128 public constant TOTAL_BPS = 10_000;

    /// @notice Single recipient of the 1% swap fee. If the team later wants to split between
    ///         ops and dev comp, deploy a Splitter contract and set it as `treasury` here.
    address public immutable treasury;

    event FeeTaken(Currency indexed currency, uint256 amount);
    event FeesWithdrawn(Currency indexed currency, uint256 amount);

    error ZeroAddress();

    constructor(IPoolManager _poolManager, address _treasury) BaseHook(_poolManager) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Takes 1% of the output (unspecified) token on every swap. The fee is debited
    ///         from the swapper and credited to this hook as a claim against the PoolManager.
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        bool specifiedTokenIs0 = (params.amountSpecified < 0) == params.zeroForOne;
        (Currency feeCurrency, int128 swapAmount) =
            specifiedTokenIs0 ? (key.currency1, delta.amount1()) : (key.currency0, delta.amount0());

        if (swapAmount < 0) swapAmount = -swapAmount;

        uint256 feeAmount = (uint128(swapAmount) * SWAP_FEE_BPS) / TOTAL_BPS;
        if (feeAmount == 0) return (IHooks.afterSwap.selector, 0);

        poolManager.mint(address(this), feeCurrency.toId(), feeAmount);
        emit FeeTaken(feeCurrency, feeAmount);

        return (IHooks.afterSwap.selector, feeAmount.toInt128());
    }

    /// @notice Anyone can trigger withdrawal — funds always go to the immutable treasury.
    function withdrawFees(Currency currency) external returns (uint256 amount) {
        amount = poolManager.balanceOf(address(this), currency.toId());
        if (amount == 0) return 0;

        poolManager.unlock(abi.encode(currency, amount));
        emit FeesWithdrawn(currency, amount);
    }

    /// @notice PoolManager callback: burns this hook's claim and transfers the underlying
    ///         currency to the treasury.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (Currency currency, uint256 amount) = abi.decode(data, (Currency, uint256));

        poolManager.burn(address(this), currency.toId(), amount);
        poolManager.take(currency, treasury, amount);

        return "";
    }

    receive() external payable {}
}

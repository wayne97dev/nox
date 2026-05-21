// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title StealthMining
/// @notice Holds the 200M NOX mining supply and pays a flat per-transaction reward to the
///         sender every time `NoxStealthSender.sendStealthNox` is invoked. Reward halves
///         every `ERA_TX_COUNT` stealth transactions (Bitcoin-style halving) so emission is
///         predictable and asymptotes at `MINING_SUPPLY`.
///
/// Wiring:
///   - Deployed by NoxGenesis in its constructor; immutable token reference.
///   - The genesis `controller` calls `setStealthSender(noxStealthSender)` exactly once
///     after the sender is deployed. After that, only the sender can trigger rewards.
///   - At `seedPool`, NoxGenesis mints the full MINING_SUPPLY to this contract.
contract StealthMining {
    IERC20 public immutable token;
    address public immutable controller;

    uint256 public constant MINING_SUPPLY = 500_000_000 ether;
    uint256 public constant INITIAL_REWARD = 1_000 ether; // 1,000 NOX per stealth tx in era 0
    uint256 public constant ERA_TX_COUNT = 250_000; // halving every 250k stealth tx

    address public stealthSender;
    uint256 public txCount;
    uint256 public totalMined;

    event StealthSenderSet(address indexed sender);
    event MiningRewardPaid(address indexed sender, uint256 amount, uint256 era, uint256 txIndex);

    error NotController();
    error NotStealthSender();
    error SenderAlreadySet();
    error ZeroAddress();

    constructor(IERC20 _token, address _controller) {
        if (_controller == address(0)) revert ZeroAddress();
        token = _token;
        controller = _controller;
    }

    /// @notice One-time wiring of the NoxStealthSender authorized to trigger rewards.
    function setStealthSender(address _sender) external {
        if (msg.sender != controller) revert NotController();
        if (stealthSender != address(0)) revert SenderAlreadySet();
        if (_sender == address(0)) revert ZeroAddress();
        stealthSender = _sender;
        emit StealthSenderSet(_sender);
    }

    /// @notice Called by NoxStealthSender after a successful stealth transfer. Pays the
    ///         current-era reward to `to`. Silently returns 0 once supply is exhausted.
    function recordAndReward(address to) external returns (uint256 reward) {
        if (msg.sender != stealthSender) revert NotStealthSender();

        uint256 era = txCount / ERA_TX_COUNT;
        if (era >= 256) {
            txCount++;
            return 0;
        }
        reward = INITIAL_REWARD >> era;

        uint256 remaining = MINING_SUPPLY - totalMined;
        if (reward > remaining) reward = remaining;

        txCount++;
        if (reward == 0) return 0;

        totalMined += reward;
        // SafeERC20 isn't needed: NOX is our own OZ ERC-20 which reverts on failure.
        token.transfer(to, reward);
        emit MiningRewardPaid(to, reward, era, txCount - 1);
    }

    /// @notice View: what the next stealth tx would earn.
    function currentReward() external view returns (uint256) {
        uint256 era = txCount / ERA_TX_COUNT;
        if (era >= 256) return 0;
        uint256 reward = INITIAL_REWARD >> era;
        uint256 remaining = MINING_SUPPLY - totalMined;
        return reward > remaining ? remaining : reward;
    }
}

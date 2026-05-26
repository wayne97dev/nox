// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StealthAnnouncer} from "./StealthAnnouncer.sol";
import {StealthMining} from "./StealthMining.sol";

/// @title NoxStealthSender
/// @notice One-call helper that forwards funds to a one-time stealth address (computed
///         off-chain by the sender) and emits the ERC-5564 Announcement so the recipient can
///         discover the payment. Three assets are supported:
///           - sendStealthNox   : NOX — pays a mining reward when amount >= MIN_REWARDED_AMOUNT
///           - sendStealthToken : any ERC-20 (e.g. USDC) — privacy only, no reward
///           - sendStealthETH   : native ETH — privacy only, no reward
///         Only NOX sends mine, by design: mining incentivizes the project token, not the
///         movement of arbitrary assets (which would otherwise be trivially farmable).
///
///         The recipient is expected to have published their stealth meta-address through the
///         StealthRegistry. The sender's wallet/SDK reads that meta-address, derives a fresh
///         `stealthAddress` + `ephemeralPubKey` pair, then calls this contract.
///
///         metadata layout (Umbra-style, 53 bytes):
///           bytes[0]      view tag (first byte of shared secret hash)
///           bytes[1..21)  asset address (NATIVE sentinel for ETH)
///           bytes[21..53] uint256 amount (big-endian)
contract NoxStealthSender {
    using SafeERC20 for IERC20;

    /// @dev Umbra-compatible sentinel used in metadata to denote native ETH.
    address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IERC20 public immutable nox;
    StealthAnnouncer public immutable announcer;
    StealthMining public immutable mining;

    event StealthTransfer(
        address indexed sender,
        address indexed stealthAddress,
        address indexed asset,
        uint256 amount,
        uint256 reward
    );

    error ZeroAmount();
    error TransferFailed();

    constructor(IERC20 _nox, StealthAnnouncer _announcer, StealthMining _mining) {
        nox = _nox;
        announcer = _announcer;
        mining = _mining;
    }

    /// @notice Send NOX to a stealth address and earn a mining reward (if the amount qualifies).
    /// @param schemeId        ERC-5564 scheme; 0 = SECP256k1
    /// @param stealthAddress  one-time address derived from the recipient's meta-address
    /// @param amount          NOX amount (sender must have approved this contract)
    /// @param ephemeralPubKey sender's ephemeral pubkey (33 bytes for compressed SECP256k1)
    /// @param viewTag         first byte of keccak(sharedSecret) — lets recipients prune logs
    function sendStealthNox(
        uint256 schemeId,
        address stealthAddress,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external returns (uint256 reward) {
        if (amount == 0) revert ZeroAmount();

        nox.safeTransferFrom(msg.sender, stealthAddress, amount);
        _announce(schemeId, stealthAddress, address(nox), amount, ephemeralPubKey, viewTag);
        reward = mining.recordAndReward(msg.sender, amount);

        emit StealthTransfer(msg.sender, stealthAddress, address(nox), amount, reward);
    }

    /// @notice Send any ERC-20 (e.g. USDC) to a stealth address. Privacy only — no reward.
    /// @param token the ERC-20 to move (sender must have approved this contract)
    function sendStealthToken(
        address token,
        uint256 schemeId,
        address stealthAddress,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external {
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, stealthAddress, amount);
        _announce(schemeId, stealthAddress, token, amount, ephemeralPubKey, viewTag);

        emit StealthTransfer(msg.sender, stealthAddress, token, amount, 0);
    }

    /// @notice Send native ETH to a stealth address. Privacy only — no reward.
    function sendStealthETH(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external payable {
        if (msg.value == 0) revert ZeroAmount();

        (bool ok,) = stealthAddress.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
        _announce(schemeId, stealthAddress, NATIVE, msg.value, ephemeralPubKey, viewTag);

        emit StealthTransfer(msg.sender, stealthAddress, NATIVE, msg.value, 0);
    }

    function _announce(
        uint256 schemeId,
        address stealthAddress,
        address asset,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) internal {
        bytes memory metadata = abi.encodePacked(viewTag, asset, amount);
        announcer.announce(schemeId, stealthAddress, ephemeralPubKey, metadata);
    }
}

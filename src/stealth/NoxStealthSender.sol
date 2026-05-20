// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StealthAnnouncer} from "./StealthAnnouncer.sol";
import {StealthMining} from "./StealthMining.sol";

/// @title NoxStealthSender
/// @notice One-call helper that pulls NOX from the sender, forwards it to a one-time stealth
///         address computed off-chain by the sender, and emits the ERC-5564 Announcement so
///         the recipient can discover the payment. Pays a NOX mining reward to the sender
///         on every call (halving Bitcoin-style; capped at 200M MINING_SUPPLY).
///
///         The recipient is expected to have published their stealth meta-address through the
///         StealthRegistry. The sender's wallet/SDK reads that meta-address, derives a fresh
///         `stealthAddress` + `ephemeralPubKey` pair, then calls this contract.
///
///         metadata layout (Umbra-style, 53 bytes):
///           bytes[0]      view tag (first byte of shared secret hash)
///           bytes[1..21)  NOX token address
///           bytes[21..53] uint256 amount (big-endian)
contract NoxStealthSender {
    IERC20 public immutable nox;
    StealthAnnouncer public immutable announcer;
    StealthMining public immutable mining;

    event StealthTransfer(address indexed sender, address indexed stealthAddress, uint256 amount, uint256 reward);

    error ZeroAmount();

    constructor(IERC20 _nox, StealthAnnouncer _announcer, StealthMining _mining) {
        nox = _nox;
        announcer = _announcer;
        mining = _mining;
    }

    /// @param schemeId        ERC-5564 scheme; 0 = SECP256k1
    /// @param stealthAddress  one-time address derived from recipient's meta-address
    /// @param amount          NOX amount to send (sender must have approved this contract)
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

        bytes memory metadata = abi.encodePacked(viewTag, address(nox), amount);

        nox.transferFrom(msg.sender, stealthAddress, amount);
        announcer.announce(schemeId, stealthAddress, ephemeralPubKey, metadata);
        reward = mining.recordAndReward(msg.sender);

        emit StealthTransfer(msg.sender, stealthAddress, amount, reward);
    }
}

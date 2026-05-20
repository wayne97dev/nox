// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title StealthAnnouncer
/// @notice ERC-5564 announcer. The sender deposits funds to a one-time `stealthAddress` and
///         then calls `announce` so the recipient can discover the payment by scanning logs.
///         The contract itself never holds funds — it only emits the discovery event.
contract StealthAnnouncer {
    /// @param schemeId       scheme used (0 = SECP256k1 per ERC-5564)
    /// @param stealthAddress the one-time recipient address
    /// @param caller         msg.sender that fired the announce (indexed for filtering)
    /// @param ephemeralPubKey the sender's ephemeral public key needed by the recipient to derive the stealth privkey
    /// @param metadata       application-specific bytes. For NOX we use the Umbra-style layout:
    ///                       [0]: view tag (1 byte)
    ///                       [1..21): ERC-20 token address (or 0xeee...eee for native)
    ///                       [21..53): uint256 amount
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata)
        external
    {
        emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
    }
}

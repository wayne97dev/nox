// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title StealthRegistry
/// @notice ERC-6538 compliant registry of stealth meta-addresses. A meta-address is a
///         scheme-specific public material (e.g. a SECP256k1 spending + viewing pubkey
///         pair) that lets anyone derive a one-time stealth address for the registrant.
///
///         scheme 0 is reserved for SECP256k1 per ERC-5564.
contract StealthRegistry {
    /// @dev registrant => schemeId => stealth meta-address bytes
    mapping(address => mapping(uint256 => bytes)) private _metaAddress;

    event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);

    error InvalidSignature();

    /// @notice Read the registrant's published meta-address for a scheme.
    function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes memory) {
        return _metaAddress[registrant][schemeId];
    }

    /// @notice Publish the caller's meta-address for a given scheme.
    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external {
        _metaAddress[msg.sender][schemeId] = stealthMetaAddress;
        emit StealthMetaAddressSet(msg.sender, schemeId, stealthMetaAddress);
    }

    /// @notice Publish a meta-address on behalf of `registrant`, authorized by their EIP-191
    ///         personal_sign signature over keccak256(schemeId, stealthMetaAddress).
    function registerKeysOnBehalf(
        address registrant,
        uint256 schemeId,
        bytes calldata signature,
        bytes calldata stealthMetaAddress
    ) external {
        bytes32 digest = keccak256(abi.encode(schemeId, stealthMetaAddress));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address signer = _recover(ethSigned, signature);
        if (signer != registrant) revert InvalidSignature();

        _metaAddress[registrant][schemeId] = stealthMetaAddress;
        emit StealthMetaAddressSet(registrant, schemeId, stealthMetaAddress);
    }

    function _recover(bytes32 hash, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(hash, v, r, s);
    }
}

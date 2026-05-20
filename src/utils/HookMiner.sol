// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Brute-forces a CREATE2 salt so the deployed hook address encodes the desired
///         hook permission flags in its lowest 14 bits.
library HookMiner {
    uint160 internal constant FLAG_MASK = uint160((1 << 14) - 1);

    uint256 internal constant MAX_LOOP = 200_000;

    error HookMinerExhausted();

    /// @param deployer The address that will perform the CREATE2 deployment (e.g. CREATE2 Deployer Proxy)
    /// @param flags    The exact hook flag bits the resulting address must encode (lowest 14 bits)
    /// @param creationCode The contract's creation bytecode
    /// @param constructorArgs ABI-encoded constructor arguments to append to creationCode
    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        flags = flags & FLAG_MASK;
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        for (uint256 i; i < MAX_LOOP; ++i) {
            salt = bytes32(i);
            hookAddress = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash))))
            );
            if ((uint160(hookAddress) & FLAG_MASK) == flags) {
                return (hookAddress, salt);
            }
        }
        revert HookMinerExhausted();
    }
}

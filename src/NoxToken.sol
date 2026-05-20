// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title NoxToken
/// @notice The NOX ERC-20. Mint is locked behind a single `minter` (the Genesis contract).
///         Once the Genesis seals minting, the supply is fixed forever.
contract NoxToken is ERC20, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    address public immutable minter;

    bool public mintingClosed;

    error NotMinter();
    error MintingClosed();
    error MaxSupplyExceeded();
    error TransfersLocked();

    event MintingSealed();

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    constructor(address minter_) ERC20("Nox", "NOX") ERC20Permit("Nox") {
        minter = minter_;
    }

    /// @notice Mints `amount` NOX to `to`. Only callable by the Genesis contract.
    function mint(address to, uint256 amount) external onlyMinter {
        if (mintingClosed) revert MintingClosed();
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    /// @notice Permanently disables further minting and unlocks free transfers. Called by
    ///         Genesis after seeding the v4 pool.
    function sealMinting() external onlyMinter {
        mintingClosed = true;
        emit MintingSealed();
    }

    /// @dev Pre-seal, only mint/burn moves are allowed plus transfers initiated by the minter
    ///      itself (so Genesis can move LP_SUPPLY into the PoolManager during `seedPool`).
    function _update(address from, address to, uint256 value) internal override {
        if (!mintingClosed && from != address(0) && from != minter) {
            revert TransfersLocked();
        }
        super._update(from, to, value);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * rewritten version of https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/utils/Stoppable.sol
 *
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotStopped` and `whenStopped`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Stoppable is Context {
    /**
     * @dev Emitted when the stop is triggered by `account`.
     */
    event Stopped(address account);

    /**
     * @dev Emitted when the stop is lifted by `account`.
     */
    event Unstopped(address account);

    bool private _stopped;

    /**
     * @dev Initializes the contract in unstopped state.
     */
    constructor() {
        _stopped = false;
    }

    /**
     * @dev Returns true if the contract is stopped, and false otherwise.
     */
    function stopped() public view returns (bool) {
        return _stopped;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not stopped.
     *
     * Requirements:
     *
     * - The contract must not be stopped.
     */
    modifier whenNotStopped() {
        require(!_stopped, "Stoppable: stopped");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is stopped.
     *
     * Requirements:
     *
     * - The contract must be stopped.
     */
    modifier whenStopped() {
        require(_stopped, "Stoppable: not stopped");
        _;
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be stopped.
     */
    function _stop() internal virtual whenNotStopped {
        _stopped = true;
        emit Stopped(_msgSender());
    }
}

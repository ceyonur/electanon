/*
 * Semaphore - Zero-knowledge signaling on Ethereum
 * Copyright (C) 2020 Barry WhiteHat <barrywhitehat@protonmail.com>, Kobi
 * Gurkan <kobigurk@gmail.com> and Koh Wei Jie (contact@kohweijie.com)
 *
 * This file is part of Semaphore.
 *
 * Semaphore is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Semaphore is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Semaphore.  If not, see <http://www.gnu.org/licenses/>.
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SemaphoreOpt.sol";

// A mapping of all signals broadcasted

contract SemaphoreOptTest is SemaphoreOpt {
    mapping(uint256 => bytes32) public signalIndexToSignal;
    uint256 public nextSignalIndex = 0;

    constructor(uint256 _treeLevels) SemaphoreOpt(_treeLevels) {}

    function addVoters(uint256[] memory _identityCommitments, uint256 _root)
        external
        onlyOwner
    {
        insertLeaves(_identityCommitments, _root);
    }

    function addIdCommitment(uint256 _identityCommitment, uint256 _root)
        external
        onlyOwner
    {
        insertLeaf(_identityCommitment, _root);
    }

    function broadcastSignalTest(
        bytes32 _signal,
        uint256[8] memory _proof,
        uint256 _nullifiersHash
    ) public {
        // store the signal
        signalIndexToSignal[nextSignalIndex] = _signal;

        // increment the signal index
        nextSignalIndex++;
        broadcastSignal(_signal, _proof, _nullifiersHash);
    }

    function isExternalNullifierActive(uint256 _externalNullifier)
        public
        view
        returns (bool)
    {
        return externalNullifier == _externalNullifier;
    }
}

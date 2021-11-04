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

import {Verifier} from "../../../circuits/semaphore/build/verifier.sol";
import {IncrementalMerkleTreeOpt} from "./IncrementalMerkleTreeOpt.sol";
import "../../libs/Ownable.sol";

contract SemaphoreOpt is Verifier, IncrementalMerkleTreeOpt, Ownable {
    // The external nullifier helps to prevent double-signalling by the same
    // user. An external nullifier can be active or deactivated.

    // We store the external nullifiers using a mapping of the form:
    // enA => { next external nullifier; if enA exists; if enA is active }
    // Think of it as a linked list.
    uint256 externalNullifier = 0;

    // Whether the contract has already seen a particular nullifier hash
    mapping(uint256 => bool) public nullifierHashHistory;

    /*
     * @param _treeLevels The depth of the identity tree.
     * @param _firstExternalNullifier The first identity nullifier to add.
     */
    constructor() IncrementalMerkleTreeOpt() Ownable() {
        addEn(uint256(uint160(address(this))));
    }

    /*
     * Checks if all values within pi_a, pi_b, and pi_c of a zk-SNARK are less
     * than the scalar field.
     * @param _a The corresponding `a` parameter to verifier.sol's
     *           verifyProof()
     * @param _b The corresponding `b` parameter to verifier.sol's
     *           verifyProof()
     * @param _c The corresponding `c` parameter to verifier.sol's
                 verifyProof()
     */
    function areAllValidFieldElements(uint256[8] memory _proof)
        internal
        pure
        returns (bool)
    {
        return
            _proof[0] < SNARK_SCALAR_FIELD &&
            _proof[1] < SNARK_SCALAR_FIELD &&
            _proof[2] < SNARK_SCALAR_FIELD &&
            _proof[3] < SNARK_SCALAR_FIELD &&
            _proof[4] < SNARK_SCALAR_FIELD &&
            _proof[5] < SNARK_SCALAR_FIELD &&
            _proof[6] < SNARK_SCALAR_FIELD &&
            _proof[7] < SNARK_SCALAR_FIELD;
    }

    /*
     * Produces a keccak256 hash of the given signal, shifted right by 8 bits.
     * @param _signal The signal to hash
     */
    function hashSignal(bytes32 _signal) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(_signal))) >> 8;
    }

    /*
     * A convenience function which returns a uint256 array of 8 elements which
     * comprise a Groth16 zk-SNARK proof's pi_a, pi_b, and pi_c  values.
     * @param _a The corresponding `a` parameter to verifier.sol's
     *           verifyProof()
     * @param _b The corresponding `b` parameter to verifier.sol's
     *           verifyProof()
     * @param _c The corresponding `c` parameter to verifier.sol's
     *           verifyProof()
     */
    function packProof(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c
    ) public pure returns (uint256[8] memory) {
        return [
            _a[0],
            _a[1],
            _b[0][0],
            _b[0][1],
            _b[1][0],
            _b[1][1],
            _c[0],
            _c[1]
        ];
    }

    /*
     * A convenience function which converts an array of 8 elements, generated
     * by packProof(), into a format which verifier.sol's verifyProof()
     * accepts.
     * @param _proof The proof elements.
     */
    function unpackProof(uint256[8] memory _proof)
        public
        pure
        returns (
            uint256[2] memory,
            uint256[2][2] memory,
            uint256[2] memory
        )
    {
        return (
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]]
        );
    }

    /*
     * A convenience view function which helps operators to easily verify all
     * inputs to broadcastSignal() using a single contract call. This helps
     * them to save gas by detecting invalid inputs before they invoke
     * broadcastSignal(). Note that this function does the same checks as
     * `isValidSignalAndProof` but returns a bool instead of using require()
     * statements.
     * @param _signal The signal to broadcast
     * @param _proof The proof elements.
     * @param _nullifiersHash The nullifiers hash
     * @param _signalHash The signal hash. This is included so as to verify in
     *                    Solidity that the signal hash computed off-chain
     *                    matches.
     * @param _externalNullifier The external nullifier
     */
    function preBroadcastCheck(
        bytes32 _signal,
        uint256[8] memory _proof,
        uint256 _nullifiersHash,
        uint256 _signalHash
    ) public view returns (bool) {
        uint256[4] memory publicSignals = [
            root,
            _nullifiersHash,
            _signalHash,
            externalNullifier
        ];

        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c
        ) = unpackProof(_proof);

        return
            nullifierHashHistory[_nullifiersHash] == false &&
            hashSignal(_signal) == _signalHash &&
            _signalHash == hashSignal(_signal) &&
            areAllValidFieldElements(_proof) &&
            root < SNARK_SCALAR_FIELD &&
            _nullifiersHash < SNARK_SCALAR_FIELD &&
            verifyProof(a, b, c, publicSignals);
    }

    /*
     * A modifier which ensures that the signal and proof are valid.
     * @param _signal The signal to broadcast
     * @param _proof The proof elements.
     * @param _nullifiersHash The nullifiers hash
     * @param _signalHash The signal hash
     * @param _externalNullifier The external nullifier
     */
    modifier isValidSignalAndProof(
        bytes32 _signal,
        uint256[8] memory _proof,
        uint256 _nullifiersHash
    ) {
        // Check whether each element in _proof is a valid field element. Even
        // if verifier.sol does this check too, it is good to do so here for
        // the sake of good protocol design.
        //TODO: removeable
        require(
            areAllValidFieldElements(_proof),
            "Semaphore: invalid field element(s) in proof"
        );

        // Check whether the nullifier hash has been seen
        require(
            nullifierHashHistory[_nullifiersHash] == false,
            "Semaphore: nullifier already seen"
        );

        uint256 signalHash = hashSignal(_signal);

        // Check whether _nullifiersHash is a valid field element.
        require(
            _nullifiersHash < SNARK_SCALAR_FIELD,
            "Semaphore: the nullifiers hash must be lt the snark scalar field"
        );

        uint256[4] memory publicSignals = [
            root,
            _nullifiersHash,
            signalHash,
            externalNullifier
        ];

        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c
        ) = unpackProof(_proof);
        require(
            verifyProof(a, b, c, publicSignals),
            "Semaphore: invalid proof"
        );

        // Note that we don't need to check if signalHash is less than
        // SNARK_SCALAR_FIELD because it always holds true due to the
        // definition of hashSignal()

        _;
    }

    /*
     * Broadcasts the signal.
     * @param _signal The signal to broadcast
     * @param _proof The proof elements.
     * @param _root The root of the Merkle tree (the 1st public signal)
     * @param _nullifiersHash The nullifiers hash (the 2nd public signal)
     * @param _externalNullifier The nullifiers hash (the 4th public signal)
     */
    function broadcastSignal(
        bytes32 _signal,
        uint256[8] memory _proof,
        uint256 _nullifiersHash
    ) internal isValidSignalAndProof(_signal, _proof, _nullifiersHash) {
        // Client contracts should be responsible for storing the signal and/or
        // emitting it as an event

        // Store the nullifiers hash to prevent double-signalling
        nullifierHashHistory[_nullifiersHash] = true;
    }

    /*
     * A private helper function which adds an external nullifier.
     * @param _externalNullifier The external nullifier to add.
     */
    function addEn(uint256 _externalNullifier) private {
        // The external nullifier must not have already been set
        require(
            externalNullifier == 0,
            "Semaphore: external nullifier already set"
        );

        // Add a new external nullifier
        externalNullifier = _externalNullifier;
    }

    /*
     * Returns true if and only if the specified external nullifier is active
     * @param _externalNullifier The specified external nullifier.
     */
    function getActiveExternalNullifier() external view returns (uint256) {
        return externalNullifier;
    }
}

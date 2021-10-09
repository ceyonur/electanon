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

abstract contract IncrementalMerkleTreeOpt {
    uint256 constant MAX_SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // The maximum tree depth
    uint256 internal constant MAX_DEPTH = 32;

    uint256 zeroValue;

    // The tree depth
    uint256 internal treeLevels;

    uint256 leavesLength;

    // The Merkle root
    uint256 public root;

    /*
     * Stores the Merkle root and intermediate values (the Merkle path to the
     * the first leaf) assuming that all leaves are set to _zeroValue.
     * @param _treeLevels The number of levels of the tree
     * @param _zeroValue The value to set for every leaf. Ideally, this should
     *                   be a nothing-up-my-sleeve value, so that nobody can
     *                   say that the deployer knows the preimage of an empty
     *                   leaf.
     */
    constructor(uint256 _treeLevels) {
        // Limit the Merkle tree to MAX_DEPTH levels
        require(
            _treeLevels > 0 && _treeLevels <= MAX_DEPTH,
            "IncrementalMerkleTree: _treeLevels must be between 0 and 33"
        );

        treeLevels = _treeLevels;
    }

    function insertLeaves(uint256[] memory _leaves, uint256 _root)
        internal
        returns (uint256, uint256)
    {
        uint256 depth = uint256(treeLevels);
        uint256 tmpLeavesLength = leavesLength;
        require(
            tmpLeavesLength + _leaves.length < uint256(2)**depth,
            "IncrementalMerkleTree: tree is full"
        );
        for (uint256 i = 0; i < _leaves.length; i++) {
            require(
                _leaves[i] < MAX_SNARK_SCALAR_FIELD,
                "IncrementalMerkleTree: insertLeaves argument must be < MAX_SNARK_SCALAR_FIELD"
            );
        }
        root = _root;
        tmpLeavesLength += _leaves.length;
        leavesLength = tmpLeavesLength;

        return (tmpLeavesLength, tmpLeavesLength + _leaves.length);
    }

    function replaceTree(uint256[] memory _leaves, uint256 _root)
        internal
        returns (uint256)
    {
        uint256 depth = uint256(treeLevels);
        require(
            _leaves.length < uint256(2)**depth,
            "IncrementalMerkleTree: tree is full"
        );
        for (uint256 i = 0; i < _leaves.length; i++) {
            require(
                _leaves[i] < MAX_SNARK_SCALAR_FIELD,
                "IncrementalMerkleTree: insertLeaves argument must be < MAX_SNARK_SCALAR_FIELD"
            );
        }

        root = _root;

        leavesLength = _leaves.length;

        return _leaves.length;
    }

    function insertLeaf(uint256 _leaf, uint256 _root)
        internal
        returns (uint256)
    {
        require(
            _leaf < MAX_SNARK_SCALAR_FIELD,
            "IncrementalMerkleTree: insertLeaf argument must be < MAX_SNARK_SCALAR_FIELD"
        );

        uint256 depth = uint256(treeLevels);
        uint256 tmpLeavesLength = leavesLength;

        require(
            leavesLength < uint256(2)**depth,
            "IncrementalMerkleTree: tree is full"
        );

        root = _root;
        tmpLeavesLength++;
        leavesLength = tmpLeavesLength;

        return tmpLeavesLength;
    }

    function getTreeLevel() public view returns (uint256) {
        return treeLevels;
    }

    // function getLeaves() public view returns (uint256[] memory) {
    //     return leaves;
    // }

    // /*
    //  * Returns the number of inserted identity commitments.
    //  */
    function getLeavesNum() public view returns (uint256) {
        return leavesLength;
    }

    // function getLeaf(uint256 _index) public view returns (uint256) {
    //     return leaves[_index];
    // }

    function getRoot() public view returns (uint256) {
        return root;
    }
}

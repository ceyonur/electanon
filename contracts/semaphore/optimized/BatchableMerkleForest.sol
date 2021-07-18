// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {MTVerifier} from "./mtverifier.sol";

contract BatchableMerkleForest is MTVerifier {
    uint256 private constant MAX_SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // The batch size
    uint256 private constant BATCH_DEPTH = 2;
    uint256 private constant TREE_SIZES = 2**BATCH_DEPTH;

    uint256 private zeroValue;

    // The Merkle roots
    uint256[] internal treeRoots;

    // The Foret root
    uint256 internal forestRoot;

    event TreeInserted(
        uint256[TREE_SIZES] leaves,
        uint256 indexed treeIndex,
        uint256 indexed treeRoot
    );

    function insertTree(
        uint256[TREE_SIZES] memory _leaves,
        uint256 _root,
        uint256[2] memory proofA,
        uint256[2][2] memory proofB,
        uint256[2] memory proofC
    ) public {
        bytes32 leavesHash = keccak256(abi.encodePacked(_leaves));
        uint256[5] memory input = [
            _root,
            uint256((leavesHash << 0) >> 192),
            uint256((leavesHash << 64) >> 192),
            uint256((leavesHash << 128) >> 192),
            uint256((leavesHash << 192) >> 192)
        ];
        require(verifyTx(proofA, proofB, proofC, input), "invalid proof");

        treeRoots.push(_root);
        emit TreeInserted(_leaves, treeRoots.length, _root);
    }

    function getBatchDepth() public pure returns (uint256) {
        return BATCH_DEPTH;
    }

    function getTreeSize() public pure returns (uint256) {
        return TREE_SIZES;
    }

    function getTreeRoot(uint256 index) public view returns (uint256) {
        return treeRoots[index];
    }

    function getForestRoot() public view returns (uint256) {
        return forestRoot;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Verifier as MFVerifier} from "../../circuits/zk-mt/build/verifier.sol";

contract BatchableMerkleForest is MFVerifier {
    uint256 private constant MAX_SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // The batch size
    uint256 private constant BATCH_DEPTH = 7;
    uint256 internal constant TREE_SIZES = 2**BATCH_DEPTH;

    uint256 private zeroValue;

    // The Merkle roots
    mapping(uint256 => uint256) internal treeRoots;
    uint256 private treeIndex = 0;

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
    ) internal {
        bytes32 leavesHash = keccak256(abi.encodePacked(_leaves));
        uint256[5] memory input = [
            _root,
            uint256((leavesHash << 0) >> 192),
            uint256((leavesHash << 64) >> 192),
            uint256((leavesHash << 128) >> 192),
            uint256((leavesHash << 192) >> 192)
        ];
        require(verifyTx(proofA, proofB, proofC, input), "invalid proof");
        uint256 _treeIndex = treeIndex;
        treeRoots[_treeIndex] = _root;
        treeIndex = _treeIndex + 1;
        emit TreeInserted(_leaves, _treeIndex, _root);
    }

    function replaceTree(
        uint256 _index,
        uint256[TREE_SIZES] memory _leaves,
        uint256 _root,
        uint256[2] memory proofA,
        uint256[2][2] memory proofB,
        uint256[2] memory proofC
    ) internal {
        require(treeRoots[_index] != 0, "cannot replace empty slot");
        bytes32 leavesHash = keccak256(abi.encodePacked(_leaves));
        uint256[5] memory input = [
            _root,
            uint256((leavesHash << 0) >> 192),
            uint256((leavesHash << 64) >> 192),
            uint256((leavesHash << 128) >> 192),
            uint256((leavesHash << 192) >> 192)
        ];
        require(verifyTx(proofA, proofB, proofC, input), "invalid proof");
        treeRoots[_index] = _root;
        emit TreeInserted(_leaves, _index, _root);
    }

    function getBatchDepth() public pure returns (uint256) {
        return BATCH_DEPTH;
    }

    function getTreeSize() public pure returns (uint256) {
        return TREE_SIZES;
    }

    function getForestSize() public view returns (uint256) {
        return TREE_SIZES * (treeIndex + 1);
    }

    function getTreeRoot(uint256 index) public view returns (uint256) {
        return treeRoots[index];
    }
}

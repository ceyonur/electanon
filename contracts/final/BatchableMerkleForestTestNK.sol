// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BatchableMerkleForestNK.sol";

contract BatchableMerkleForestTestNK is BatchableMerkleForestNK {
    function insertTreeTest(
        uint256[TREE_SIZES] memory _leaves,
        uint256 _root,
        uint256[2] memory proofA,
        uint256[2][2] memory proofB,
        uint256[2] memory proofC
    ) public {
        insertTree(_leaves, _root, proofA, proofB, proofC);
    }

    function replaceTreeTest(
        uint256 _index,
        uint256[TREE_SIZES] memory _leaves,
        uint256 _root,
        uint256[2] memory proofA,
        uint256[2][2] memory proofB,
        uint256[2] memory proofC
    ) public {
        replaceTree(_index, _leaves, _root, proofA, proofB, proofC);
    }
}

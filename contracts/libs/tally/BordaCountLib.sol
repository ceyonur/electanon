// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {PermutationLib} from "../PermutationLib.sol";

library BordaCountLib {
    //https://rosettacode.org/wiki/Permutations/Rank_of_a_permutation

    function tally(
        uint256 candidateCount,
        uint256 voteRank,
        mapping(uint256 => uint256) storage voteCounts
    ) internal {
        uint256[] memory v = PermutationLib.getPermutation(
            voteRank,
            candidateCount
        );
        for (uint256 i = 0; i < v.length; i++) {
            voteCounts[v[i]] += v.length - i;
        }
    }

    function calculateResult(
        uint256 candidateCount,
        mapping(uint256 => uint256) storage voteCounts
    ) internal view returns (uint256) {
        uint256 max = 0;
        uint256 winner = 0;
        for (uint256 i = 0; i < candidateCount; i++) {
            uint256 voteCount = voteCounts[i];
            if (voteCount > max) {
                max = voteCount;
                winner = i;
            }
        }
        return winner;
    }
}

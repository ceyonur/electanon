// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {PermutationLib} from "../PermutationLib.sol";

library BordaCountV1Lib {
    //https://rosettacode.org/wiki/Permutations/Rank_of_a_permutation

    function tally(
        uint256 candidateCount,
        uint256 voteRank,
        mapping(uint256 => uint256) storage voteCounts
    ) internal {
        voteCounts[voteRank]++;
    }

    function calculateResult(
        uint256 candidateCount,
        mapping(uint256 => uint256) storage voteCounts
    ) internal view returns (uint256) {
        uint256[] memory result = new uint256[](candidateCount + 1);
        for (uint256 i = 0; i < candidateCount; i++) {
            uint256 multiplier = voteCounts[i];
            if (multiplier == 0) {
                continue;
            }
            uint256[] memory votes = PermutationLib.getPermutation(
                i,
                candidateCount
            );
            for (uint256 v = 0; v < votes.length; v++) {
                result[votes[v]] += (votes.length - v) * multiplier;
            }
        }
        uint256 max = 0;
        uint256 winner = 0;
        for (uint256 i = 0; i < result.length; i++) {
            uint256 voteCount = result[i];
            if (voteCount > max) {
                max = voteCount;
                winner = i;
            }
        }
        return winner;
    }
}

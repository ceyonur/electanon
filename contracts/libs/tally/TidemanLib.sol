// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {InsertionSortLib as SortLib} from "../InsertionSortLib.sol";
import {PermutationLib} from "../PermutationLib.sol";

library TidemanLib {
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
        uint256[4][] memory prefs = _getPrefPairs(candidateCount, voteCounts);
        bool[][] memory locked = _getLockedPairs(candidateCount, prefs);
        for (uint256 i = 0; i < candidateCount; i++) {
            bool source = true;
            for (uint256 j = 0; j < candidateCount; j++) {
                if (locked[j + 1][i + 1]) {
                    source = false;
                    break;
                }
            }
            if (source) {
                return i + 1;
            }
        }
        return 0;
    }

    function _checkCycle(
        uint256 from,
        uint256 to,
        uint256 count,
        bool[][] memory locked
    ) private pure returns (bool) {
        if (from == to) {
            return true; // path is present hence cycle is present
        }

        for (uint256 i = 0; i < count; i++) {
            if (
                locked[from][i]
            ) //checking for a path element by element (candidate by candidate)
            {
                return _checkCycle(i, to, count, locked);
            }
        }
        return false; // cycle is not present
    }

    function _getPrefPairs(
        uint256 matrixSize,
        mapping(uint256 => uint256) storage voteCounts
    ) private view returns (uint256[4][] memory) {
        uint256 prefLength = (matrixSize * (matrixSize - 1)) / 2;
        uint256[4][] memory prefs = new uint256[4][](prefLength);
        for (uint256 j = 0; j < matrixSize; j++) {
            uint256 votes = voteCounts[j];
            if (votes == 0) {
                continue;
            }
            uint256 counter = 0;
            uint256[] memory v = PermutationLib.getPermutation(j, matrixSize);
            for (uint256 i = 0; i < matrixSize; i++) {
                for (uint256 k = i + 1; k < matrixSize; k++) {
                    if (prefs[counter][0] == 0) {
                        prefs[counter][0] = i + 1;
                        prefs[counter][1] = k + 1;
                    }
                    if (isFirstInArray(v, i + 1, k + 1)) {
                        prefs[counter][2] += votes;
                    } else {
                        prefs[counter][3] += votes;
                    }
                    counter++;
                }
            }
        }
        return prefs;
    }

    function _getWinningPairs(uint256 matrixSize, uint256[4][] memory prefs)
        private
        pure
        returns (uint256[3][] memory)
    {
        uint256 pairLength = (matrixSize * (matrixSize - 1)) / 2;
        uint256[3][] memory pairWinners = new uint256[3][](pairLength);
        for (uint256 i = 0; i < prefs.length; i++) {
            if (prefs[i][2] > prefs[i][3]) {
                // winner
                pairWinners[i][0] = prefs[i][0];
                // loser
                pairWinners[i][1] = prefs[i][1];
                // point
                pairWinners[i][2] = prefs[i][2];
            } else {
                // winner
                pairWinners[i][0] = prefs[i][1];
                // loser
                pairWinners[i][1] = prefs[i][0];
                // point
                pairWinners[i][2] = prefs[i][3];
            }
        }
        return pairWinners;
    }

    //https://github.com/Federico-abss/CS50-intro-course/blob/master/C/pset3/tideman/tideman.c
    function _getLockedPairs(uint256 matrixSize, uint256[4][] memory prefs)
        private
        pure
        returns (bool[][] memory)
    {
        uint256[3][] memory pairs = _getWinningPairs(matrixSize, prefs);

        uint256[3][] memory sortedPairs = SortLib.sort(pairs);
        bool[][] memory locked = initMultiArray(matrixSize + 1);
        for (uint256 i = 0; i < sortedPairs.length; i++) {
            if (
                !_checkCycle(
                    sortedPairs[i][1],
                    sortedPairs[i][0],
                    matrixSize,
                    locked
                )
            ) {
                locked[sortedPairs[i][0]][sortedPairs[i][1]] = true;
            }
        }
        return locked;
    }

    function initMultiArray(uint256 size)
        private
        pure
        returns (bool[][] memory)
    {
        bool[][] memory result = new bool[][](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = new bool[](size);
        }
        return result;
    }

    function isFirstInArray(
        uint256[] memory data,
        uint256 val1,
        uint256 val2
    ) private pure returns (bool) {
        for (uint256 i = 0; i < data.length; i++) {
            if (data[i] == val1) {
                return true;
            } else if (data[i] == val2) return false;
        }
        return false;
    }
}

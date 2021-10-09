// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {InsertionSortLib as SortLib} from "./InsertionSortLib.sol";

library SimpleResultLib2 {
    //https://rosettacode.org/wiki/Permutations/Rank_of_a_permutation

    function calculateResult(
        uint256 matrixSize,
        uint256[] memory rankIds,
        mapping(uint256 => uint256) storage voteCounts
    ) internal view returns (uint256) {
        uint256[] memory result = new uint256[](matrixSize + 1);
        for (uint256 i = 0; i < rankIds.length; i++) {
            uint256 rankID = rankIds[i];
            uint256 multiplier = voteCounts[rankID];
            uint256[] memory votes = get_permutation(rankID, matrixSize);
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

    function _mr_unrank1(
        uint256 rank,
        uint256 n,
        uint256[] memory vec
    ) private pure {
        uint256 q = 0;
        uint256 r = 0;
        if (n < 1) {
            return;
        }

        q = rank / n;
        r = rank % n;
        (vec[r], vec[n - 1]) = (vec[n - 1], vec[r]);
        _mr_unrank1(q, n - 1, vec);
    }

    function _mr_rank1(
        uint256 n,
        uint256[] memory vec,
        uint256[] memory inv
    ) internal pure returns (uint256) {
        uint256 s = 0;
        if (n < 2) {
            return 0;
        }

        s = vec[n - 1] - 1;
        (vec[n - 1], vec[inv[n - 1] - 1]) = (vec[inv[n - 1] - 1], vec[n - 1]);

        (inv[s], inv[n - 1]) = (inv[n - 1], inv[s]);
        return s + n * _mr_rank1(n - 1, vec, inv);
    }

    function get_permutation(uint256 rank, uint256 size)
        internal
        pure
        returns (uint256[] memory)
    {
        uint256 i;
        uint256[] memory vec = new uint256[](size);
        for (i = 0; i < size; i++) {
            vec[i] = i + 1;
        }
        _mr_unrank1(rank, size, vec);

        return vec;
    }
}

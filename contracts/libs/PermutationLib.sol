// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library PermutationLib {
    function unrank(
        uint256 _rank,
        uint256 n,
        uint256[] memory vec
    ) private pure {
        uint256 q = 0;
        uint256 r = 0;
        if (n < 1) {
            return;
        }

        q = _rank / n;
        r = _rank % n;
        (vec[r], vec[n - 1]) = (vec[n - 1], vec[r]);
        unrank(q, n - 1, vec);
    }

    function getRank(
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
        return s + n * getRank(n - 1, vec, inv);
    }

    function getPermutation(uint256 _rank, uint256 size)
        internal
        pure
        returns (uint256[] memory)
    {
        uint256 i;
        uint256[] memory vec = new uint256[](size);
        for (i = 0; i < size; i++) {
            vec[i] = i + 1;
        }
        unrank(_rank, size, vec);

        return vec;
    }
}

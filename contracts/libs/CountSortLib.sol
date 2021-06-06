// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library CountSortLib {
    // https://medium.com/coinmonks/sorting-in-solidity-without-comparison-4eb47e04ff0d
    function sort(uint256[3][] memory data, uint256 setSize)
        internal
        pure
        returns (uint256[3][] memory)
    {
        uint256 length = data.length;
        uint256[] memory set = new uint256[](setSize);
        uint256[3][] memory result = new uint256[3][](length);
        for (uint256 i = 0; i < length; i++) {
            set[data[i][2]]++;
        }
        for (uint256 i = 1; i < set.length; i++) {
            set[i] += set[i - 1];
        }
        for (uint256 i = 0; i < data.length; i++) {
            uint256 reverse = data.length - i - 1;
            result[set[(data[reverse][2])] - 1] = data[reverse];
            set[data[reverse][2]]--;
        }
        return result;
    }
}

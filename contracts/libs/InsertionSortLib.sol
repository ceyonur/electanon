// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library InsertionSortLib {
    function sort(uint256[3][] memory data)
        internal
        pure
        returns (uint256[3][] memory)
    {
        uint256 length = data.length;
        for (uint256 i = 1; i < length; i++) {
            uint256 key = data[i][2];
            uint256 j = i - 1;
            uint256[3] memory keyRow = data[i];
            while ((j >= 0) && (data[j][2] < key)) {
                data[j + 1] = data[j];
                if (j == 0) {
                    break;
                }
                j--;
            }
            data[j + 1] = keyRow;
        }
        return data;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IveTokenMinter {
    function totalWeight() external returns (uint256);

    function veAssetWeights(address) external returns (uint256);

    function mint(address, uint256) external;

    function burn(address, uint256) external;
}

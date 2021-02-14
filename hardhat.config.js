/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");

module.exports = {
  solidity: "0.7.6",
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "EUR",
    gasPrice: 200,
  },
};

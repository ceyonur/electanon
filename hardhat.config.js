/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");

module.exports = {
  solidity: "0.7.6",
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    showTimeSpent: true,
    coinmarketcap: "b3e6d4ea-901c-4c3d-907f-3df1d2309d4c",
  },
  networks: {
    hardhat: {
      // See its defaults
      accounts: {
        count: 100,
      },
    },
  },
};

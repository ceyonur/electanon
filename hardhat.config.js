/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              orderLiterals: true,
              deduplicate: true,
              cse: true,
              constantOptimizer: true,
            },
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    showTimeSpent: true,
    coinmarketcap: "b3e6d4ea-901c-4c3d-907f-3df1d2309d4c",
    noColors: true,
    rst: true,
  },
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: {
        mnemonic:
          "olive cream peasant lottery ticket basket door toddler reward where boy gravity",
        count: 100,
      },
    },
    hardhat: {
      // See its defaults
      allowUnlimitedContractSize: true,
      accounts: {
        count: 1000,
      },
    },
  },
};

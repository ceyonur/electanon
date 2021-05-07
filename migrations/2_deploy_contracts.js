const PairVoting = artifacts.require("PairVoting");

const moment = require("moment");
const helper = require("../test/utils/helpers.js");

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const MAX_PROPOSAL_COUNT = 4;

module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    try {
      let initialManagers = accounts;
      let contract = await deployer.deploy(
        PairVoting,
        initialManagers,
        5,
        PROPOSAL_LIFETIME,
        VOTING_LIFETIME
      );
      for (let i = 1; i <= 5; i++) {
        await contract.propose("platform" + i, {
          from: accounts[i],
        });
      }
      for (let i = 0; i < 3; i++) {
        await contract.vote([1, 2, 3, 4, 5], {
          from: accounts[i],
        });
      }

      for (let i = 3; i < 5; i++) {
        await contract.vote([2, 1, 4, 5, 3], {
          from: accounts[i],
        });
      }

      for (let i = 5; i < 6; i++) {
        await contract.vote([1, 3, 4, 2, 5], {
          from: accounts[i],
        });
      }

      for (let i = 6; i < 8; i++) {
        await contract.vote([1, 3, 5, 4, 2], {
          from: accounts[i],
        });
      }

      for (let i = 8; i < 10; i++) {
        await contract.vote([2, 3, 5, 4, 1], {
          from: accounts[i],
        });
      }
    } catch (err) {
      console.log(("Failed to Deploy Contracts", err));
    }
  });
};

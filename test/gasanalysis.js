const Platgentract = artifacts.require("Platgentract");
const Ballot = artifacts.require("Ballot");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const proposalCount = 100;
const managerCount = 100;

contract("Platgentract", (accounts) => {
  beforeEach(async () => {
    this.contract = await Platgentract.new(
      accounts.slice(0, managerCount),
      proposalCount,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
  });

  it("should not exceed gas", async () => {
    for (let i = 0; i < proposalCount; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }

    for (let i = 0; i < managerCount; i++) {
      let votes = shuffle(
        Array.from(Array(proposalCount), (x, index) => index + 1)
      );
      await this.contract.vote(votes, {
        from: accounts[i],
      });
    }
  });
});

contract("Ballot", (accounts) => {
  beforeEach(async () => {
    this.contract = await Ballot.new();
  });

  it("should not exceed gas", async () => {
    for (let i = 0; i < proposalCount; i++) {
      await this.contract.propose("platform" + i, {
        from: accounts[i],
      });
    }

    for (let i = 0; i < proposalCount; i++) {
      await this.contract.vote(i, {
        from: accounts[i],
      });
    }
  });
});

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

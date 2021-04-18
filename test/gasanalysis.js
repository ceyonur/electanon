const Platgentract = artifacts.require("Platgentract");
const Ballot = artifacts.require("analysis/Ballot");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();

const proposalCount = Number(process.env.PCOUNT) || 20;
const managerCount = Number(process.env.MCOUNT) || 50;

console.log(
  "ProposalCount: " + proposalCount + ", ManagerCount: " + managerCount
);

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
      await this.contract.vote(managerCount, {
        from: accounts[i],
      });
    }
    const result = await this.contract.electionResult.estimateGas();
    console.log("Election Result estimated Gas: " + result);
    //expect(result.toNumber()).to.greaterThan(0);
  });
});

contract("Ballot", (accounts) => {
  beforeEach(async () => {
    this.contract = await Ballot.new(accounts.slice(0, managerCount));
  });

  it("should not exceed gas", async () => {
    for (let i = 0; i < proposalCount; i++) {
      await this.contract.propose("platform" + i, {
        from: accounts[i],
      });
    }

    for (let i = 0; i < managerCount; i++) {
      await this.contract.vote(getRandom(proposalCount), {
        from: accounts[i],
      });
    }
  });
});

function getRandom(proposalCt) {
  return Math.floor(Math.random() * Number(proposalCt));
}

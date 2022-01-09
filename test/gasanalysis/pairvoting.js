const PairVoting = artifacts.require("PairVoting");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();

const proposalCount = Number(process.env.PCOUNT) || 20;
const voterCount = Number(process.env.VCOUNT) || 50;

contract("PairVoting", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });

  it("should not exceed gas", async () => {
    this.contract = await PairVoting.new(
      proposalCount,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
    for (let i = 0; i < voterCount; i++) {
      this.contract.addManager(accounts[i], {
        from: accounts[0],
      });
    }

    this.contract.toProposalState({
      from: accounts[0],
    });

    for (let i = 0; i < proposalCount; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    for (let i = 0; i < voterCount; i++) {
      await this.contract.vote(i, {
        from: accounts[i],
      });
    }
    const result = await this.contract.electionResult.estimateGas();
    console.log("Election Result estimated Gas: " + result);
    console.log("Election Result " + (await this.contract.electionResult()));
    //expect(result.toNumber()).to.greaterThan(0);
  }).timeout(0);
});

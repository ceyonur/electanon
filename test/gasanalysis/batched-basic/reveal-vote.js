const ZKPrivatePairVotingBasic = artifacts.require("ZKPrivatePairVotingBasic");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const PASSWORD = "password";

const { passwordToSalt } = require("libsemaphore");

const proposalCount = Number(process.env.PCOUNT) || 10;
const voterCount = Number(process.env.VCOUNT) || 100;
const address = String(process.env.ADDRESS) || "";

contract("ZK Private PairVoting", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });
  beforeEach(async () => {
    this.contract = await ZKPrivatePairVotingBasic.at(address);
  });

  it("should reveal and vote", async () => {
    for (let i = 0; i < voterCount; i++) {
      let password32 = passwordToSalt(PASSWORD + i);
      await this.contract.revealVote(i, password32, {
        from: accounts[i],
      });
    }
    const result = await this.contract.electionResult.estimateGas();
    console.log("Election Result estimated Gas: " + result);
    //expect(result.toNumber()).to.greaterThan(0);
  }).timeout(0);
});

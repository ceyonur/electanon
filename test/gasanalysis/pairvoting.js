const PairVoting = artifacts.require("PairVoting");
const Ballot = artifacts.require("analysis/Ballot");

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
      accounts.slice(0, voterCount),
      proposalCount,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
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

// contract("Ballot", (accounts) => {
//   beforeEach(async () => {
//     this.contract = await Ballot.new(accounts.slice(0, voterCount));
//   });

//   it("should not exceed gas", async () => {
//     for (let i = 0; i < proposalCount; i++) {
//       await this.contract.propose("platform" + i, {
//         from: accounts[i],
//       });
//     }

//     for (let i = 0; i < voterCount; i++) {
//       await this.contract.vote(getRandom(proposalCount), {
//         from: accounts[i],
//       });
//     }
//   });
// });

function getRandom(proposalCt) {
  return Math.floor(Math.random() * Number(proposalCt));
}

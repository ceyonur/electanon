const ElectAnon = artifacts.require("ElectAnonAst");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const expect = chai.expect;
chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const COMMIT_LIFETIME = moment.duration(30, "days").asSeconds();
const REVEAL_LIFETIME = moment.duration(30, "days").asSeconds();
const { setupProposals, setupProposers } = require("../../utils/helpers");

const proposalCount = Number(process.env.PCOUNT) || 10;
const voterCount = Number(process.env.VCOUNT) || 10;

contract("ZK Private PairVoting", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });
  it("should setup", async () => {
    this.contract = await ElectAnon.new(
      proposalCount,
      PROPOSAL_LIFETIME,
      COMMIT_LIFETIME,
      REVEAL_LIFETIME
    );
    console.log(this.contract.address);
    await setupVotersAst(voterCount, this.owner, this.contract);
    let leavesNum = await this.contract.getLeavesNum();
    expect(leavesNum.toString()).equals(voterCount.toString());

    await setupProposers(
      this.owner,
      accounts.slice(0, proposalCount),
      this.contract
    );

    await setupProposals(this.contract, accounts, proposalCount);
  }).timeout(0);
});

async function setupVotersAst(number, sender, contract, batchSize = number) {
  if (number < batchSize) {
    batchSize = number;
  }
  // for (let n = 0; n < number; n++) {
  //   let identity = genStaticIdentity(n);
  //   let identityCommitment = genIdentityCommitment(identity);
  //   idCommits.push(identityCommitment.toString());
  // }
  // let tree = await genTree(level, idCommits);
  // // this is for reducing construction of huge trees
  // let root = await tree.root();
  let round = number / batchSize;
  for (let r = 0; r < round; r++) {
    await contract.addVoters(Math.floor(Math.random() * 1000000000), number, {
      from: sender,
    });
  }
}

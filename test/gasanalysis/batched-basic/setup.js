const ZKPrivatePairVotingBasic = artifacts.require("ZKPrivatePairVotingBasic");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { genPathElementsAndIndex } = require("libsemaphore");
const moment = require("moment");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const expect = chai.expect;
chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const COMMIT_LIFETIME = moment.duration(30, "days").asSeconds();
const REVEAL_LIFETIME = moment.duration(30, "days").asSeconds();
const TREE_LEVEL = 20;
const {
  setupProposals,
  setupProposers,
  setupVotersStatic,
} = require("../../utils/helpers");

const proposalCount = Number(process.env.PCOUNT) || 10;
const voterCount = Number(process.env.VCOUNT) || 10;

contract("ZK Private PairVoting", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });
  it("should setup", async () => {
    this.contract = await ZKPrivatePairVotingBasic.new(
      TREE_LEVEL,
      proposalCount,
      PROPOSAL_LIFETIME,
      COMMIT_LIFETIME,
      REVEAL_LIFETIME
    );
    console.log(this.contract.address);
    let result = await setupVotersStatic(voterCount, this.owner, this.contract);
    let idCommits = result.idCommits;
    let tree = result.tree;
    expect(idCommits).to.be.an("array").that.has.lengthOf(voterCount);
    let leavesNum = await this.contract.getLeavesNum();
    expect(leavesNum.toString()).equals(voterCount.toString());

    await setupProposers(
      this.owner,
      accounts.slice(0, proposalCount),
      this.contract
    );

    await setupProposals(this.contract, accounts, proposalCount);

    // write to file
    const fs = require("fs");
    let treeJson = [];
    for (let i = 0; i < idCommits.length; i++) {
      const { identityPathElements, identityPathIndex } =
        await genPathElementsAndIndex(tree, idCommits[i]);
      treeJson[i] = {
        elements: identityPathElements,
        index: identityPathIndex,
      };
    }
    const treeJsonContent = JSON.stringify(treeJson);

    fs.writeFile("./tree.json", treeJsonContent, "utf8", function (err) {
      if (err) {
        return console.log(err);
      }
    });
  }).timeout(0);
});

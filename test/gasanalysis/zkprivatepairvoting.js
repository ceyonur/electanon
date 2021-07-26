const ZKPrivatePairVoting = artifacts.require("ZKPrivatePairVoting");
const Ballot = artifacts.require("analysis/Ballot");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const COMMIT_LIFETIME = moment.duration(30, "days").asSeconds();
const REVEAL_LIFETIME = moment.duration(30, "days").asSeconds();
const TREE_LEVEL = 20;
const PASSWORD = "password";
const {
  setupProposals,
  setupVoters,
  setupProposers,
  setupZKParamsPrivate,
} = require("../utils/helpers");

const { genCircuit, passwordToSalt } = require("libsemaphore");

const path = require("path");
const fs = require("fs");
const circuitPath = path.join(
  __dirname,
  "../../circuits/semaphore/build/circuit.json"
);
const provingKeyPath = path.join(
  __dirname,
  "../../circuits/semaphore/build/proving_key.bin"
);

const cirDef = JSON.parse(fs.readFileSync(circuitPath).toString());
const provingKey = fs.readFileSync(provingKeyPath);
const circuit = genCircuit(cirDef);

const proposalCount = Number(process.env.PCOUNT) || 10;
const voterCount = Number(process.env.VCOUNT) || 10;

contract("ZK Private PairVoting", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });
  beforeEach(async () => {
    this.contract = await ZKPrivatePairVoting.new(
      TREE_LEVEL,
      proposalCount,
      PROPOSAL_LIFETIME,
      COMMIT_LIFETIME,
      REVEAL_LIFETIME
    );
    this.ids = await setupVoters(voterCount, this.owner, this.contract);
    this.leaves = await this.contract.getLeaves();
    this.numLevel = await this.contract.getTreeLevel();
    this.extNullifier = await this.contract.getActiveExternalNullifier();
  });

  it("should not exceed gas", async () => {
    await setupProposers(
      this.owner,
      accounts.slice(0, proposalCount),
      this.contract
    );
    await setupProposals(this.contract, accounts, proposalCount);
    let votes = [];
    for (let i = 0; i < voterCount; i++) {
      let vote = await votePrivate(
        i,
        PASSWORD + i,
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
      votes[i] = vote;
    }
    for (let i = 0; i < voterCount; i++) {
      let password32 = passwordToSalt(PASSWORD + i);
      await this.contract.revealVote(votes[i], password32, {
        from: accounts[i],
      });
    }
    const result = await this.contract.electionResult.estimateGas();
    console.log("Election Result estimated Gas: " + result);
    //expect(result.toNumber()).to.greaterThan(0);
  }).timeout(0);
});

contract("Ballot", (accounts) => {
  beforeEach(async () => {
    this.contract = await Ballot.new(accounts.slice(0, voterCount));
  });

  it("should not exceed gas", async () => {
    for (let i = 0; i < proposalCount; i++) {
      await this.contract.propose("platform" + i, {
        from: accounts[i],
      });
    }

    for (let i = 0; i < voterCount; i++) {
      await this.contract.vote(getRandom(proposalCount), {
        from: accounts[i],
      });
    }
  });
});

function getRandom(proposalCt) {
  return Math.floor(Math.random() * Number(proposalCt));
}

async function votePrivate(
  rank,
  password,
  sender,
  contract,
  id,
  leaves,
  numLevel,
  extNullifier,
  circuit,
  provingKey
) {
  let params = await setupZKParamsPrivate(
    rank,
    password,
    id,
    leaves,
    numLevel,
    extNullifier,
    circuit,
    provingKey
  );
  await contract.commitVote(
    params.signal,
    params.proof,
    params.nullifiersHash,
    {
      from: sender,
    }
  );
  return rank;
}

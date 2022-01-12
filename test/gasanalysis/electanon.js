const ElectAnon = artifacts.require("ElectAnon");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const COMMIT_LIFETIME = moment.duration(30, "days").asSeconds();
const REVEAL_LIFETIME = moment.duration(30, "days").asSeconds();
const PASSWORD = "password";
const {
  setupProposals,
  setupProposers,
  setupZKParamsPrivate,
  setupVotersStatic,
} = require("../utils/helpers");

const {
  genCircuit,
  passwordToSalt,
  genStaticIdentity,
} = require("libsemaphore");

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

contract("ElectAnon gas analysis", (accounts) => {
  before(() => {
    console.log(
      "ProposalCount: " + proposalCount + ", VoterCount: " + voterCount
    );
  });

  it("should not exceed gas", async () => {
    this.contract = await ElectAnon.new(
      proposalCount,
      PROPOSAL_LIFETIME,
      COMMIT_LIFETIME,
      REVEAL_LIFETIME
    );
    let result = await setupVotersStatic(voterCount, this.owner, this.contract);
    this.ids = result.ids;
    this.leaves = result.idCommits;
    this.numLevel = await this.contract.getTreeLevel();
    this.extNullifier = await this.contract.getActiveExternalNullifier();
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
        genStaticIdentity(i),
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
    const gasResult = await this.contract.electionResult.estimateGas();
    console.log("Election Result estimated Gas: " + gasResult);
    //chai.expect(result.toNumber()).to.greaterThan(0);
  }).timeout(0);
});

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

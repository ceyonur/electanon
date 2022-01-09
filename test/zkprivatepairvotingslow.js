const ZKPrivatePairVoting = artifacts.require("ZKPrivatePairVoting");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

const expect = chai.expect;
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
  voteWithArrayPrivate,
} = require("../../utils/helpers");

const { genCircuit, passwordToSalt } = require("libsemaphore");

const path = require("path");
const fs = require("fs");
const circuitPath = path.join(
  __dirname,
  "../../../circuits/semaphore/build/circuit.json"
);
const provingKeyPath = path.join(
  __dirname,
  "../../../circuits/semaphore/build/proving_key.bin"
);

const cirDef = JSON.parse(fs.readFileSync(circuitPath).toString());
const provingKey = fs.readFileSync(provingKeyPath);
const circuit = genCircuit(cirDef);

contract("ZKPrivatePairVoting election result", (accounts) => {
  before(async () => {
    this.owner = accounts[0];
    this.contract = await ZKPrivatePairVoting.new(
      TREE_LEVEL,
      5,
      PROPOSAL_LIFETIME,
      COMMIT_LIFETIME,
      REVEAL_LIFETIME,
      {
        from: this.owner,
      }
    );
    this.ids = await setupVoters(10, this.owner, this.contract);
    await setupProposers(this.owner, accounts.slice(0, 5), this.contract);
    await setupProposals(this.contract, accounts, 5);
    this.leaves = await this.contract.getLeaves();
    this.numLevel = await this.contract.getTreeLevel();
    this.extNullifier = await this.contract.getActiveExternalNullifier();
  });
  it("should be able to announce election result correctly", async () => {
    let votes = [];
    for (let i = 0; i < 3; i++) {
      let vote = await voteWithArrayPrivate(
        [1, 2, 3, 4, 5],
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

    for (let i = 3; i < 5; i++) {
      let vote = await voteWithArrayPrivate(
        [2, 1, 4, 5, 3],
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

    for (let i = 5; i < 6; i++) {
      let vote = await voteWithArrayPrivate(
        [2, 3, 4, 1, 5],
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

    for (let i = 6; i < 8; i++) {
      let vote = await voteWithArrayPrivate(
        [2, 3, 5, 4, 1],
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

    for (let i = 8; i < 10; i++) {
      let vote = await voteWithArrayPrivate(
        [2, 3, 5, 4, 1],
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

    for (let i = 0; i < 10; i++) {
      let password32 = passwordToSalt(PASSWORD + i);
      await this.contract.revealVote(votes[i], password32, {
        from: accounts[i],
      });
    }

    const result = await this.contract.electionResult.call();
    expect(result.toNumber()).to.equal(2);
  }).timeout(0);
});

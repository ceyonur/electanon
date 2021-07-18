const ZKPairVoting = artifacts.require("ZKPairVoting");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const TREE_LEVEL = 20;
const {
  voteWithArray,
  setupProposals,
  setupVoters,
  setupProposers,
  advanceTimeAndBlock,
} = require("../../utils/helpers");

const path = require("path");
const fs = require("fs");
const { genCircuit } = require("libsemaphore");
const circuitPath = path.join(
  __dirname,
  "../../../circuits/build/circom/circuit.json"
);
const provingKeyPath = path.join(
  __dirname,
  "../../../circuits/build/circom/proving_key.bin"
);

const cirDef = JSON.parse(fs.readFileSync(circuitPath).toString());
const provingKey = fs.readFileSync(provingKeyPath);
const circuit = genCircuit(cirDef);

contract("ZKPairVoting election result", (accounts) => {
  before(async () => {
    this.owner = accounts[0];
    this.contract = await ZKPairVoting.new(
      TREE_LEVEL,
      5,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME,
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
    for (let i = 0; i < 3; i++) {
      await voteWithArray(
        [1, 2, 3, 4, 5],
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
    }

    for (let i = 3; i < 5; i++) {
      await voteWithArray(
        [2, 1, 4, 5, 3],
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
    }

    for (let i = 5; i < 6; i++) {
      await voteWithArray(
        [2, 3, 4, 1, 5],
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
    }

    for (let i = 6; i < 8; i++) {
      await voteWithArray(
        [2, 3, 5, 4, 1],
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
    }

    for (let i = 8; i < 10; i++) {
      await voteWithArray(
        [2, 3, 5, 4, 1],
        accounts[i],
        this.contract,
        this.ids[i],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
    }

    await advanceTimeAndBlock(VOTING_LIFETIME + 60);
    const result = await this.contract.electionResult.call();
    expect(result.toNumber()).to.equal(2);
  }).timeout(0);
});

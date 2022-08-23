const ElectAnon = artifacts.require("ElectAnon");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const PASSWORD = "password";

const {
  genCircuit,
  genStaticIdentity,
  genPrivateVoteWitnessEff,
  genProof,
  genPublicSignals,
  genVoteSignalParams,
} = require("libsemaphore");

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

const round = Number(process.env.VROUND);
const batchSize = Number(process.env.BSIZE) || 10;
const address = String(process.env.ADDRESS) || "";

const treeJson = require("../../scripts/tree.json");

contract("ZK Private PairVoting", (accounts) => {
  before(() => {
    console.log(", Round: " + round + ", BatchSize: " + batchSize);
  });
  beforeEach(async () => {
    this.contract = await ElectAnon.at(address);
    this.numLevel = await this.contract.getTreeLevel();
    this.extNullifier = await this.contract.getActiveExternalNullifier();
  });

  it("should reveal and vote", async () => {
    for (let i = 0; i < batchSize; i++) {
      let roundIndex = i + round * batchSize;
      let identity = genStaticIdentity(roundIndex);
      let pathElements = treeJson[roundIndex].elements;
      let pathIndex = treeJson[roundIndex].index;
      try {
        await votePrivate(
          roundIndex,
          PASSWORD + roundIndex,
          accounts[roundIndex],
          this.contract,
          identity,
          this.numLevel,
          this.extNullifier,
          circuit,
          provingKey,
          pathElements,
          pathIndex
        );
      } catch (error) {
        console.log(error);
        continue;
      }
    }
  }).timeout(0);
});

async function votePrivate(
  vote,
  password,
  sender,
  contract,
  identity,
  numLevel,
  extNullifier,
  circuit,
  provingKey,
  identityPathElements,
  identityPathIndex
) {
  const result = await genPrivateVoteWitnessEff(
    vote,
    password,
    circuit,
    identity,
    identityPathElements,
    identityPathIndex,
    extNullifier
  );

  let proof = await genProof(result.witness, provingKey);
  let publicSignals = await genPublicSignals(result.witness, circuit);
  let params = await genVoteSignalParams(result, proof, publicSignals);

  await contract.commitVote(
    params.signal,
    params.proof,
    params.nullifiersHash,
    {
      from: sender,
    }
  );
  return vote;
}

const BatchableMerkleForest = artifacts.require(
  "semaphore/optimized/BatchableMerkleForest"
);

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const path = require("path");
const fs = require("fs");
const truffleAssert = require("truffle-assertions");

const { genIdentity, genIdentityCommitment, genTree } = require("libsemaphore");

const { initialize } = require("zokrates-js/node");

const outFile = path.join(__dirname, "../../../circuits/zk-mt/build/out");
const jsonAbiFile = path.join(
  __dirname,
  "../../../circuits/zk-mt/build/abi.json"
);
const provingKeyFile = path.join(
  __dirname,
  "../../../circuits/zk-mt/build/proving.key"
);

const verificationKeyFile = path.join(
  __dirname,
  "../../../circuits/zk-mt/build/verification.key"
);

let batchableMerkleForest;
let zokratesProvider;
let mtRoot;
let witness;
let identityBatch = [];
let program;
let proof;
contract("BatchableMerkleForest", (accounts) => {
  before(async () => {
    console.log("Deploying Contract");
    zokratesProvider = await initialize();
    batchableMerkleForest = await BatchableMerkleForest.new({
      from: accounts[0],
    });
  });

  it("generates witness for commitment batch", async () => {
    let batchDepth = await batchableMerkleForest.getBatchDepth();
    let treeSize = await batchableMerkleForest.getTreeSize();
    for (let i = 0; i < treeSize; i++) {
      const identity = genIdentity();
      const identityCommitment = genIdentityCommitment(identity);
      identityBatch.push(identityCommitment.toString());
    }

    let tree = await genTree(batchDepth, identityBatch);
    let root = await tree.root();

    program = fs.readFileSync(outFile);
    const jsonAbi = fs.readFileSync(jsonAbiFile).toString();
    const artifacts = { program: program, abi: jsonAbi };
    let result = zokratesProvider.computeWitness(artifacts, [identityBatch]);
    witness = result.witness;
    let output = result.output;
    mtRoot = JSON.parse(output)[0];
    expect(mtRoot).to.be.equal(root);
  });

  it("generates valid proof for commitment batch", async () => {
    const provingKey = fs.readFileSync(provingKeyFile);
    proof = zokratesProvider.generateProof(program, witness, provingKey);
    const verificationKey = JSON.parse(fs.readFileSync(verificationKeyFile));

    let result = zokratesProvider.verify(verificationKey, proof);
    expect(result).to.be.true;
  }).timeout(0);

  it("inserts tree to contract", async () => {
    let innerProof = proof.proof;
    const tx = await batchableMerkleForest.insertTree(
      identityBatch,
      mtRoot,
      innerProof.a,
      innerProof.b,
      innerProof.c
    );
    truffleAssert.eventEmitted(tx, "TreeInserted", (ev) => {
      return (
        expect(ev.treeIndex.toString()).to.be.equal("1") &&
        expect(ev.treeRoot.toString()).to.be.equal(mtRoot.toString())
      );
    });
  });
});

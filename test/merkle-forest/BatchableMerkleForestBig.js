// const BatchableMerkleForest = artifacts.require(
//   "final/BatchableMerkleForestTest"
// );

// const chai = require("chai");
// const chaiAsPromised = require("chai-as-promised");
// const expect = chai.expect;

// chai.use(chaiAsPromised);
// chai.use(require("chai-string"));

// const path = require("path");
// const fs = require("fs");
// const truffleAssert = require("truffle-assertions");

// const { genTree } = require("libsemaphore");

// const { initialize } = require("zokrates-js/node");

// const verificationKeyFile = path.join(
//   __dirname,
//   "../../circuits/zk-mt/build/verification.key"
// );

// const proofFile = path.join(__dirname, "../../circuits/zk-mt/build/proof.json");

// let batchableMerkleForest;
// let zokratesProvider;
// let mtRoot;
// let identityBatch = [];
// let proof;
// contract("BatchableMerkleForest", (accounts) => {
//   before(async () => {
//     console.log("Deploying Contract");
//     zokratesProvider = await initialize();
//     batchableMerkleForest = await BatchableMerkleForest.new({
//       from: accounts[0],
//     });
//   });

//   it("read valid proof for commitment batch", async () => {
//     let batchDepth = await batchableMerkleForest.getBatchDepth();
//     let treeSize = await batchableMerkleForest.getTreeSize();
//     proof = JSON.parse(fs.readFileSync(proofFile));
//     for (let i = 0; i < treeSize; i++) {
//       const identityCommitment = i + 1;
//       identityBatch.push(identityCommitment.toString());
//     }

//     let tree = await genTree(batchDepth, identityBatch);
//     let root = await tree.root();

//     mtRoot = web3.utils.hexToNumberString(proof.inputs[0]);

//     expect(mtRoot).to.be.equal(root);
//     const verificationKey = JSON.parse(fs.readFileSync(verificationKeyFile));
//     let result = zokratesProvider.verify(verificationKey, proof);
//     expect(result).to.be.true;
//   }).timeout(0);

//   it("inserts tree to contract", async () => {
//     let innerProof = proof.proof;
//     const tx = await batchableMerkleForest.insertTreeTest(
//       identityBatch,
//       mtRoot,
//       innerProof.a,
//       innerProof.b,
//       innerProof.c
//     );
//     truffleAssert.eventEmitted(tx, "TreeInserted", (ev) => {
//       return (
//         expect(ev.treeIndex.toString()).to.be.equal("1") &&
//         expect(ev.treeRoot.toString()).to.be.equal(mtRoot.toString())
//       );
//     });
//   });

//   it("replace tree to contract", async () => {
//     let newIdentityBatch = [];
//     let batchDepth = await batchableMerkleForest.getBatchDepth();
//     let treeSize = await batchableMerkleForest.getTreeSize();
//     for (let i = 0; i < treeSize; i++) {
//       const identityCommitment = i + treeSize + 2;
//       newIdentityBatch.push(identityCommitment.toString());
//     }
//     let innerProof = proof.proof;
//     const tx = await batchableMerkleForest.insertTreeTest(
//       identityBatch,
//       mtRoot,
//       innerProof.a,
//       innerProof.b,
//       innerProof.c
//     );
//     truffleAssert.eventEmitted(tx, "TreeInserted", (ev) => {
//       return (
//         expect(ev.treeIndex.toString()).to.be.equal("1") &&
//         expect(ev.treeRoot.toString()).to.be.equal(mtRoot.toString())
//       );
//     });
//   });
// });

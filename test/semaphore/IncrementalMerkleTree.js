const MiMC = artifacts.require("semaphore/MiMC");
const IncrementalMerkleTreeClient = artifacts.require(
  "semaphore/IncrementalMerkleTreeClient"
);

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

let mtContract;
let mimcContract;
const {
  genIdentity,
  genIdentityCommitment,
  setupTree,
} = require("libsemaphore");

const LEVELS = 20;
let tree;

const ZERO_VALUE = web3.utils.keccak256("Semaphore");

contract("IncrementalMerkleTree ", () => {
  before(async () => {
    tree = setupTree(LEVELS);

    console.log("Deploying MiMC");
    mimcContract = await MiMC.new();
    await IncrementalMerkleTreeClient.link(mimcContract);
  });

  it("deploys with success", async () => {
    console.log("Deploying IncrementalMerkleTreeClient");

    mtContract = await IncrementalMerkleTreeClient.new(LEVELS, ZERO_VALUE);

    const root = await mtContract.root();
    const root2 = await tree.root();
    expect(root.toString()).equal(root2);
  });

  it("should fail if the specified number of levels is 0", async () => {
    try {
      await IncrementalMerkleTreeClient.new(0, ZERO_VALUE);
    } catch (e) {
      expect(
        e.message)to.endsWith(
          "IncrementalMerkleTree: _treeLevels must be between 0 and 33"
        )
      );
    }
  });

  it("initMerkleTree should fail if the specified number of levels exceeds 32", async () => {
    try {
      await IncrementalMerkleTreeClient.new(33, ZERO_VALUE);
    } catch (e) {
      expect(
        e.message)to.endsWith(
          "IncrementalMerkleTree: _treeLevels must be between 0 and 33"
        )
      );
    }
  });

  it("insertLeaf should fail if the leaf > the snark scalar field", async () => {
    const leaf =
      "21888242871839275222246405745257275088548364400416034343698204186575808495618";
    try {
      await mtContract.insertLeafAsClient(leaf);
    } catch (e) {
      expect(
        e.message)to.endsWith(
          "IncrementalMerkleTree: insertLeaf argument must be < SNARK_SCALAR_FIELD"
        )
      );
    }
  });

  it("insertLeaf (via insertLeafAsClient)", async () => {
    const leaf = genIdentityCommitment(genIdentity()).toString();
    const tx = await mtContract.insertLeafAsClient(leaf);
    const receipt = tx.receipt;

    console.log("Gas used by insertLeaf:", receipt.gasUsed.toString());
    await tree.update(0, leaf);

    const root = await mtContract.root();
    const root2 = await tree.root();
    expect(root.toString()).equal(root2);
  });

  it("inserting a few leaves should work", async () => {
    for (let i = 1; i < 9; i++) {
      const leaf = genIdentityCommitment(genIdentity()).toString();
      await mtContract.insertLeafAsClient(leaf);

      await tree.update(i, leaf);

      const root = await mtContract.root();
      const root2 = await tree.root();
      expect(root.toString()).equal(root2);
    }
  });
});

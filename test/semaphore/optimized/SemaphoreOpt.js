const SemaphoreOptTest = artifacts.require(
  "semaphore/optimized/SemaphoreOptTest"
);

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;
const truffleAssert = require("truffle-assertions");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const {
  genIdentity,
  genIdentityCommitment,
  genTree,
  genVoteWitness,
  genCircuit,
  genProof,
  genPublicSignals,
  verifyProof,
  parseVerifyingKeyJson,
  genBroadcastSignalParams,
  genSignalHash,
  genExternalNullifier,
  genVoterSignal,
  genVoteSignalParams,
} = require("libsemaphore");

const path = require("path");
const fs = require("fs");

const NUM_LEVELS = 20;
const VOTE = 1;
const SIGNAL = genVoterSignal(VOTE);

contract("SemaphoreOpt", (accounts) => {
  let semaphoreContract;

  // hex representations of all inserted identity commitments
  let insertedIdentityCommitments = [];
  let externalNullifier;
  before(async () => {
    console.log("Deploying Semaphore");
    semaphoreContract = await SemaphoreOptTest.new(NUM_LEVELS, {
      from: accounts[0],
    });
    externalNullifier = await semaphoreContract.getActiveExternalNullifier();
  });

  it("Semaphore belongs to the correct owner", async () => {
    const owner = await semaphoreContract.owner();
    expect(owner).equal(accounts[0]);
  });

  it("insert an identity commitment", async () => {
    const identity = genIdentity();
    const identityCommitment = genIdentityCommitment(identity);

    let level = await semaphoreContract.getTreeLevel();
    let tree = await genTree(level, [identityCommitment.toString()]);
    let root = await tree.root();

    const tx = await semaphoreContract.addIdCommitment(
      identityCommitment.toString(),
      root
    );
    const receipt = tx.receipt;
    expect(receipt.status).to.be.true;

    const numInserted = await semaphoreContract.getLeavesNum();
    expect(numInserted.toString()).equal("1");

    console.log(
      "Gas used by insertIdentityAsClient():",
      receipt.gasUsed.toString()
    );
    insertedIdentityCommitments.push("0x" + identityCommitment.toString(16));
  });

  it("insert multiple identity commitments", async () => {
    identities = [];
    identityCommitments = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const identity = genIdentity();
      const identityCommitment = genIdentityCommitment(identity);
      identities.push(identity);
      identityCommitments.push(identityCommitment.toString());
      insertedIdentityCommitments.push("0x" + identityCommitment.toString(16));
    }

    let level = await semaphoreContract.getTreeLevel();
    let tree = await genTree(level, identityCommitments);
    let root = await tree.root();

    const tx = await semaphoreContract.addIdCommitments(
      identityCommitments,
      root
    );
    const receipt = tx.receipt;
    expect(receipt.status).to.be.true;

    const numInserted = await semaphoreContract.getLeavesNum();
    expect(numInserted.toString()).equal((count + 1).toString());

    console.log(
      "Gas used by insertIdentityAsClient():",
      receipt.gasUsed.toString()
    );
  });

  describe("identity insertions", () => {
    it("should be stored in the contract and retrievable via leaves()", async () => {
      const leaves = await semaphoreContract.getLeaves();
      expect(leaves.length).equal(insertedIdentityCommitments.length);

      const leavesHex = leaves.map(BigInt);

      for (let i = 0; i < insertedIdentityCommitments.length; i++) {
        const containsLeaf =
          leavesHex.indexOf(BigInt(insertedIdentityCommitments[i])) > -1;
        expect(containsLeaf).to.be.true;
      }
    });

    it("should be stored in the contract and retrievable by enumerating leaf()", async () => {
      // Assumes that insertedIdentityCommitments has the same number of
      // elements as the number of leaves
      const idCommsBigint = insertedIdentityCommitments.map(BigInt);
      for (let i = 0; i < insertedIdentityCommitments.length; i++) {
        const leaf = await semaphoreContract.getLeaf(i);
        const leafHex = BigInt("0x" + leaf.toString(16));
        expect(idCommsBigint.indexOf(leafHex) > -1).to.be.true;
      }
    });
  });

  describe("external nullifiers", () => {
    it("should assign address contract as extNullifier", async () => {
      // let extNullifier = await semaphoreContract.getActiveExternalNullifier();
      // expect(extNullifier.toString(16)).to.be.equal(activeEn);
      const isActive = await semaphoreContract.isExternalNullifierActive(
        externalNullifier
      );
      expect(isActive).to.be.true;
    });
  });
});

contract("signal broadcasts", (accounts) => {
  // Load circuit, proving key, and verifying key
  const circuitPath = path.join(__dirname, "../../../circuits/circuit.json");
  const provingKeyPath = path.join(
    __dirname,
    "../../../circuits/proving_key.bin"
  );
  const verifyingKeyPath = path.join(
    __dirname,
    "../../../circuits/verification_key.json"
  );

  const cirDef = JSON.parse(fs.readFileSync(circuitPath).toString());
  const provingKey = fs.readFileSync(provingKeyPath);
  const verifyingKey = parseVerifyingKeyJson(
    fs.readFileSync(verifyingKeyPath).toString()
  );
  const circuit = genCircuit(cirDef);
  let identity;
  let identityCommitment;
  let proof;
  let publicSignals;
  let params;
  let semaphoreContract;

  // hex representations of all inserted identity commitments
  let externalNullifier;

  before(async () => {
    console.log("Deploying Semaphore");
    semaphoreContract = await SemaphoreOptTest.new(NUM_LEVELS, {
      from: accounts[0],
    });
    externalNullifier = await semaphoreContract.getActiveExternalNullifier();

    console.log("Generating Identity");
    identity = genIdentity();
    identityCommitment = genIdentityCommitment(identity);
    let level = await semaphoreContract.getTreeLevel();
    let tree = await genTree(level, [identityCommitment.toString()]);
    let root = await tree.root();

    await semaphoreContract.addIdCommitment(
      identityCommitment.toString(),
      root
    );

    let leaves = await semaphoreContract.getLeaves();
    console.log("Generating Witness");
    const result = await genVoteWitness(
      VOTE,
      circuit,
      identity,
      leaves,
      NUM_LEVELS,
      externalNullifier
    );
    console.log("Generating Proof");
    proof = await genProof(result.witness, provingKey);
    publicSignals = genPublicSignals(result.witness, circuit);
    params = genVoteSignalParams(result, proof, publicSignals);
  });

  it("the proof should be valid", async () => {
    const isValid = verifyProof(verifyingKey, proof, publicSignals);
    expect(isValid).to.be.true;
  });

  it("the pre-broadcast check should pass", async () => {
    const check = await semaphoreContract.preBroadcastCheck(
      params.signal,
      params.proof,
      params.nullifiersHash,
      genSignalHash(params.signal).toString()
    );
    expect(check).to.be.true;
  });

  it("the pre-broadcast check with an invalid signal should fail", async () => {
    const check = await semaphoreContract.preBroadcastCheck(
      "0x0",
      params.proof,
      params.nullifiersHash,
      genSignalHash(params.signal).toString()
    );
    expect(check).to.be.false;
  });

  it("broadcastSignal with an input element above the scalar field should fail", async () => {
    const size = BigInt(
      "21888242871839275222246405745257275088548364400416034343698204186575808495617"
    );
    const oversizedInput = (BigInt(params.nullifiersHash) + size).toString();
    try {
      await semaphoreContract.broadcastSignalTest(
        params.signal,
        params.proof,
        oversizedInput
      );
    } catch (e) {
      expect(e.message).endsWith(
        "Semaphore: the nullifiers hash must be lt the snark scalar field"
      );
    }
  });

  it("broadcastSignal with an invalid proof_data should fail", async () => {
    try {
      await semaphoreContract.broadcastSignalTest(
        params.signal,
        [
          "21888242871839275222246405745257275088548364400416034343698204186575808495617",
          "7",
          "7",
          "7",
          "7",
          "7",
          "7",
          "7",
        ],
        params.nullifiersHash
      );
    } catch (e) {
      expect(e.message).endsWith(
        "Semaphore: invalid field element(s) in proof"
      );
    }
  });

  it("broadcastSignal to active external nullifier with an account with the right permissions should work", async () => {
    const tx = await semaphoreContract.broadcastSignalTest(
      params.signal,
      params.proof,
      params.nullifiersHash,
      { gas: 1000000 }
    );
    const receipt = tx.receipt;
    expect(receipt.status).to.be.true;
    console.log(
      "Gas used by broadcastSignalTest():",
      receipt.gasUsed.toString()
    );

    const index = (await semaphoreContract.nextSignalIndex()) - 1;
    const signal = await semaphoreContract.signalIndexToSignal(
      index.toString()
    );
    expect(signal.toString()).to.be.equal(SIGNAL);
  });

  it("double-signalling to the same external nullifier should fail", async () => {
    const leaves = await semaphoreContract.getLeaves();
    const newSignal = genVoterSignal(2);

    const result = await genVoteWitness(
      newSignal,
      circuit,
      identity,
      leaves,
      NUM_LEVELS,
      externalNullifier
    );

    proof = await genProof(result.witness, provingKey);
    publicSignals = genPublicSignals(result.witness, circuit);
    params = genVoteSignalParams(result, proof, publicSignals);
    try {
      await semaphoreContract.broadcastSignalTest(
        params.signal,
        params.proof,
        params.nullifiersHash
      );
    } catch (e) {
      expect(e.message).endsWith("Semaphore: nullifier already seen");
    }
  });

  it("signalling to a different external nullifier should not work", async () => {
    const leaves = await semaphoreContract.getLeaves();
    const newSignal = genVoterSignal(2);
    const otherEn = genExternalNullifier("1111");
    const result = await genVoteWitness(
      newSignal,
      circuit,
      identity,
      leaves,
      NUM_LEVELS,
      otherEn
    );

    proof = await genProof(result.witness, provingKey);
    publicSignals = genPublicSignals(result.witness, circuit);
    params = genVoteSignalParams(result, proof, publicSignals);
    await expect(
      semaphoreContract.broadcastSignalTest(
        params.signal,
        params.proof,
        params.nullifiersHash,
        { gas: 1000000 }
      )
    ).to.be.rejected;
  });
});

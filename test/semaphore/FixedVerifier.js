const MiMC = artifacts.require("semaphore/MiMC");
const Semaphore = artifacts.require("semaphore/Semaphore");
const SemaphoreClient = artifacts.require("semaphore/SemaphoreClient");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const truffleAssert = require("truffle-assertions");

const {
  genIdentity,
  genIdentityCommitment,
  genWitness,
  genCircuit,
  genProof,
  genPublicSignals,
  verifyProof,
  parseVerifyingKeyJson,
  genBroadcastSignalParams,
  genSignalHash,
} = require("libsemaphore");
const path = require("path");
const fs = require("fs");

const NUM_LEVELS = 20;
const FIRST_EXTERNAL_NULLIFIER = 0;
const SIGNAL = "signal0";

let semaphoreContract;
let semaphoreClientContract;
let mimcContract;

// hex representations of all inserted identity commitments
let insertedIdentityCommitments = [];

contract("Semaphore", (accounts) => {
  before(async () => {
    console.log("Deploying MiMC");
    mimcContract = await MiMC.new();
    await Semaphore.link(mimcContract);

    console.log("Deploying Semaphore");
    semaphoreContract = await Semaphore.new(
      NUM_LEVELS,
      FIRST_EXTERNAL_NULLIFIER
    );

    console.log("Deploying Semaphore Client");
    semaphoreClientContract = await SemaphoreClient.new(
      semaphoreContract.address
    );

    console.log(
      "Transferring ownership of the Semaphore contract to the Semaphore Client"
    );
    await semaphoreContract.transferOwnership(semaphoreClientContract.address);
  });

  it("inserts an identity commitment", async () => {
    const identity = genIdentity();
    const identityCommitment = genIdentityCommitment(identity);

    const tx = await semaphoreClientContract.insertIdentityAsClient(
      identityCommitment.toString()
    );
    const receipt = tx.receipt;
    expect(receipt.status).to.be.true;

    console.log(
      "Gas used by insertIdentityAsClient():",
      receipt.gasUsed.toString()
    );

    insertedIdentityCommitments.push("0x" + identityCommitment.toString(16));
  });

  describe("signal broadcasts", () => {
    // Load circuit, proving key, and verifying key
    const circuitPath = path.join(__dirname, "../../circuits/circuit.json");
    const provingKeyPath = path.join(
      __dirname,
      "../../circuits/proving_key.bin"
    );
    const verifyingKeyPath = path.join(
      __dirname,
      "../../circuits/verification_key.json"
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
    let signal;

    before(async () => {
      identity = genIdentity();
      identityCommitment = genIdentityCommitment(identity);

      await semaphoreClientContract.insertIdentityAsClient(
        identityCommitment.toString()
      );

      const leaves = await semaphoreClientContract.getIdentityCommitments();

      const result = await genWitness(
        SIGNAL,
        circuit,
        identity,
        leaves,
        NUM_LEVELS,
        FIRST_EXTERNAL_NULLIFIER
      );

      proof = await genProof(result.witness, provingKey);
      publicSignals = genPublicSignals(result.witness, circuit);
      params = genBroadcastSignalParams(result, proof, publicSignals);
      signal = web3.utils.utf8ToHex(SIGNAL);
    });

    it("the proof should be valid", async () => {
      const isValid = verifyProof(verifyingKey, proof, publicSignals);
      expect(isValid).to.be.true;
    });

    it("the pre-broadcast check should pass", async () => {
      const check = await semaphoreContract.preBroadcastCheck(
        signal,
        params.proof,
        params.root,
        params.nullifiersHash,
        genSignalHash(signal).toString(),
        params.externalNullifier
      );
      expect(check).to.be.true;
    });

    it("broadcastSignal with an input element above the scalar field should fail", async () => {
      const size = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
      );
      const oversizedInput = (BigInt(params.nullifiersHash) + size).toString();
      try {
        await semaphoreClientContract.broadcastSignal(
          signal,
          params.proof,
          params.root,
          oversizedInput,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(e.message).to.endsWith("lt the snark scalar field");
      }
    });

    it("broadcastSignal to active external nullifier with an account with the right permissions should work", async () => {
      const tx = await semaphoreClientContract.broadcastSignal(
        signal,
        params.proof,
        params.root,
        params.nullifiersHash,
        params.externalNullifier
      );
      const receipt = tx.receipt;
      expect(receipt.status).to.be.true;
      console.log("Gas used by broadcastSignal():", receipt.gasUsed.toString());

      const index = (await semaphoreClientContract.nextSignalIndex()) - 1;
      const savedSignal = await semaphoreClientContract.signalIndexToSignal(
        index.toString()
      );

      expect(web3.utils.hexToUtf8(savedSignal)).to.be.equal(SIGNAL);
      truffleAssert.eventEmitted(tx, "SignalBroadcastByClient");
    });
  });
});

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
  genExternalNullifier,
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
const activeEn = genExternalNullifier("1111");
const inactiveEn = genExternalNullifier("2222");

contract("Semaphore", () => {
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

  it("Semaphore belongs to the correct owner", async () => {
    const owner = await semaphoreContract.owner();
    expect(owner).equal(semaphoreClientContract.address);
  });

  it("insert an identity commitment", async () => {
    const identity = genIdentity();
    const identityCommitment = genIdentityCommitment(identity);

    const tx = await semaphoreClientContract.insertIdentityAsClient(
      identityCommitment.toString()
    );
    const receipt = tx.receipt;
    expect(receipt.status).to.be.true;

    const numInserted = await semaphoreContract.getNumIdentityCommitments();
    expect(numInserted.toString()).equal("1");

    console.log(
      "Gas used by insertIdentityAsClient():",
      receipt.gasUsed.toString()
    );
    insertedIdentityCommitments.push("0x" + identityCommitment.toString(16));
  });

  describe("identity insertions", () => {
    it("should be stored in the contract and retrievable via leaves()", async () => {
      const leaves = await semaphoreClientContract.getIdentityCommitments();
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
        const leaf = await semaphoreClientContract.getIdentityCommitment(i);
        const leafHex = BigInt("0x" + leaf.toString(16));
        expect(idCommsBigint.indexOf(leafHex) > -1).to.be.true;
      }
    });

    it("inserting an identity commitment of the nothing-up-my-sleeve value should fail", async () => {
      const nothingUpMySleeve =
        BigInt(web3.utils.keccak256("Semaphore")) %
        BigInt(
          "21888242871839275222246405745257275088548364400416034343698204186575808495617"
        );

      try {
        await semaphoreClientContract.insertIdentityAsClient(
          nothingUpMySleeve.toString()
        );
      } catch (e) {
        expect(
          e.message.endsWith(
            "Semaphore: identity commitment cannot be the nothing-up-my-sleeve-value"
          )
        );
      }
    });
  });

  describe("external nullifiers", () => {
    it("when there is only 1 external nullifier, the first and last external nullifier variables should be the same", async () => {
      const extNull = await semaphoreContract.numExternalNullifiers();
      expect(extNull.toNumber()).equal(1);
      const firstEn = await semaphoreContract.firstExternalNullifier();
      const lastEn = await semaphoreContract.lastExternalNullifier();
      expect(firstEn.toString()).equal(lastEn.toString());
    });

    it("getNextExternalNullifier should throw if there is only 1 external nullifier", async () => {
      const extNull = await semaphoreContract.numExternalNullifiers();
      expect(extNull.toNumber()).equal(1);
      const firstEn = await semaphoreContract.firstExternalNullifier();
      try {
        await semaphoreContract.getNextExternalNullifier(firstEn);
      } catch (e) {
        expect(
          e.message.endsWith(
            "Semaphore: no external nullifier exists after the specified one"
          )
        );
      }
    });

    it("should be able to add an external nullifier", async () => {
      const tx = await semaphoreClientContract.addExternalNullifier(activeEn, {
        gas: 200000,
      });
      const receipt = tx.receipt;

      expect(receipt.status).to.be.true;

      // Check if isExternalNullifierActive works
      const isActive = await semaphoreContract.isExternalNullifierActive(
        activeEn
      );
      expect(isActive).to.be.true;

      // Check if numExternalNullifiers() returns the correct value
      const numExt = await semaphoreContract.numExternalNullifiers();
      expect(numExt.toNumber()).equal(2);
    });

    it("getNextExternalNullifier should throw if there is no such external nullifier", async () => {
      try {
        await semaphoreContract.getNextExternalNullifier("876876876876");
      } catch (e) {
        expect(e.message.endsWith("Semaphore: no such external nullifier"));
      }
    });

    it("should be able to deactivate an external nullifier", async () => {
      await semaphoreClientContract.addExternalNullifier(inactiveEn, {
        gas: 200000,
      });
      const tx = await semaphoreClientContract.deactivateExternalNullifier(
        inactiveEn,
        { gas: 100000 }
      );
      const receipt = tx.receipt;
      expect(receipt.status).to.be.true;
      const isActive = await semaphoreContract.isExternalNullifierActive(
        inactiveEn
      );
      expect(isActive).to.be.false;
    });

    it("reactivating a deactivated external nullifier and then deactivating it should work", async () => {
      // inactiveEn should be inactive
      let isActive = await semaphoreContract.isExternalNullifierActive(
        inactiveEn
      );
      expect(isActive).to.be.false;

      // reactivate inactiveEn
      await semaphoreClientContract.reactivateExternalNullifier(inactiveEn, {
        gas: 100000,
      });

      isActive = await semaphoreContract.isExternalNullifierActive(inactiveEn);
      expect(isActive).to.be.true;

      await semaphoreClientContract.deactivateExternalNullifier(inactiveEn, {
        gas: 100000,
      });

      isActive = await semaphoreContract.isExternalNullifierActive(inactiveEn);
      expect(isActive).to.be.false;
    });

    it("enumerating external nullifiers should work", async () => {
      const firstEn = await semaphoreContract.firstExternalNullifier();
      const lastEn = await semaphoreContract.lastExternalNullifier();

      const externalNullifiers = [firstEn];
      let currentEn = firstEn;

      while (currentEn.toString() !== lastEn.toString()) {
        currentEn = await semaphoreContract.getNextExternalNullifier(currentEn);
        externalNullifiers.push(currentEn);
      }

      expect(externalNullifiers).lengthOf(3);
      expect(BigInt(externalNullifiers[0].toString())).equal(
        BigInt(firstEn.toString())
      );
      expect(BigInt(externalNullifiers[1].toString())).equal(
        BigInt(activeEn.toString())
      );
      expect(BigInt(externalNullifiers[2].toString())).equal(
        BigInt(inactiveEn.toString())
      );
    });
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
    });

    it("the proof should be valid", async () => {
      const isValid = verifyProof(verifyingKey, proof, publicSignals);
      expect(isValid).to.be.true;
    });

    it("the pre-broadcast check should pass", async () => {
      const signal = web3.utils.utf8ToHex(SIGNAL);
      const check = await semaphoreContract.preBroadcastCheck(
        signal,
        params.proof,
        params.root,
        params.nullifiersHash,
        genSignalHash(signal).toString(),
        FIRST_EXTERNAL_NULLIFIER
      );
      expect(check).to.be.true;
    });

    it("the pre-broadcast check with an invalid signal should fail", async () => {
      const signal = web3.utils.utf8ToHex(SIGNAL);
      const check = await semaphoreContract.preBroadcastCheck(
        "0x0",
        params.proof,
        params.root,
        params.nullifiersHash,
        genSignalHash(signal).toString(),
        FIRST_EXTERNAL_NULLIFIER
      );
      expect(check).to.be.false;
    });

    it("broadcastSignal with an input element above the scalar field should fail", async () => {
      const size = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
      );
      const oversizedInput = (BigInt(params.nullifiersHash) + size).toString();
      try {
        await semaphoreClientContract.broadcastSignal(
          web3.utils.utf8ToHex(SIGNAL),
          params.proof,
          params.root,
          oversizedInput,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(
          e.message.endsWith(
            "Semaphore: the nullifiers hash must be lt the snark scalar field"
          )
        ).to.be.true;
      }
    });

    it("broadcastSignal with an invalid proof_data should fail", async () => {
      try {
        await semaphoreClientContract.broadcastSignal(
          web3.utils.utf8ToHex(SIGNAL),
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
          params.root,
          params.nullifiersHash,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(
          e.message.endsWith("Semaphore: invalid field element(s) in proof")
        ).to.be.true;
      }
    });

    it("broadcastSignal with an unseen root should fail", async () => {
      try {
        await semaphoreClientContract.broadcastSignal(
          web3.utils.utf8ToHex(SIGNAL),
          params.proof,
          params.nullifiersHash, // note that this is delibrately swapped
          params.root,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(e.message.endsWith("Semaphore: root not seen")).to.be.true;
      }
    });

    it("broadcastSignal by an unpermissioned user should fail", async () => {
      try {
        await semaphoreContract.broadcastSignal(
          web3.utils.utf8ToHex(SIGNAL),
          params.proof,
          params.root,
          params.nullifiersHash,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(e.message.endsWith("Semaphore: broadcast permission denied")).to
          .be.true;
      }
    });

    it("broadcastSignal to active external nullifier with an account with the right permissions should work", async () => {
      const tx = await semaphoreClientContract.broadcastSignal(
        web3.utils.utf8ToHex(SIGNAL),
        params.proof,
        params.root,
        params.nullifiersHash,
        FIRST_EXTERNAL_NULLIFIER,
        //params.externalNullifier,
        { gas: 1000000 }
      );
      const receipt = tx.receipt;
      expect(receipt.status).to.be.true;
      console.log("Gas used by broadcastSignal():", receipt.gasUsed.toString());

      const index = (await semaphoreClientContract.nextSignalIndex()) - 1;
      const signal = await semaphoreClientContract.signalIndexToSignal(
        index.toString()
      );

      expect(web3.utils.hexToUtf8(signal)).to.be.equal(SIGNAL);

      truffleAssert.eventEmitted(tx, "SignalBroadcastByClient");
    });

    it("double-signalling to the same external nullifier should fail", async () => {
      const leaves = await semaphoreClientContract.getIdentityCommitments();
      const newSignal = "newSignal0";

      const result = await genWitness(
        newSignal,
        circuit,
        identity,
        leaves,
        NUM_LEVELS,
        FIRST_EXTERNAL_NULLIFIER
      );

      proof = await genProof(result.witness, provingKey);
      publicSignals = genPublicSignals(result.witness, circuit);
      params = genBroadcastSignalParams(result, proof, publicSignals);
      try {
        await semaphoreClientContract.broadcastSignal(
          web3.utils.utf8ToHex(newSignal),
          params.proof,
          params.root,
          params.nullifiersHash,
          FIRST_EXTERNAL_NULLIFIER
        );
      } catch (e) {
        expect(e.message.endsWith("Semaphore: nullifier already seen")).to.be
          .true;
      }
    });

    it("signalling to a different external nullifier should work", async () => {
      const leaves = await semaphoreClientContract.getIdentityCommitments();
      const newSignal = "newSignal1";

      const result = await genWitness(
        newSignal,
        circuit,
        identity,
        leaves,
        NUM_LEVELS,
        activeEn
      );

      proof = await genProof(result.witness, provingKey);
      publicSignals = genPublicSignals(result.witness, circuit);
      params = genBroadcastSignalParams(result, proof, publicSignals);
      const tx = await semaphoreClientContract.broadcastSignal(
        web3.utils.utf8ToHex(newSignal),
        params.proof,
        params.root,
        params.nullifiersHash,
        activeEn,
        { gas: 1000000 }
      );
      const receipt = tx.receipt;
      expect(receipt.status).to.be.true;
    });

    it("broadcastSignal to a deactivated external nullifier should fail", async () => {
      expect(await semaphoreContract.isExternalNullifierActive(inactiveEn)).to
        .be.false;

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
        inactiveEn
      );

      proof = await genProof(result.witness, provingKey);
      publicSignals = genPublicSignals(result.witness, circuit);
      params = genBroadcastSignalParams(result, proof, publicSignals);

      try {
        await semaphoreClientContract.broadcastSignal(
          web3.utils.utf8ToHex(SIGNAL),
          params.proof,
          params.root,
          params.nullifiersHash,
          inactiveEn
        );
      } catch (e) {
        expect(e.message.endsWith("Semaphore: external nullifier not found")).to
          .be.true;
      }
    });

    it("setPermissioning(false) should allow anyone to broadcast a signal", async () => {
      const leaves = await semaphoreClientContract.getIdentityCommitments();
      const newSignal = "newSignal2";

      const result = await genWitness(
        newSignal,
        circuit,
        identity,
        leaves,
        NUM_LEVELS,
        activeEn
      );

      proof = await genProof(result.witness, provingKey);
      publicSignals = genPublicSignals(result.witness, circuit);
      params = genBroadcastSignalParams(result, proof, publicSignals);
      try {
        await semaphoreContract.broadcastSignal(
          web3.utils.utf8ToHex(newSignal),
          params.proof,
          params.root,
          params.nullifiersHash,
          activeEn,
          { gas: 1000000 }
        );
      } catch (e) {
        expect(e.message.endsWith("Semaphore: broadcast permission denied")).to
          .be.true;
      }

      await semaphoreClientContract.setPermissioning(false, {
        gas: 100000,
      });

      const tx = await semaphoreClientContract.broadcastSignal(
        web3.utils.utf8ToHex(newSignal),
        params.proof,
        params.root,
        params.nullifiersHash,
        activeEn,
        { gas: 1000000 }
      );
      const receipt = tx.receipt;
      expect(receipt.status).to.be.true;
    });
  });
});

const ZKPairVoting = artifacts.require("ZKPairVoting");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const truffleAssert = require("truffle-assertions");

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const MAX_PROPOSAL_COUNT = 4;
const TREE_LEVEL = 20;
const {
  setupVoters,
  setupProposers,
  advanceTimeAndBlock,
  setupProposals,
  setupZKParams,
  voteWithArray,
} = require("../../utils/helpers");

const {
  genIdentity,
  genIdentityCommitment,
  genCircuit,
  genTree,
} = require("libsemaphore");

const path = require("path");
const fs = require("fs");
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

contract("ZKPairVoting", (accounts) => {
  beforeEach(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await ZKPairVoting.new(
      TREE_LEVEL,
      MAX_PROPOSAL_COUNT,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME,
      {
        from: this.owner,
      }
    );
  });
  it("should add sender as owner", async () => {
    const result = await this.contract.isOwner({ from: this.owner });
    expect(result).to.be.true;
  });

  it("should start with register stage", async () => {
    const result = await this.contract.currentState();
    expect(result).to.be.equal("Register");
  });

  it("should add proposers", async () => {
    await this.contract.addProposers(this.initialManagers, {
      from: this.owner,
    });
    for (const im of this.initialManagers) {
      const result = await this.contract.isEligibleProposer(im);
      expect(result).to.be.true;
    }
  });

  it("should add id commitments", async () => {
    let idCommits = [];
    for (let i = 0; i < 3; i++) {
      let identity = genIdentity();
      let identityCommitment = genIdentityCommitment(identity);
      idCommits.push(identityCommitment.toString());
    }
    let level = await this.contract.getTreeLevel();
    let tree = await genTree(level, idCommits);
    let root = await tree.root();
    await this.contract.addIdCommitments(idCommits, root, {
      from: this.owner,
    });
    const leaves = await this.contract.getLeaves();
    expect(leaves.length).equal(idCommits.length);

    const leavesHex = leaves.map(BigInt);
    for (let i = 0; i < idCommits.length; i++) {
      const containsLeaf = leavesHex.indexOf(BigInt(idCommits[i])) > -1;
      expect(containsLeaf).to.be.true;
    }
    let contractRoot = await this.contract.getRoot();
    expect(contractRoot.toString()).to.be.equal(root);
  });

  it("should not add proposer or id commitments for non owner", async () => {
    try {
      await this.contract.addProposers(this.initialManagers, {
        from: accounts[4],
      });
    } catch (e) {
      expect(e.message.endsWith("caller is not the owner"));
    }

    try {
      await setupVoters(1, accounts[4], this.contract);
    } catch (e) {
      expect(e.message.endsWith("caller is not the owner"));
    }
  });

  it("should not let non-eligible to add proposal", async () => {
    const sender = accounts[5];
    try {
      await this.contract.propose(web3.utils.fromAscii("platform1"), {
        from: sender,
      });
    } catch (e) {
      expect(e.message.endsWith("not eligible to propose!"));
    }
    const proposals = await this.contract.currentProposals.call();
    expect(proposals).to.be.an("array").that.has.lengthOf(0);
  });

  it("should add proposal", async () => {
    const sender = accounts[0];
    const platform = "platform1";
    await setupProposers(this.owner, [sender], this.contract);
    await proposeTest(sender, platform, 0, this.contract);
  });

  it("should not add proposal twice for same proposer", async () => {
    const sender = accounts[0];
    const platform = "platform1";
    await setupProposers(this.owner, [sender], this.contract);
    await proposeTest(sender, platform, 0, this.contract);
    try {
      await this.contract.propose(web3.utils.fromAscii("platform2"), {
        from: sender,
      });
    } catch (e) {
      expect(e.message.endsWith("not eligible to propose!"));
    }
  });

  it("should not add proposal after max proposal count", async () => {
    await setupProposers(
      this.owner,
      accounts.slice(0, MAX_PROPOSAL_COUNT),
      this.contract
    );
    let i = 0;
    for (; i < MAX_PROPOSAL_COUNT; i++) {
      await proposeTest(accounts[i], "platform" + i, i, this.contract);
    }

    i++;
    try {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    } catch (e) {
      expect(e.message.endsWith("Function cannot be called at this time"));
    }
  });

  it("should change state after max proposal count", async () => {
    const firstState = await this.contract.currentState.call();
    expect(firstState).to.be.equal("Register");
    await setupProposers(
      this.owner,
      accounts.slice(0, MAX_PROPOSAL_COUNT),
      this.contract
    );
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Proposal");
    for (let i = 0; i < MAX_PROPOSAL_COUNT; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    const thirdState = await this.contract.currentState.call();
    expect(thirdState).to.be.equal("Voting");
  });

  it("should change state after every proposer proposes", async () => {
    const firstState = await this.contract.currentState.call();
    expect(firstState).to.be.equal("Register");
    const managerCount = 2;
    await setupProposers(
      this.owner,
      accounts.slice(0, managerCount),
      this.contract
    );
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Proposal");
    for (let i = 0; i < managerCount; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    const thirdState = await this.contract.currentState.call();
    expect(thirdState).to.be.equal("Voting");
  });

  it("should not propose in voting state", async () => {
    await setupProposers(
      this.owner,
      accounts.slice(0, MAX_PROPOSAL_COUNT),
      this.contract
    );
    for (let i = 0; i < MAX_PROPOSAL_COUNT; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");
    try {
      await this.contract.propose(
        web3.utils.fromAscii("platform" + MAX_PROPOSAL_COUNT),
        {
          from: accounts[MAX_PROPOSAL_COUNT],
        }
      );
    } catch (e) {
      expect(e.message.endsWith("Function cannot be called at this time"));
    }
  });

  it("should return correct rank for the array", async () => {
    const result = await this.contract.getRank.call([1, 2, 3, 4]);
    expect(result.toNumber()).to.be.equal(23);
  });

  it("should change state to voting after deadline", async () => {
    await setupProposers(
      this.owner,
      accounts.slice(0, MAX_PROPOSAL_COUNT),
      this.contract
    );
    await proposeTest(accounts[0], "platform0", 0, this.contract);
    await advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    try {
      await this.contract.propose(web3.utils.fromAscii("platform" + 1), {
        from: accounts[1],
      });
    } catch (e) {
      expect(e.message.endsWith("cannot be called at this time."));
    }
    let secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Proposal");

    let realState = await this.contract.currentRealState.call();
    expect(realState).to.be.equal("Voting");

    await expect(this.contract.toNextState()).to.be.fulfilled;

    secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");

    realState = await this.contract.currentRealState.call();
    expect(realState).to.be.equal("Voting");
  });

  it("should assign address contract as extNullifier", async () => {
    let extNullifier = await this.contract.getActiveExternalNullifier();
    expect(extNullifier.toString(16)).to.be.equal(
      web3.utils.toBN(this.contract.address).toString(16)
    );
  });

  contract("ZKPairVoting election", (accounts) => {
    beforeEach(async () => {
      this.owner = accounts[0];
      this.contract = await ZKPairVoting.new(
        TREE_LEVEL,
        MAX_PROPOSAL_COUNT,
        PROPOSAL_LIFETIME,
        VOTING_LIFETIME,
        {
          from: this.owner,
        }
      );
      this.ids = await setupVoters(3, this.owner, this.contract);
      await setupProposers(this.owner, accounts.slice(0, 2), this.contract);
      await setupProposals(this.contract, accounts, 2);
      this.leaves = await this.contract.getLeaves();
      this.numLevel = await this.contract.getTreeLevel();
      this.extNullifier = await this.contract.getActiveExternalNullifier();
    });

    it("should not vote twice", async () => {
      let secondState = await this.contract.currentState.call();
      expect(secondState).to.be.equal("Voting");
      let params = await setupZKParams(
        1,
        this.ids[0],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
      //proposer
      await expect(
        this.contract.vote(
          1,
          params.signal,
          params.proof,
          params.nullifiersHash,
          {
            from: accounts[1],
          }
        )
      ).to.be.fulfilled;
      try {
        await this.contract.vote(
          1,
          params.signal,
          params.proof,
          params.nullifiersHash,
          {
            from: accounts[2],
          }
        );
      } catch (e) {
        expect(e.message.endsWith("nullifier already seen"));
      }
      try {
        await this.contract.vote(
          1,
          params.signal,
          params.proof,
          params.nullifiersHash,
          {
            from: accounts[1],
          }
        );
      } catch (e) {
        expect(e.message.endsWith("nullifier already seen"));
      }
    });

    it("should end vote after deadline", async () => {
      let params = await setupZKParams(
        1,
        this.ids[0],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
      await expect(
        this.contract.vote(
          1,
          params.signal,
          params.proof,
          params.nullifiersHash,
          {
            from: accounts[1],
          }
        )
      ).to.be.fulfilled;
      await advanceTimeAndBlock(VOTING_LIFETIME + 60);

      try {
        await this.contract.vote(
          2,
          params.signal,
          params.proof,
          params.nullifiersHash,
          {
            from: accounts[2],
          }
        );
      } catch (e) {
        expect(e.message.endsWith("Function cannot be called at this time"));
      }
    });

    it("should be able to call election result after deadline", async () => {
      await voteWithArray(
        [1, 2, 3],
        accounts[1],
        this.contract,
        this.ids[0],
        this.leaves,
        this.numLevel,
        this.extNullifier,
        circuit,
        provingKey
      );
      try {
        await this.contract.electionResult.call();
      } catch (e) {
        expect(e.message.endsWith("Function cannot be called at this time"));
      }
      await advanceTimeAndBlock(VOTING_LIFETIME + 60);

      const result = await this.contract.electionResult.call();
      expect(result.toNumber()).to.equal(1);
    });
    //private function
    // it("should be able to sort correctly", async () => {
    //   const input = [
    //     [1, 2, 20],
    //     [1, 3, 50],
    //     [1, 4, 10],
    //     [5, 1, 5],
    //   ];
    //   const result = await this.contract._countingSort.call(input, 51);
    //   expect(result[0][2].toNumber()).to.equal(5);
    // });
  });
});

async function proposeTest(sender, platform, index, contract) {
  const tx = await contract.propose(web3.utils.fromAscii(platform), {
    from: sender,
  });
  const proposals = await contract.currentProposals.call();
  expect(proposals)
    .to.be.an("array")
    .that.has.lengthOf(index + 1);

  truffleAssert.eventEmitted(tx, "Proposed", (ev) => {
    return (
      ev._from === sender &&
      expect(web3.utils.hexToUtf8(ev._proposal)).to.be.equal(platform)
    );
  });
}

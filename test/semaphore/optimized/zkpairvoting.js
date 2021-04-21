const ZKPairVoting = artifacts.require("ZKPairVoting");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");
const helper = require("../../utils/helpers.js");

const expect = chai.expect;
chai.use(chaiAsPromised);
const truffleAssert = require("truffle-assertions");

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const MAX_PROPOSAL_COUNT = 4;
const TREE_LEVEL = 20;
const {
  genIdentity,
  genIdentityCommitment,
  genExternalNullifier,
  genTree,
} = require("libsemaphore");

const activeEn = genExternalNullifier("ZKPVOTING");

contract("ZKPairVoting", (accounts) => {
  beforeEach(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await ZKPairVoting.new(
      TREE_LEVEL,
      MAX_PROPOSAL_COUNT,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME,
      activeEn,
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
    for (let i = 0; i < 10; i++) {
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
    const leaves = await this.contract.getIdCommitments();
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
      let identity = genIdentity();
      let identityCommitment = genIdentityCommitment(identity);
      let level = await this.contract.getTreeLevel();
      let tree = await genTree(level, [identityCommitment]);
      let root = await tree.root();
      await this.contract.addIdCommitments([identityCommitment], root, {
        from: accounts[4],
      });
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
    let i = 0;
    for (; i < MAX_PROPOSAL_COUNT; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    i++;
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");
    try {
      await expect(
        this.contract.propose(web3.utils.fromAscii("platform" + i), {
          from: accounts[i],
        })
      );
    } catch (e) {
      expect(e.message.endsWith("Function cannot be called at this time"));
    }
  });

  it("should return correct rank for the array", async () => {
    const result = await this.contract.getRank.call([1, 2, 3, 4]);
    expect(result.toNumber()).to.be.equal(23);
  });

  // it("should change state to voting after deadline", async () => {
  //   await setupProposers(
  //     this.owner,
  //     accounts.slice(0, MAX_PROPOSAL_COUNT),
  //     this.contract
  //   );
  //   await proposeTest(accounts[0], "platform0", 0, this.contract);
  //   await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
  //   try {
  //     await this.contract.propose(web3.utils.fromAscii("platform" + 1), {
  //       from: accounts[1],
  //     });
  //   } catch (e) {
  //     expect(e.message.endsWith("cannot be called at this time."));
  //   }
  //   const secondState = await this.contract.currentState.call();
  //   expect(secondState).to.be.equal("Voting");
  // });

  //   it("should not vote twice", async () => {
  //     let identity1 = genIdentity();
  //     let identityCommitment1 = genIdentityCommitment(identity1);
  //     await setupProposals(this.contract, accounts, 2);

  //     await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
  //     //proposer
  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[1],
  //       })
  //     ).to.be.fulfilled;

  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[1],
  //       })
  //     ).to.be.rejected;

  //     //voter
  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[3],
  //       })
  //     ).to.be.fulfilled;

  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[3],
  //       })
  //     ).to.be.rejected;
  //   });

  //   it("should end vote after deadline", async () => {
  //     await setupProposals(this.contract, accounts);
  //     await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[1],
  //       })
  //     ).to.be.fulfilled;
  //     await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);
  //     await expect(
  //       this.contract.vote(1, {
  //         from: accounts[2],
  //       })
  //     ).to.be.rejected;
  //   });

  //   it("should be able to call election result after deadline", async () => {
  //     await setupProposals(this.contract, accounts);
  //     await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
  //     await voteWithArray([1, 2, 3], accounts[1], this.contract);

  //     await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);

  //     const result = await this.contract.electionResult.call();
  //     expect(result.toNumber()).to.equal(1);
  //   });
  //   //private function
  //   // it("should be able to sort correctly", async () => {
  //   //   const input = [
  //   //     [1, 2, 20],
  //   //     [1, 3, 50],
  //   //     [1, 4, 10],
  //   //     [5, 1, 5],
  //   //   ];
  //   //   const result = await this.contract._countingSort.call(input, 51);
  //   //   expect(result[0][2].toNumber()).to.equal(5);
  //   // });
  // });

  // describe("ZKPairVoting election", (accounts) => {
  //   beforeEach(async () => {
  //     this.initialManagers = accounts;
  //     this.owner = accounts[0];
  //     this.contract = await ZKPairVoting.new(
  //       this.initialManagers,
  //       5,
  //       PROPOSAL_LIFETIME,
  //       VOTING_LIFETIME
  //     );
  //   });

  //   it("should be able to announce election result correctly", async () => {
  //     for (let i = 1; i <= 5; i++) {
  //       await this.contract.propose(web3.utils.fromAscii("platform" + i), {
  //         from: accounts[i],
  //       });
  //     }
  //     for (let i = 0; i < 3; i++) {
  //       await voteWithArray([1, 2, 3, 4, 5], accounts[i], this.contract);
  //     }

  //     for (let i = 3; i < 5; i++) {
  //       await voteWithArray([2, 1, 4, 5, 3], accounts[i], this.contract);
  //     }

  //     for (let i = 5; i < 6; i++) {
  //       await voteWithArray([2, 3, 4, 1, 5], accounts[i], this.contract);
  //     }

  //     for (let i = 6; i < 8; i++) {
  //       await voteWithArray([2, 3, 5, 4, 1], accounts[i], this.contract);
  //     }

  //     for (let i = 8; i < 10; i++) {
  //       await voteWithArray([2, 3, 5, 4, 1], accounts[i], this.contract);
  //     }

  //     await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);
  //     const result = await this.contract.electionResult.call();
  //     expect(result.toNumber()).to.equal(2);
  //   });
});

async function setupProposals(contract, accounts, count = 3) {
  for (let i = 0; i < count; i++) {
    await contract.propose(web3.utils.fromAscii("platform" + i + 1), {
      from: accounts[i],
    });
  }
}

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

async function setupProposers(sender, proposers, contract) {
  await contract.addProposers(proposers, {
    from: sender,
  });
  await contract.toProposalState({ from: sender });
}

async function voteWithArray(votes, sender, contract) {
  const rank = await contract.getRank.call(votes);
  await contract.vote(rank, {
    from: sender,
  });
}

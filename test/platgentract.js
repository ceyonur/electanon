const Platgentract = artifacts.require("Platgentract");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");
const helper = require("./utils/helpers.js");

const expect = chai.expect;
chai.use(chaiAsPromised);
const truffleAssert = require("truffle-assertions");

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();
const MAX_PROPOSAL_COUNT = 4;

contract("Platgentract", (accounts) => {
  beforeEach(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await Platgentract.new(
      this.initialManagers,
      MAX_PROPOSAL_COUNT,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
  });
  it("should add owners as manager", async () => {
    const result = await this.contract.isManager.call(this.owner);
    expect(result).to.be.true;
  });

  it("should add initial managers", async () => {
    for (const im of this.initialManagers) {
      const result = await this.contract.isManager.call(im);
      expect(result).to.be.true;
    }
  });

  it("should start with proposal stage", async () => {
    const result = await this.contract.currentState.call();
    expect(result).to.be.equal("Proposal");
  });

  it("should not let non-manager to add proposal", async () => {
    const sender = accounts[5];
    await expect(
      this.contract.propose(web3.utils.fromAscii("platform1"), {
        from: sender,
      })
    ).to.be.rejected;
    const proposals = await this.contract.currentProposals.call();
    expect(proposals).to.be.an("array").that.has.lengthOf(0);
  });

  it("should add proposal", async () => {
    const sender = accounts[0];
    const platform = "platform1";
    await proposeTest(sender, platform, 0, this.contract);
  });

  it("should not add proposal twice for same proposer", async () => {
    const sender = accounts[0];
    const platform = "platform1";
    await proposeTest(sender, platform, 0, this.contract);
    await expect(
      this.contract.propose(web3.utils.fromAscii("platform2"), {
        from: sender,
      })
    ).to.be.rejected;
  });

  // it("should not add proposal twice for same platformName", async () => {
  //   const sender = accounts[0];
  //   const platform = "platform1";
  //   await proposeTest(sender, platform, 0, this.contract);
  //   await expect(
  //     this.contract.propose(web3.utils.fromAscii(platform), {
  //       from: accounts[1],
  //     })
  //   ).to.be.rejected;
  // });

  it("should not add proposal after max proposal count", async () => {
    let i = 0;
    for (; i < MAX_PROPOSAL_COUNT; i++) {
      await proposeTest(accounts[i], "platform" + i, i, this.contract);
    }

    i++;
    await expect(
      this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      })
    ).to.be.rejected;
  });

  it("should change state after max proposal count", async () => {
    const firstState = await this.contract.currentState.call();
    expect(firstState).to.be.equal("Proposal");
    for (let i = 0; i < MAX_PROPOSAL_COUNT; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");
  });

  it("should not propose in voting state", async () => {
    let i = 0;
    for (; i < MAX_PROPOSAL_COUNT; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    i++;
    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");
    await expect(
      this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      })
    ).to.be.rejected;
  });

  it("should change state to voting after deadline", async () => {
    await proposeTest(accounts[0], "platform0", 0, this.contract);
    await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    await expect(
      this.contract.propose(web3.utils.fromAscii("platform" + 1), {
        from: accounts[1],
      })
    ).to.be.rejected;
    const proposals = await this.contract.currentProposals.call();
    await this.contract.vote(proposals, {
      from: accounts[1],
    });

    const secondState = await this.contract.currentState.call();
    expect(secondState).to.be.equal("Voting");
  });

  it("should not vote for same proposal", async () => {
    await setupProposals(this.contract, accounts);

    await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    await expect(
      this.contract.vote([1, 1, 1], {
        from: accounts[1],
      })
    ).to.be.rejected;
  });

  it("should not vote twice", async () => {
    await setupProposals(this.contract, accounts);

    await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    await expect(
      this.contract.vote([1, 2, 3], {
        from: accounts[1],
      })
    ).to.be.fulfilled;

    await expect(
      this.contract.vote([1, 2, 3], {
        from: accounts[1],
      })
    ).to.be.rejected;
  });

  it("should end vote after deadline", async () => {
    await setupProposals(this.contract, accounts);
    await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    await expect(
      this.contract.vote([1, 2, 3], {
        from: accounts[1],
      })
    ).to.be.fulfilled;
    await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);
    await expect(
      this.contract.vote([1, 2, 3], {
        from: accounts[2],
      })
    ).to.be.rejected;
  });

  it("should be able to call election result after deadline", async () => {
    await setupProposals(this.contract, accounts);
    await helper.advanceTimeAndBlock(PROPOSAL_LIFETIME + 60);
    await this.contract.vote([1, 2, 3], {
      from: accounts[1],
    });

    await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);
    await expect(
      this.contract.vote([1, 2, 3], {
        from: accounts[2],
      })
    ).to.be.rejected;

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

contract("Platgentract election", (accounts) => {
  beforeEach(async () => {
    this.initialManagers = accounts;
    this.owner = accounts[0];
    this.contract = await Platgentract.new(
      this.initialManagers,
      5,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
  });

  it("should be able to announce election result correctly", async () => {
    for (let i = 1; i <= 5; i++) {
      await this.contract.propose(web3.utils.fromAscii("platform" + i), {
        from: accounts[i],
      });
    }
    for (let i = 0; i < 3; i++) {
      await this.contract.vote([1, 2, 3, 4, 5], {
        from: accounts[i],
      });
    }

    for (let i = 3; i < 5; i++) {
      await this.contract.vote([2, 1, 4, 5, 3], {
        from: accounts[i],
      });
    }

    for (let i = 5; i < 6; i++) {
      await this.contract.vote([1, 3, 4, 2, 5], {
        from: accounts[i],
      });
    }

    for (let i = 6; i < 8; i++) {
      await this.contract.vote([1, 3, 5, 4, 2], {
        from: accounts[i],
      });
    }

    for (let i = 8; i < 10; i++) {
      await this.contract.vote([2, 3, 5, 4, 1], {
        from: accounts[i],
      });
    }

    await helper.advanceTimeAndBlock(VOTING_LIFETIME + 60);
    const result = await this.contract.electionResult.call();
    expect(result.toNumber()).to.equal(1);
  });
});

async function setupProposals(contract, accounts) {
  await contract.propose(web3.utils.fromAscii("platform1"), {
    from: accounts[0],
  });
  await contract.propose(web3.utils.fromAscii("platform2"), {
    from: accounts[1],
  });
  await contract.propose(web3.utils.fromAscii("platform3"), {
    from: accounts[2],
  });
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
      expect(web3.utils.hexToUtf8(ev._platformName)).to.be.equal(platform)
    );
  });
}

const Mangentract = artifacts.require("Mangentract");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");
const helper = require("./utils/helpers.js");

const REQUIRED_PERC = 80;
const LIFETIME = moment.duration(30, "days").asSeconds();
const MAX_MANAGER_COUNT = 5;

const expect = chai.expect;
chai.use(chaiAsPromised);

contract("Mangentract approvals", (accounts) => {
  before(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await Mangentract.new(
      this.initialManagers,
      REQUIRED_PERC,
      LIFETIME,
      MAX_MANAGER_COUNT
    );
    this.requestedAddress = accounts[4];
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

  it("should not add manager to approval queue", async () => {
    const sender = accounts[5];
    await expect(
      this.contract.requestManagerApproval(this.requestedAddress, {
        from: sender,
      })
    ).to.be.rejected;
    const addresses = await this.contract.approvalStatus.call(
      this.requestedAddress
    );
    expect(addresses).to.be.an("array").that.has.lengthOf(0);
  });

  it("should add manager to approval queue", async () => {
    await this.contract.requestManagerApproval(this.requestedAddress, {
      from: this.owner,
    });

    const addresses = await this.contract.approvalStatus.call(
      this.requestedAddress
    );
    expect(addresses)
      .to.be.an("array")
      .that.has.lengthOf(1)
      .that.include(this.owner);
  });

  it("should not grant role manager after adding to queue", async () => {
    const isManagerResult = await this.contract.isManager.call(
      this.requestedAddress
    );
    expect(isManagerResult).to.be.false;
  });

  it("should not approve manager in queue", async () => {
    const sender = accounts[5];
    await expect(
      this.contract.approveManager(this.requestedAddress, {
        from: sender,
      })
    ).to.be.rejected;
    const addresses = await this.contract.approvalStatus.call(
      this.requestedAddress
    );
    expect(addresses)
      .to.be.an("array")
      .that.has.lengthOf(1)
      .that.include(this.owner);
  });

  it("should not grant role after second approval", async () => {
    await this.contract.approveManager(this.requestedAddress, {
      from: this.initialManagers[0],
    });
    const isManagerResult = await this.contract.isManager.call(
      this.requestedAddress
    );
    expect(isManagerResult).to.be.false;
  });

  it("should show every address that approved the account", async () => {
    const addresses = await this.contract.approvalStatus.call(
      this.requestedAddress
    );
    expect(addresses)
      .to.be.an("array")
      .that.has.lengthOf(2)
      .that.include(this.owner, this.initialManagers[0]);
  });

  it("should grant role after approvals", async () => {
    await this.contract.approveManager(this.requestedAddress, {
      from: this.initialManagers[1],
    });
    const isManagerResult = await this.contract.isManager.call(
      this.requestedAddress
    );
    expect(isManagerResult).to.be.true;
  });
});

contract("Mangentract should be stopped when max members", (accounts) => {
  before(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await Mangentract.new(
      this.initialManagers,
      REQUIRED_PERC,
      LIFETIME,
      MAX_MANAGER_COUNT
    );
    this.requestedAddress = accounts[5];
  });

  it("should not stop contract before max manager count", async () => {
    await this.contract.requestManagerApproval(this.requestedAddress, {
      from: this.owner,
    });

    var stoppedResult = await this.contract.stopped.call();
    expect(stoppedResult).to.be.false;
  });

  it("should stop contract after max manager count", async () => {
    for (var k = 0; k < this.initialManagers.length - 1; k++) {
      await this.contract.approveManager(this.requestedAddress, {
        from: this.initialManagers[k],
      });
    }
    const isManagerResult = await this.contract.isManager.call(
      this.requestedAddress
    );
    expect(isManagerResult).to.be.true;

    await expect(
      this.contract.approveManager(this.requestedAddress, {
        from: this.initialManagers[this.initialManagers.length],
      })
    ).to.be.rejected;

    var stoppedResult = await this.contract.stopped.call();
    expect(stoppedResult).to.be.true;
  });
});

contract("Mangentract should be stoppable when deadline passes", (accounts) => {
  before(async () => {
    this.initialManagers = accounts.slice(1, 4);
    this.owner = accounts[0];
    this.contract = await Mangentract.new(
      this.initialManagers,
      75,
      LIFETIME,
      MAX_MANAGER_COUNT
    );
  });

  it("should not call voteToStop before deadline", async () => {
    await expect(
      this.contract.voteToStop({
        from: this.owner,
      })
    ).to.be.rejected;
  });

  it("should able to call voteToStop before deadline", async () => {
    await helper.advanceTimeAndBlock(LIFETIME + 60);
    var stopStatus = await this.contract.stopStatusPercentage();
    expect(stopStatus.toNumber()).to.equal(0);
    await expect(
      this.contract.voteToStop({
        from: this.owner,
      })
    ).to.be.not.rejected;
    stopStatus = await this.contract.stopStatusPercentage();
    expect(stopStatus.toNumber()).to.equal(25);
  });

  it("should stop contract after enough approval", async () => {
    var stopped = await this.contract.stopped();
    expect(stopped).to.be.false;
    await helper.advanceTimeAndBlock(LIFETIME + 60);
    await voteStopAssertResult(this.contract, this.initialManagers[0], 50);
    await voteStopAssertResult(this.contract, this.initialManagers[1], 75);
    stopped = await this.contract.stopped();
    expect(stopped).to.be.true;
  });
});

async function voteStopAssertResult(contract, from, expectedPercentage) {
  await expect(
    contract.voteToStop({
      from: from,
    })
  ).to.be.not.rejected;
  var stopStatus = await contract.stopStatusPercentage();
  expect(stopStatus.toNumber()).to.equal(expectedPercentage);
}

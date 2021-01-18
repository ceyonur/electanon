const Gentract = artifacts.require("Gentract");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const expect = chai.expect;
chai.use(chaiAsPromised);

contract("Gentract", (accounts) => {
  before(async () => {
    this.initialManagers = accounts.slice(0, 3);
    this.owner = accounts[0];
    this.contract = await Gentract.new(this.initialManagers);
    this.requestedAddress = accounts[4];
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
        from: accounts[5],
      })
    ).to.be.rejected;
    const addresses = await this.contract.approvalStatus.call(
      this.requestedAddress
    );
    expect(addresses).to.be.an("array").that.has.lengthOf(0);
  });

  it("should add manager to approval queue", async () => {
    const result = await this.contract.requestManagerApproval(
      this.requestedAddress,
      { from: this.owner }
    );

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
        from: accounts[5],
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
      from: this.initialManagers[1],
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
      .that.include(this.owner, this.initialManagers[1]);
  });

  it("should grant role after approvals", async () => {
    await this.contract.approveManager(this.requestedAddress, {
      from: this.initialManagers[2],
    });
    const isManagerResult = await this.contract.isManager.call(
      this.requestedAddress
    );
    expect(isManagerResult).to.be.true;
  });
});

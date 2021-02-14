const Platgentract = artifacts.require("Platgentract");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment");
const helper = require("./utils/helpers.js");

const expect = chai.expect;
chai.use(chaiAsPromised);

const PROPOSAL_LIFETIME = moment.duration(30, "days").asSeconds();
const VOTING_LIFETIME = moment.duration(30, "days").asSeconds();

contract("Platgentract", (accounts) => {
  beforeEach(async () => {
    this.initialManagers = accounts;
    this.owner = accounts[0];
    this.contract = await Platgentract.new(
      this.initialManagers,
      20,
      PROPOSAL_LIFETIME,
      VOTING_LIFETIME
    );
  });

  it("should not exceed gas", async () => {
    for (let i = 0; i < 20; i++) {
      await this.contract.propose("platform" + i, {
        from: accounts[i],
      });
    }

    for (let i = 0; i < 20; i++) {
      await this.contract.vote(
        Array.from(Array(20), (x, index) => index + 1),
        {
          from: accounts[i],
        }
      );
    }
    const result = await this.contract.electionResult.call();
    expect(result.toNumber()).to.equal(1);
  });
});

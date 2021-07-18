const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.use(require("chai-string"));

const { hashers } = require("semaphore-merkle-tree");

const {
  setupTree,
  genIdentityCommitment,
  genIdentity,
} = require("libsemaphore");

contract("PairVoting", () => {
  before(async () => {});

  it("tree", async () => {
    let level = 2;
    let tree = setupTree(level);
    let leaves = [
      "3577647296782312824324546093919112100284894683369896107752344825062901911229",
      "15087327115126519935676038393613461237321746534784242208054296806385826835953",
      "15360309908966885906415445509171033150197879604828456454101303333437923658975",
      "20580979532296033957176502242280955913167065812641420227749744589865359455950",
    ];
    for (let i = 0; i < 2 ** level; i++) {
      //const leaf = genIdentityCommitment(genIdentity()).toString();
      //leaves.push(leaf);
      await tree.update(i, leaves[i]);
    }
    const root = await tree.root();
    console.log("root: " + root);
    console.log("leaves: " + leaves);
    //let hasher = new hashers.MimcSpongeHasher();
    // let res = hasher.hash(0, leaves[0], leaves[1]);
    // console.log("mimc: " + res);
    let enc = web3.utils.encodePacked({
      type: "uint256[]",
      value: leaves,
    });
    let keccak = web3.utils.soliditySha3Raw(enc);
    console.log("keccak: " + keccak);
  });

  it("should add initial managers", async () => {
    let arr = [];
    for (let i = 0; i < 5; i++) {
      const leaf = genIdentityCommitment(genIdentity()).toString();
      arr.push(leaf);
    }

    // let arr = [
    //   "115792089237316195423570985008687907853269984665640564039457584007913129639926",
    // ];
    arr = [
      "21463555173078150059732212021173097544277259631312607704250975353107792597136",
    ];
    let enc = web3.utils.encodePacked({
      type: "uint256[]",
      value: arr,
    });
    console.log("leaves: " + arr);
    console.log("enc: " + enc);
    let hash = web3.utils.soliditySha3Raw(enc);
    console.log("hash: " + hash);

    //let res = packbytes(bytes, 8);
    let res = packhex(enc, 16);

    console.log(res);
    console.log(res.length);
  });
});

function packhex(enc, size) {
  let encp = enc.slice(2);
  let res = [];
  let tmp = [];
  for (let k = 0; k < encp.length; k++) {
    let val = encp[k];
    let index = Math.floor(k / size);
    tmp[k % size] = val;
    if (k % size == size - 1) {
      var hx = "0x" + tmp.join("");
      res[index] = web3.utils.hexToNumberString(hx);
      tmp = [];
    }
  }
  return res;
}

function packbytes(loopel, size) {
  let res = [];
  let tmp = [];
  for (let k = 0; k < loopel.length; k++) {
    let val = loopel[k];
    let index = Math.floor(k / size);
    tmp[k % size] = val;
    if (k % size == size - 1) {
      res[index] = tmp.join("");
      tmp = [];
    }
  }

  return res;
}

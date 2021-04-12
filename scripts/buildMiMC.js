const Artifactor = require("truffle-artifactor");
const path = require("path");
const mimcGenContract = require("circomlib/src/mimcsponge_gencontract.js");
const artifactor = new Artifactor(path.resolve(__dirname, "./"));
const SEED = "mimcsponge";

const buildMiMC = async () => {
  await artifactor.save({
    contractName: "MiMC",
    abi: mimcGenContract.abi,
    unlinked_binary: mimcGenContract.createCode(SEED, 220),
  });
};

if (require.main === module) {
  console.log("Generating MiMC");
  buildMiMC();
  console.log("Generated MiMC.json in " + path.resolve(__dirname, "./"));
}

const { initialize } = require("zokrates-js/node");

const path = require("path");
const fs = require("fs");
const outFile = path.join(__dirname, "../../circuits/zk-mt/build/out");
const jsonAbiFile = path.join(__dirname, "../../circuits/zk-mt/build/abi.json");
const provingKeyFile = path.join(
  __dirname,
  "../../circuits/zk-mt/build/proving.key"
);

const verificationKeyFile = path.join(
  __dirname,
  "../../circuits/zk-mt/build/verification.key"
);

async function test() {
  let zokratesProvider = await initialize();

  let out = fs.readFileSync(outFile);
  // console.log("read");
  // console.log(out);
  const jsonAbi = fs.readFileSync(jsonAbiFile).toString();
  const artifacts = { program: out, abi: jsonAbi };
  // computation
  const { witness, output } = zokratesProvider.computeWitness(artifacts, [
    ["1", "2"],
  ]);

  // console.log("witness");
  // console.log(witness);

  console.log("output");
  console.log(output);

  // run setup
  const verificationKey = JSON.parse(fs.readFileSync(verificationKeyFile));
  const provingKey = fs.readFileSync(provingKeyFile);

  console.log("verificationKey");
  console.log(verificationKey);

  // generate proof
  const proof = zokratesProvider.generateProof(
    artifacts.program,
    witness,
    provingKey
  );
  console.log("proof");
  console.log(proof);

  // const keypair = zokratesProvider.setup(artifacts.program);
  // console.log("keypair");
  // console.log(keypair);

  let result = zokratesProvider.verify(verificationKey, proof);
  console.log("result");
  console.log(result);
}

test();

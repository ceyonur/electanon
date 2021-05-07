const {
  genVoteSignalParams,
  genPublicSignals,
  genProof,
  genVoteWitness,
  genTree,
  genIdentityCommitment,
  genIdentity,
  genPrivateVoteWitness,
} = require("libsemaphore");
const readline = require("readline");

function advanceTime(time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
}

function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      (err) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;

        return resolve(newBlockHash);
      }
    );
  });
}

function takeSnapshot() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_snapshot",
        id: new Date().getTime(),
      },
      (err, snapshotId) => {
        if (err) {
          return reject(err);
        }
        return resolve(snapshotId);
      }
    );
  });
}

function revertToSnapShot(id) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_revert",
        params: [id],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
}

async function advanceTimeAndBlock(time) {
  await advanceTime(time);
  await advanceBlock();
  return Promise.resolve(web3.eth.getBlock("latest"));
}

function wait(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(() =>
    rl.question(query, () => {
      rl.close();
    })
  );
}

async function setupProposers(sender, proposers, contract) {
  await contract.addProposers(proposers, {
    from: sender,
  });
  await contract.toProposalState({ from: sender });
}

async function voteWithArray(
  votes,
  sender,
  contract,
  id,
  leaves,
  numLevel,
  extNullifier,
  circuit,
  provingKey
) {
  const rank = await contract.getRank.call(votes);
  let params = await setupZKParams(
    rank,
    id,
    leaves,
    numLevel,
    extNullifier,
    circuit,
    provingKey
  );
  await contract.vote(
    rank,
    params.signal,
    params.proof,
    params.nullifiersHash,
    {
      from: sender,
    }
  );
}

async function setupVoters(number, sender, contract) {
  let idCommits = [];
  let ids = [];
  for (let i = 0; i < number; i++) {
    let identity = genIdentity();
    let identityCommitment = genIdentityCommitment(identity);
    idCommits.push(identityCommitment.toString());
    ids.push(identity);
  }
  let level = await contract.getTreeLevel();
  let tree = await genTree(level, idCommits);
  let root = await tree.root();
  await contract.addIdCommitments(idCommits, root, {
    from: sender,
  });
  return ids;
}

async function setupZKParams(
  vote,
  identity,
  leaves,
  numLevel,
  externalNull,
  circuit,
  provingKey
) {
  const result = await genVoteWitness(
    vote,
    circuit,
    identity,
    leaves,
    numLevel,
    externalNull
  );

  let proof = await genProof(result.witness, provingKey);
  let publicSignals = await genPublicSignals(result.witness, circuit);
  let params = await genVoteSignalParams(result, proof, publicSignals);
  return params;
}

async function setupProposals(contract, accounts, count = 3) {
  for (let i = 0; i < count; i++) {
    await contract.propose(web3.utils.fromAscii("platform" + i + 1), {
      from: accounts[i],
    });
  }
}

async function setupZKParamsPrivate(
  vote,
  password,
  identity,
  leaves,
  numLevel,
  externalNull,
  circuit,
  provingKey
) {
  const result = await genPrivateVoteWitness(
    vote,
    password,
    circuit,
    identity,
    leaves,
    numLevel,
    externalNull
  );

  let proof = await genProof(result.witness, provingKey);
  let publicSignals = await genPublicSignals(result.witness, circuit);
  let params = await genVoteSignalParams(result, proof, publicSignals);
  return params;
}

async function voteWithArrayPrivate(
  votes,
  password,
  sender,
  contract,
  id,
  leaves,
  numLevel,
  extNullifier,
  circuit,
  provingKey
) {
  const rank = await contract.getRank.call(votes);
  let params = await setupZKParamsPrivate(
    rank,
    password,
    id,
    leaves,
    numLevel,
    extNullifier,
    circuit,
    provingKey
  );
  await contract.commitVote(
    params.signal,
    params.proof,
    params.nullifiersHash,
    {
      from: sender,
    }
  );
  return rank;
}

module.exports = {
  advanceTime,
  advanceBlock,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapShot,
  wait,
  voteWithArray,
  setupZKParams,
  setupVoters,
  setupProposers,
  setupProposals,
  setupZKParamsPrivate,
  voteWithArrayPrivate,
};

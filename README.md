# ElectAnon

A BLOCKCHAIN-BASED, ANONYMOUS, ROBUST AND SCALABLE RANKED-CHOICE VOTING PROTOCOL

ElectAnon arXiv link: https://arxiv.org/abs/2204.00057

## Compile

Follow https://semaphore.appliedzkp.org/docs/V1/quickstart to generate circuits & verifier.sol. Put `circuit.json` & `proving_key.bin` & `verification_key.json` and `verifier.sol` under `circuits/semaphore/build/` folder.

## Tests

These tests can be run with `npx hardhat test`:

- `electanon.js`
- `electanonslow.js`
- `SemaphoreOpt.js`
- `tideman.js`
- `gasanalysis/electanon.js`
- `gasanalysis/pairvoting.js`

A sample run: `npx hardhat test test/electanon.js`

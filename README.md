# gentract

Smart Contract for Genesis Block

## Compile

Follow https://semaphore.appliedzkp.org/quickstart.html to generate circuits & verifier.sol. Put circuit.json & proving_key.bin & verification_key.json to circuits/build/circom/ folder, and verifier.sol under contracts/semaphore

## Tests

Run tests with --no-compile for pre-compiled verifier.sol. For example:

```
npx hardhat test test/semaphore/FixedVerifier.js --no-compile
```

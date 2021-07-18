TODO:

- Proposal at the beginning
- Delete operation to refund gas
- Merge two verifier contracts (circom, zokrates) to save gas

Discussion:

- Election commitee can give merkle tree proof to voters when they register id commit hashes. In order to reduce storage complexity on voter side(no need to store all commit hashes).
- Incentivized merkle tree verification as insertion cost no hash but if someone catches a problem they're rewarded, and election stops.
- There can be verified nodes (addresses) that can send votes to pay fees instead voters. (like vote counters/nodes). I.e nodes owned by election commitee instead voters. this does not reduces privacy, but increases single point failure.
- Merkle Tree can be changed to Urkel Tree or Merkleized binary trie.
- Talk about RSA membership
- Go avalanche
- Batchable proves can be full private but pre-defined sizes, or partial-private but unlimited sizes. It requires to specify which tree to prove in contract level to be unlimited size (users will tell which tree to prove so they will reveal which tree they're in)
- Make election as plugabble (another result method, even another election method applicable)

  Whats new:

- Borda Method (Pair Based) with optimized permutation methods
- Preserve security while optimizing gas cost
- Election cannot be stopped(disrupted) after started
- Merkle Root must be input from contract
- Ethereum contract can be run from a single-node without sacrificing privacy.

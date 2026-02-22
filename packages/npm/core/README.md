# @ioproof/core

Core verification utilities for IOProof — SHA-256 hashing, Merkle proof validation, and blinded commitment verification.

## Status

SDK is under active development. For verification today, use the [standalone verifier](https://ioproof.com/standalone-verifier).

## Planned API

```js
const { verifyProof, hashPayload, walkMerkleProof } = require('@ioproof/core');

// Verify an exported proof bundle
const result = await verifyProof(proofBundle);
// { valid: true, steps: [...], onChainRoot: '...', merkleValid: true }
```

## Related packages

- [`ioproof`](https://www.npmjs.com/package/ioproof) — Main package
- [`@ioproof/client`](https://www.npmjs.com/package/@ioproof/client) — HTTP client for the IOProof API

## License

MIT — [Alexiuz AS](https://alexiuz.com)

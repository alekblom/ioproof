# @ioproof/core

Core verification utilities for IOProof — SHA-256 hashing, Merkle proof validation, and blinded commitment verification.

## Status

SDK is under active development. For verification today, use the [standalone verifier](https://ioproof.com/standalone-verifier).

## Planned API

```js
const { verifyProof, hashPayload, walkMerkleProof } = require('@ioproof/core');

// Verify an exported proof bundle (works with both owner and user secrets)
const result = await verifyProof(proofBundle);
// { valid: true, steps: [...], onChainRoot: '...', merkleValid: true, accessType: 'owner' | 'user' }
```

## Dual-secret support

IOProof generates two independent secrets per proof — one for the service owner, one for the end-user. Both unlock the same proof. `@ioproof/core` will support verifying with either secret.

## Related packages

- [`ioproof`](https://www.npmjs.com/package/ioproof) — Main package
- [`@ioproof/client`](https://www.npmjs.com/package/@ioproof/client) — HTTP client for the IOProof API

## License

MIT — [Alexiuz AS](https://alexiuz.com)

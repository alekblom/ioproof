# @ioproof/client

HTTP client for the IOProof API — proxy AI calls with cryptographic attestation and dual-secret verification.

## Status

SDK is under active development. For now, use the REST API directly.

## Planned API

```js
const { IOProofClient } = require('@ioproof/client');

const client = new IOProofClient({
  apiKey: 'iop_live_...',
  baseUrl: 'https://ioproof.com', // or your self-hosted instance
});

// Proxy a request through IOProof
const result = await client.proxy('openai', '/v1/chat/completions', {
  providerKey: 'sk-...',
  body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
});

console.log(result.provider_response);          // Original AI response
console.log(result.verification.secret);        // Owner secret (keep server-side)
console.log(result.verification.user_secret);   // User secret (give to end-user)
console.log(result.verification.user_verify_url); // Verification link for end-user
```

## Dual-secret verification

Every proof generates two independent secrets. The service keeps `secret` and gives `user_secret` to the end-user. Both can verify the full interaction independently — ideal for dispute resolution and regulatory compliance.

## Related packages

- [`ioproof`](https://www.npmjs.com/package/ioproof) — Main package
- [`@ioproof/core`](https://www.npmjs.com/package/@ioproof/core) — Hash verification and Merkle proof utilities

## License

MIT — [Alexiuz AS](https://alexiuz.com)

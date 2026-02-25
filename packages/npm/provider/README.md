# @ioproof/provider

Cryptographic response signing middleware for AI providers. Makes [IOProof](https://ioproof.com) proofs tamper-proof with Ed25519 signatures.

## What this does

When installed on an AI provider's API server, this middleware:

1. Captures the raw request and response bodies
2. SHA-256 hashes both
3. Ed25519-signs the hashes with the provider's private key
4. Adds signature headers to every response

IOProof captures these headers automatically and verifies the signature against the provider's published public key. This proves the provider actually processed the request and generated the response — closing the trust gap in IOProof's attestation model.

## Quick start

```bash
npm install @ioproof/provider
```

### 1. Generate a keypair

```javascript
const { generateKeyPair } = require('@ioproof/provider');
const keys = generateKeyPair();
console.log(keys);
// { publicKey: 'aabb...hex', privateKey: 'ccdd...hex', keyId: '2026-02' }
```

Store the private key securely (environment variable). The public key goes in your `.well-known/ioproof.json`.

### 2. Add the middleware

```javascript
const express = require('express');
const { middleware, wellKnown } = require('@ioproof/provider');

const app = express();

// Sign every response
app.use(middleware({
  privateKey: process.env.IOPROOF_PRIVATE_KEY,
  keyId: '2026-02',
}));

// Publish your public key
app.get('/.well-known/ioproof.json', wellKnown([
  { kid: '2026-02', publicKey: process.env.IOPROOF_PUBLIC_KEY },
]));

// Your existing API routes...
app.post('/v1/chat/completions', (req, res) => {
  // Business logic as usual — signing happens automatically
  res.json({ choices: [{ message: { content: 'Hello!' } }] });
});
```

### 3. Verify it works

```bash
curl -s -D - -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}' 2>&1 | grep -i ioproof
```

You should see:
```
X-IOProof-Sig: MEUCIQDf3j...base64...
X-IOProof-Sig-Ts: 2026-02-25T21:49:18.566Z
X-IOProof-Key-Id: 2026-02
```

## How verification works

1. Provider signs: `Ed25519(ioproof:v1:{SHA-256(request)}|{SHA-256(response)}|{timestamp})`
2. IOProof captures the signature header (automatically, via existing header capture)
3. IOProof fetches the provider's public key from `{providerBaseUrl}/.well-known/ioproof.json`
4. IOProof verifies the signature cryptographically
5. Proof is marked as "Provider Verified" — tamper-proof

## Low-level API

For non-Express frameworks:

```javascript
const { createSigner } = require('@ioproof/provider');
const sign = createSigner(privateKeyHex, '2026-02');

// After handling a request...
const result = sign(requestBody, responseBody);
// result.headers => { 'X-IOProof-Sig': '...', 'X-IOProof-Sig-Ts': '...', 'X-IOProof-Key-Id': '...' }

// Set these headers on your response manually
```

## Key rotation

Add new keys without downtime:

```javascript
app.get('/.well-known/ioproof.json', wellKnown([
  { kid: '2026-03', publicKey: newPublicKeyHex },  // Current
  { kid: '2026-02', publicKey: oldPublicKeyHex },  // Previous (still valid for old proofs)
]));
```

## Security

- Private keys should be stored in secure environment variables
- Never commit private keys to version control
- Rotate keys monthly (suggested keyId format: YYYY-MM)
- The middleware never crashes your API — signing errors are caught and logged

## License

MIT

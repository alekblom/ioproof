---
title: "Your AI Chatbot Said What? Solving the Two-Party Proof Problem with Dual-Secret Verification"
published: true
tags: ai, security, solana, opensource
---

When your AI chatbot tells a user their insurance claim is approved, and the user later says the chatbot said something different -- who's right?

Neither can prove anything. The request went to OpenAI, the response came back, and both parties are left with nothing but screenshots and trust. This is the **two-party proof problem**, and it gets worse the more consequential AI interactions become.

I built [IOProof](https://github.com/alekblom/ioproof) to solve it. It is an open-source proxy that sits between your service and any AI API, capturing and cryptographically attesting every interaction. The interesting part is the **dual-secret verification model** -- the thing that makes it actually useful when two parties disagree.

## The Architecture in 60 Seconds

IOProof is a Node.js/Express proxy. You point your API calls through it instead of directly at OpenAI/Anthropic/etc. For every request-response pair, the system:

1. Captures the raw bytes of both request and response
2. SHA-256 hashes everything
3. Generates two independent cryptographic secrets
4. Blinds the proof and batches it into a Merkle tree
5. Commits the Merkle root to Solana

Here is the hashing core -- it is deliberately simple:

```javascript
const crypto = require('crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildCombinedHash(requestHash, responseHash, timestamp) {
  const payload = `${requestHash}|${responseHash}|${timestamp}`;
  return sha256(Buffer.from(payload, 'utf-8'));
}
```

The combined hash binds the request, response, and timestamp together. Change a single byte in any of them and you get a completely different hash. Nothing new here -- this is textbook content-addressable integrity.

## Where It Gets Interesting: Dual Secrets

The first version of IOProof generated one secret per proof. The API caller (say, your chatbot service) got the secret, and if the end-user wanted to verify, the service had to manually share it. That is a trust bottleneck -- the very thing we are trying to eliminate.

The fix is to generate **two independent secrets** at proof creation:

```javascript
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// In the proxy route:
const secret = generateSecret();      // owner secret (for the API caller)
const userSecret = generateSecret();   // user secret (for the end-user)
const blindedHash = blindHash(combinedHash, secret);
```

Both secrets unlock identical proof details -- full request/response payloads, all hashes, the Merkle proof, the Solana transaction. But they are verified through **different cryptographic mechanisms**, and that distinction matters.

## Two Verification Paths

The owner secret is verified via **blinding**. The blinded hash is what goes on-chain, and it is computed as:

```javascript
function blindHash(combinedHash, secret) {
  return sha256(Buffer.from(`${combinedHash}|${secret}`, 'utf-8'));
}
```

At verification time, the server re-derives the blinded hash from the supplied secret. If `SHA-256(combined_hash | secret) === stored_blinded_hash`, the owner is authenticated. No stored secret to compare against -- just math.

The user secret is verified via **constant-time direct comparison**:

```javascript
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
```

Why `timingSafeEqual`? A naive `===` comparison short-circuits on the first differing byte, leaking information about how many leading characters matched. That is a textbook timing side-channel. `crypto.timingSafeEqual` always takes the same amount of time regardless of input, preventing an attacker from brute-forcing the secret byte-by-byte.

The verify endpoint distinguishes which path succeeded:

```javascript
// Owner: re-derive the blinded hash
const expectedBlinded = blindHash(proof.combinedHash, secret);
if (expectedBlinded === proof.blindedHash) {
  secretValid = true;
  accessType = 'owner';
}

// User: constant-time comparison against stored secret
if (!secretValid && proof.userSecret && safeEqual(secret, proof.userSecret)) {
  secretValid = true;
  accessType = 'user';
}
```

The response includes `access_type: "owner"` or `access_type: "user"`, so you always know which party verified. Both get identical proof data. Neither needs to trust the other or coordinate access.

## Merkle Batching: One Transaction, Thousands of Proofs

Writing a Solana transaction per API call would be expensive and slow. Instead, IOProof batches pending proofs into a Merkle tree and commits just the root:

```javascript
function buildMerkleTree(leaves) {
  if (leaves.length === 0) return { root: null, layers: [] };
  if (leaves.length === 1) return { root: leaves[0], layers: [leaves] };

  const layers = [leaves.slice()];
  let currentLayer = leaves.slice();

  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length
        ? currentLayer[i + 1]
        : left; // duplicate last if odd
      nextLayer.push(sha256(left + right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return { root: currentLayer[0], layers };
}
```

The leaves are **blinded hashes**, not raw data. Nothing on-chain reveals what was actually said. Each proof stores its own Merkle path, so any individual proof can be independently verified against the on-chain root without needing the full batch.

The root goes to Solana as a memo instruction:

```
ioproof|batch|{batchId}|{merkleRoot}|{proofCount}|{timestamp}
```

One transaction. A few cents. Proves thousands of interactions.

## The Concrete Use Case

Here is how this plays out in practice. Say you run an AI chatbot called Botlor:

1. User asks Botlor a question
2. Botlor proxies the request through IOProof to OpenAI
3. IOProof captures both directions, hashes everything, generates dual secrets
4. Botlor gets the receipt with `secret` (owner) and `user_secret`
5. Botlor keeps `secret`, sends the user a verification link containing `user_secret`
6. Both can independently verify via `GET /api/verify/:hash?secret=...`

In a dispute, the user clicks their link and sees the exact request and response, along with the Solana transaction that commits to it. The service does the same with their secret. Neither had to ask the other for anything.

There is also a standalone browser verifier that re-hashes everything client-side and fetches the Solana transaction directly via RPC -- zero trust in IOProof itself required.

## Try It

IOProof launches publicly on **March 1, 2026**. Early access is open now.

- **Self-host** (MIT licensed, unlimited proofs): [github.com/alekblom/ioproof](https://github.com/alekblom/ioproof)
- **Hosted free tier** (100 proofs/month): [ioproof.com/register](https://ioproof.com/register)
- **npm**: `npm install ioproof` ([v0.2.0](https://www.npmjs.com/package/ioproof))

The entire proxy is a single Node.js process. Point your existing API calls at it, and every interaction becomes independently verifiable by both parties. The code is MIT -- read it, fork it, poke holes in it.

If you are building anything where AI outputs have real-world consequences -- customer support, medical triage, financial advice, legal research -- the question is not whether you need audit trails. It is whether both sides should be able to prove what happened without trusting each other.

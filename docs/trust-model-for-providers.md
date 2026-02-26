# Trust Model — Why Providers Should Sign

This document is for provider security teams evaluating IOProof's provider signing middleware.

## The Problem

IOProof is a cryptographic attestation proxy that sits between users and AI providers. It creates tamper-evident proofs of API interactions, committed to the Solana blockchain via Merkle trees.

**Without provider signing**, the proxy operator can:
- Modify request or response data before hashing
- Fabricate proofs for interactions that never happened
- Claim a different response was generated

The cryptography is sound (SHA-256, Merkle proofs, on-chain commitment), but it only proves the *hashes* haven't changed — not that the original data was genuine.

## What Provider Signing Proves

With provider signing, your server adds an Ed25519 signature to every response:

```
Signed message: ioproof:v1:{SHA256(request)}|{SHA256(response)}|{timestamp}
```

This cryptographically proves:
1. **Authenticity** — your server processed this exact request
2. **Integrity** — you generated this exact response
3. **Timing** — at this specific timestamp
4. **Non-repudiation** — only your private key could produce this signature

No proxy, middleware, or third party can forge this without your private key.

## What You Sign

- SHA-256 hash of the raw request body (not the content itself)
- SHA-256 hash of the raw response body (not the content itself)
- An ISO 8601 timestamp

The signed message is a fixed-format string. No request content, user data, API keys, or metadata is included in the signature.

## Privacy Implications

- Your **public key** is published at `/.well-known/ioproof.json` (this is intentional — verifiers need it)
- The **signature** reveals nothing about the request or response content
- Hashes are one-way — content cannot be recovered from SHA-256 hashes
- The signature itself is a 64-byte Ed25519 value with no embedded data

## Performance

| Operation | Time | Note |
|-----------|------|------|
| SHA-256 hash (4KB body) | ~5 µs | Negligible |
| Ed25519 sign | ~50 µs | Per request |
| Total overhead | ~60 µs | Less than 0.1ms per request |

Memory overhead is minimal: the middleware buffers the response body (which Express/FastAPI/Flask already do for most endpoints).

## Security Properties

- **Ed25519** (RFC 8032) — deterministic, no random nonce, no timing attacks
- **Zero external dependencies** (Node.js SDK) — nothing to audit beyond Node.js stdlib
- **One dependency** (Python SDK) — `cryptography` library (widely used, audited)
- **Zero external dependencies** (Go SDK) — Go standard library only
- **Fail-open** — signing errors are caught; your API never crashes or returns 500s
- **Key rotation** — multiple keys supported via `.well-known/ioproof.json`

## Key Management

- Private keys are 32-byte Ed25519 seeds, stored as hex strings in environment variables
- Monthly rotation is recommended (use YYYY-MM key IDs)
- Add new keys to `.well-known` before retiring old ones
- IOProof caches public keys for 1 hour
- If a key is compromised, remove it from `.well-known` immediately

## No Lock-In

- MIT-licensed, open-source middleware
- Remove the middleware at any time — your API continues working
- The `.well-known` endpoint is a simple JSON file you control
- IOProof never calls your API — it only reads the `.well-known` endpoint to fetch public keys
- Existing signed proofs remain valid even after you remove the middleware

## Integration Effort

| Language | Install | Code Changes | Dependencies |
|----------|---------|-------------|-------------|
| Node.js (Express) | `npm i @ioproof/provider` | 3 lines | 0 |
| Python (FastAPI) | `pip install ioproof` | 5 lines | 1 (cryptography) |
| Python (Flask) | `pip install ioproof` | 4 lines | 1 (cryptography) |
| Go (net/http) | `go get github.com/ioproof/go-provider` | 5 lines | 0 |

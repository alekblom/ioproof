# Provider Signing — Onboarding Guide

Add tamper-proof cryptographic signatures to your AI API responses in minutes. IOProof captures these signatures to create proofs that **no one** — not even the IOProof server operator — can fabricate or modify.

## Why Sign Your Responses?

Without provider signing, a proxy operator can modify request/response data before creating proofs. With signing, your Ed25519 signature cryptographically binds each request to its response. Anyone can verify the signature against your public key — no trust required.

- **3 lines of code** (Express/FastAPI/Flask) or **1 middleware** (Go)
- **Zero overhead** — Ed25519 signing takes ~50 microseconds
- **Never crashes your API** — all errors are caught and logged silently
- **No lock-in** — remove the middleware at any time, your API still works

## Quick Setup

### 1. Generate Keys

**Node.js:**
```bash
npx @ioproof/provider init
```

**Python:**
```bash
pip install ioproof
ioproof-keygen
```

**Go:** Use `GenerateKeyPair()` in code (see Go section below).

This gives you three env vars:
```
IOPROOF_PRIVATE_KEY=<64-char hex>
IOPROOF_PUBLIC_KEY=<64-char hex>
IOPROOF_KEY_ID=2026-02
```

### 2. Add Middleware

#### Node.js (Express)

```bash
npm install @ioproof/provider
```

```javascript
const { middleware, wellKnown } = require('@ioproof/provider');

app.use(middleware({
  privateKey: process.env.IOPROOF_PRIVATE_KEY,
  keyId: process.env.IOPROOF_KEY_ID,
}));

app.get('/.well-known/ioproof.json', wellKnown([
  { kid: process.env.IOPROOF_KEY_ID, publicKey: process.env.IOPROOF_PUBLIC_KEY },
]));
```

#### Python (FastAPI)

```bash
pip install ioproof
```

```python
import os
from ioproof.middleware_fastapi import IOProofMiddleware, well_known_route

app.add_middleware(
    IOProofMiddleware,
    private_key=os.environ["IOPROOF_PRIVATE_KEY"],
    key_id=os.environ["IOPROOF_KEY_ID"],
)

@app.get("/.well-known/ioproof.json")
async def ioproof_keys():
    return well_known_route([{
        "kid": os.environ["IOPROOF_KEY_ID"],
        "public_key": os.environ["IOPROOF_PUBLIC_KEY"],
    }])
```

#### Python (Flask)

```python
import os
from ioproof.middleware_flask import init_app, well_known_blueprint

init_app(app,
    private_key=os.environ["IOPROOF_PRIVATE_KEY"],
    key_id=os.environ["IOPROOF_KEY_ID"],
)

app.register_blueprint(well_known_blueprint([{
    "kid": os.environ["IOPROOF_KEY_ID"],
    "public_key": os.environ["IOPROOF_PUBLIC_KEY"],
}]))
```

#### Go (net/http)

```bash
go get github.com/ioproof/go-provider
```

```go
import ioproof "github.com/ioproof/go-provider"

// Wrap your handler with signing middleware
handler := ioproof.Middleware(
    os.Getenv("IOPROOF_PRIVATE_KEY"),
    os.Getenv("IOPROOF_KEY_ID"),
)(mux)

// Serve public key
wellKnown, _ := ioproof.WellKnownJSON([]ioproof.KeyEntry{
    {KID: os.Getenv("IOPROOF_KEY_ID"), PublicKey: os.Getenv("IOPROOF_PUBLIC_KEY")},
})
mux.HandleFunc("/.well-known/ioproof.json", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Cache-Control", "public, max-age=3600")
    w.Write(wellKnown)
})
```

### 3. Verify It Works

```bash
curl -v https://your-api.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'
```

Check for these response headers:
```
X-IOProof-Sig: <base64 signature>
X-IOProof-Sig-Ts: 2026-02-26T12:00:00.000Z
X-IOProof-Key-Id: 2026-02
```

And verify your public key is accessible:
```bash
curl https://your-api.com/.well-known/ioproof.json
```

## How It Works

1. Your middleware captures the raw request and response bodies
2. Both are SHA-256 hashed: `SHA256(request)` and `SHA256(response)`
3. A message is built: `ioproof:v1:{reqHash}|{resHash}|{timestamp}`
4. The message is signed with your Ed25519 private key
5. Three headers are added to the response (signature, timestamp, key ID)
6. IOProof's proxy captures these headers and verifies against your public key

The signature proves: "This exact request produced this exact response, at this exact time, on my server."

## Key Rotation

Add new keys to your `.well-known/ioproof.json` before retiring old ones:

```json
{
  "version": "1.0",
  "keys": [
    { "kid": "2026-03", "algorithm": "ed25519", "public_key": "<new key hex>" },
    { "kid": "2026-02", "algorithm": "ed25519", "public_key": "<old key hex>" }
  ]
}
```

IOProof caches keys for 1 hour, so keep old keys in the list for at least 2 hours after switching.

## FAQ

**Does signing slow down my API?**
No. Ed25519 signing takes ~50 microseconds. SHA-256 hashing of a typical 4KB response takes ~5 microseconds.

**What if signing fails?**
Your API keeps working normally. All SDKs catch errors silently and log a warning. No signature headers are added, and the response is sent unmodified.

**What data is exposed?**
Nothing. The signature signs *hashes* of the request and response, not the content itself. Your public key is the only thing published.

**Can I remove it later?**
Yes. Remove the middleware, delete the `.well-known` endpoint. Existing proofs that were signed remain valid (the signature is stored in IOProof's proof record).

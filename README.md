# IOProof

Cryptographic attestation proxy for AI interactions. Proves what inputs were sent and what outputs were received, with Merkle-batched proof commitments to Solana.

## How it works

IOProof sits between you and any API provider. For every API call:

1. **SHA-256 hashes** the exact request and response payloads
2. **Generates dual secrets** — two independent 256-bit nonces: one for the API caller (owner), one for the end-user
3. **Blinds the proof** — `SHA-256(combined_hash | owner_secret)` produces a blinded hash
4. **Queues** the blinded proof for the next Merkle batch
5. **Returns** the API response alongside a verification receipt (including both secrets)

Periodically (default: hourly), the batch processor:

1. Collects all pending **blinded** proofs
2. Builds a Merkle tree from their blinded hashes
3. Commits the Merkle root to Solana in a single transaction
4. Stores individual Merkle paths for each proof

The result is tamper-evident, on-chain records — without exposing any interaction data. Either secret can independently link a proof back to the original request/response — so both parties (e.g. a service and its end-user) can verify without trusting each other.

## Providers

IOProof ships with these providers pre-configured, but you can add any HTTP API by editing `src/providers/providers.json`:

- **OpenAI** (GPT-4o, o1, etc.)
- **Anthropic** (Claude)
- **xAI** (Grok)
- **Google Gemini**

### Adding a custom provider

Edit `src/providers/providers.json` and add an entry:

```json
{
  "my-provider": {
    "baseUrl": "https://api.my-provider.com",
    "authType": "bearer"
  }
}
```

Each provider entry supports:

| Field | Required | Description |
|---|---|---|
| `baseUrl` | yes | Target API base URL |
| `authType` | yes | `"bearer"` (Authorization: Bearer) or `"header"` (custom header) |
| `authHeader` | when `authType: "header"` | Custom auth header name (e.g. `"x-api-key"`) |
| `extraHeaders` | no | Additional static headers to include (e.g. `{ "anthropic-version": "2023-06-01" }`) |

Restart the server after editing. The new provider will be available at `/v1/proxy/my-provider/*`.

## Quick start

### Use hosted (ioproof.com)

1. Register at [ioproof.com/register](https://ioproof.com/register)
2. Create an API key in the [dashboard](https://ioproof.com/dashboard/keys)
3. Send requests with `X-IOProof-Key` header

### Self-host

```bash
git clone https://github.com/alekblom/ioproof.git
cd ioproof
npm install
cp .env.example .env
# Edit .env: set SOLANA_KEYPAIR_SECRET, optionally REQUIRE_API_KEY=false
npm start
```

## Usage

Send requests to the proxy instead of directly to the API provider. Pass your provider API key via `X-Provider-Key` and your IOProof API key via `X-IOProof-Key` (required on hosted, optional on self-hosted with `REQUIRE_API_KEY=false`).

### OpenAI

```bash
curl -X POST http://localhost:3000/v1/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: sk-your-openai-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Anthropic

```bash
curl -X POST http://localhost:3000/v1/proxy/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: sk-ant-your-key" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### xAI

```bash
curl -X POST http://localhost:3000/v1/proxy/xai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: xai-your-key" \
  -d '{
    "model": "grok-3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Google Gemini

```bash
curl -X POST http://localhost:3000/v1/proxy/gemini/v1beta/models/gemini-2.5-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: your-gemini-key" \
  -d '{
    "contents": [{"parts": [{"text": "Hello"}]}]
  }'
```

### Custom provider

```bash
curl -X POST http://localhost:3000/v1/proxy/my-provider/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: your-api-key" \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Response format

Every response wraps the provider's original response with a verification receipt:

```json
{
  "provider_response": { "...original AI response..." },
  "verification": {
    "request_hash": "sha256:abc123...",
    "response_hash": "sha256:def456...",
    "combined_hash": "sha256:789ghi...",
    "blinded_hash": "sha256:b1inded...",
    "secret": "a1b2c3d4...64-char-hex...",
    "user_secret": "e5f6a7b8...64-char-hex...",
    "timestamp": "2026-02-20T17:45:00.000Z",
    "batch_status": "pending_batch",
    "verify_url": "https://ioproof.com/verify/789ghi...?secret=a1b2c3d4...",
    "user_verify_url": "https://ioproof.com/verify/789ghi...?secret=e5f6a7b8...",
    "privacy_note": "Only the blinded_hash appears on-chain. Give user_secret to the end-user so both parties can verify."
  }
}
```

After batch processing, verify with your secret to get full details:

```bash
curl "https://ioproof.com/api/verify/789ghi...?secret=a1b2c3d4..."
```

```json
{
  "found": true,
  "blinded_hash": "b1inded...",
  "solana_status": "confirmed",
  "batch_id": "batch_m2abc_1f2e3d4c",
  "merkle_root": "aaa111...",
  "merkle_proof": [{"hash": "...", "position": "left"}, ...],
  "merkle_valid": true,
  "secret_valid": true,
  "access_type": "owner",
  "combined_hash": "789ghi...",
  "request_hash": "abc123...",
  "response_hash": "def456...",
  "timestamp": "2026-02-20T17:45:00.000Z",
  "provider": "openai",
  "target_url": "https://api.openai.com/v1/chat/completions",
  "response_status": 200,
  "solana_signature": "5Kz...",
  "explorer_url": "https://explorer.solana.com/tx/5Kz...?cluster=devnet",
  "request_body": "{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}",
  "response_body": "{\"id\":\"chatcmpl-...\",\"choices\":[{\"message\":{\"content\":\"Hi there!\"}}]}"
}
```

With the secret, you get the **complete audit trail**: the exact data sent, where it was sent, and the exact response received — all cryptographically linked to the on-chain proof.

Without the secret, only the blinded hash and batch status are returned — no interaction data is exposed.

## Merkle batching

Instead of committing each proof individually (expensive), IOProof batches proofs into a Merkle tree:

- **Cost reduction**: 1000 proofs = 1 Solana transaction instead of 1000
- **Privacy**: Merkle leaves are blinded hashes — raw data never touches the chain
- **Same security**: Each proof includes a Merkle path to the on-chain root
- **Independent verification**: Present your secret to verify a proof's inclusion
- **Configurable interval**: Default hourly, adjust via `BATCH_INTERVAL_MS`

## Verify a proof

Verify with your secret (full details):

```bash
curl "https://ioproof.com/api/verify/<combined_hash>?secret=<your_secret>"
```

Verify without secret (existence only, no interaction data leaked):

```bash
curl https://ioproof.com/api/verify/<combined_hash>
```

Look up a batch:

```bash
curl https://ioproof.com/api/verify/batch/<batch_id>
```

Or visit `https://ioproof.com/verify/<hash>?secret=<secret>` in your browser.

## Independent verification

IOProof includes a **standalone verifier** that runs entirely in the browser — no server calls to IOProof, no trust required:

1. Export a proof bundle via the dashboard or API (`GET /api/verify/export/:hash?secret=...`)
2. Open the [standalone verifier](https://ioproof.com/standalone-verifier) (or host it yourself)
3. Upload or paste the JSON bundle
4. The verifier re-computes all SHA-256 hashes client-side, walks the Merkle proof, and fetches the Solana RPC directly to confirm the on-chain root matches

This means anyone can independently verify a proof against Solana without trusting IOProof at all.

## API endpoints

| Endpoint | Description |
|---|---|
| `POST /v1/proxy/:provider/*` | Proxy + attest any API call (requires `X-IOProof-Key`) |
| `POST /v1/attest` | Post-hoc attestation for pre-collected request/response pairs |
| `GET /api/verify/:hash?secret=` | Look up a proof (secret required for full details) |
| `GET /api/verify/export/:hash?secret=` | Download self-contained proof bundle (for independent verification) |
| `GET /api/verify/batch/:batchId` | Look up a batch by ID |
| `POST /auth/register` | Create account (email + password) |
| `POST /auth/login` | Login (sets session cookie) |
| `POST /auth/logout` | Logout (clears session) |
| `GET /auth/activate?email=&hash=` | Activate account via email link |
| `GET /auth/me` | Current user info (requires session) |
| `GET /api/dashboard/stats` | Dashboard stats (requires session) |
| `GET /api/dashboard/keys` | List API keys (requires session) |
| `POST /api/dashboard/keys` | Create API key (requires session) |
| `DELETE /api/dashboard/keys/:id` | Revoke an API key (requires session) |
| `GET /api/dashboard/proofs?page=` | Paginated list of user's proofs (requires session) |
| `GET /api/dashboard/usage` | Usage stats (requires session) |
| `PUT /api/dashboard/account` | Update email or password (requires session) |
| `GET /health` | Health check (includes Solana balance) |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment |
| `BASE_URL` | `https://ioproof.com` | Base URL for verification links (change for self-hosted) |
| `REQUIRE_API_KEY` | `true` | Require API key for proxy calls (set `false` for self-hosted) |
| `SESSION_SECRET` | auto-generated | Secret for session hashing |
| `EMAIL_API_KEY` | - | ElasticEmail API key for verification emails (optional) |
| `EMAIL_FROM` | `noreply@ioproof.com` | Sender email for verification |
| `SOLANA_RPC_URL` | devnet | Solana RPC endpoint |
| `SOLANA_KEYPAIR_SECRET` | - | JSON array of Ed25519 secret key bytes |
| `SOLANA_CLUSTER` | devnet | Solana cluster for explorer links (`devnet`, `testnet`, `mainnet-beta`) |
| `BATCH_INTERVAL_MS` | 3600000 | Batch processing interval (1 hour) |
| `BATCH_MIN_PROOFS` | 1 | Minimum proofs to trigger a batch |
| `IOPROOF_SIGNING_PRIVATE_KEY` | - | Ed25519 private key (hex) for signing IOProof's own responses |
| `IOPROOF_SIGNING_PUBLIC_KEY` | - | Ed25519 public key (hex) served at `/.well-known/ioproof.json` |
| `IOPROOF_SIGNING_KEY_ID` | - | Key identifier for rotation (e.g. `2026-02`) |

## Hosted vs self-hosted

| | Hosted (ioproof.com) | Self-hosted |
|---|---|---|
| Proxy auth | API key required | No auth needed (`REQUIRE_API_KEY=false`) |
| Usage limits | 100 proofs/month (free tier) | Unlimited |
| Registration | Email verification | Auto-activated (or skip if no `EMAIL_API_KEY`) |
| Dashboard | Full | Full |
| Solana | Shared wallet | Your own keys |
| License | Free tier | MIT |

## Self-hosting

```bash
git clone https://github.com/alekblom/ioproof.git
cd ioproof && npm install
cp .env.example .env
# Edit .env: set SOLANA_KEYPAIR_SECRET, REQUIRE_API_KEY=false
npm start
```

Set `BASE_URL` to your domain for correct verification links:

```
BASE_URL=https://proof.mydomain.com
REQUIRE_API_KEY=false
```

## How verification works

1. The proxy captures the **exact raw bytes** of every request and response
2. SHA-256 hashes are computed before any parsing or transformation
3. A combined hash is created: `SHA-256(request_hash + "|" + response_hash + "|" + timestamp)`
4. Two random 256-bit **secrets** are generated (owner + user) and a **blinded hash** is created: `SHA-256(combined_hash + "|" + owner_secret)`
5. The full request body, target URL, and response body are **stored server-side** for audit retrieval
6. The **blinded hash** (not the combined hash) is used as the Merkle leaf
7. Proofs are collected and a Merkle tree is built from their blinded hashes
8. The Merkle root is committed to Solana via a [memo transaction](https://spl.solana.com/memo)
9. Each proof stores its Merkle path for independent verification

**To verify**: present your secret → IOProof re-derives the blinded hash, walks the Merkle path to the root, confirms the root matches the on-chain commitment, and returns the full request/response data

## Full audit trail

IOProof stores the complete interaction for every proxied request:

| Stored server-side | Description |
|---|---|
| Request body | Exact payload sent to the provider |
| Target URL | The API endpoint called (e.g. `https://api.openai.com/v1/chat/completions`) |
| Response body | Exact payload received from the provider |
| Response status | HTTP status code (200, 400, etc.) |
| Provider | Provider name (openai, anthropic, etc.) |
| Timestamp | When the interaction occurred |
| Hashes | SHA-256 of request, response, combined, and blinded |

This data is only accessible via the verify endpoint **with a valid secret**. Without the secret, only the blinded hash and on-chain status are returned.

Payloads are stored as individual files in `data/payloads/` — one file per proof, keyed by combined hash.

## Privacy model

IOProof uses **blinded commitments** to ensure no interaction data is exposed on-chain:

| What's on-chain | What's stored on IOProof (secret-gated) |
|---|---|
| Merkle root (a single hash) | Full request/response payloads |
| Batch metadata (ID, count, timestamp) | Target URL, provider, timestamps |
| Solana transaction signature | Individual proof hashes |
| | API keys are **never** stored |

**How it works**: Each proof is blinded with a unique secret before being included in the Merkle tree. The secret acts as a cryptographic nonce — without it, the blinded hash cannot be linked back to the original interaction.

**Dual secrets**: Every proof generates two independent secrets:
- **`secret`** (owner) — returned to the API caller (e.g. a service like Botlor)
- **`user_secret`** — intended for the end-user (e.g. a chat user)

Both secrets independently unlock full proof details. The caller keeps one and gives `user_secret` to their end-user. In a dispute, both parties can independently verify the exact request and response without relying on each other.

**What this means**:
- **On-chain**: an observer sees only a Merkle root — they cannot determine how many proofs are in the tree, what providers were used, or any request/response content
- **On IOProof**: full data is stored but only accessible with a valid secret — proving involvement in the interaction
- **Multi-party trust**: both the service and its end-user can verify independently — neither needs to trust the other
- **Selective disclosure**: share a secret with a third party to prove a specific interaction occurred, without revealing any other proofs in the same batch

This is a zero-knowledge-style approach using hash-based commitments — no complex ZK circuits required, just SHA-256 blinding with random nonces.

## Trust model

IOProof provides three distinct levels of trust, each with different verification requirements:

### 1. Cryptographic (provable by anyone)

The hash math, Merkle proofs, and Solana commitment are independently verifiable. Anyone with a secret can:

- Re-derive SHA-256 hashes from the stored payloads
- Walk the Merkle path to the on-chain root
- Confirm the root matches the Solana memo transaction

This proves **when** a proof was committed and that the **recorded data hasn't changed since**. No trust in IOProof is required for this level — use the [standalone verifier](https://ioproof.com/standalone-verifier) or verify manually.

### 2. Auditable (verifiable with provider cooperation)

AI providers return response headers with unique request IDs and server timestamps. IOProof captures these headers and includes them in the proof record:

| Provider | Request ID Header | Server Timestamp | Processing Time |
|---|---|---|---|
| OpenAI | `x-request-id` | `date` | `openai-processing-ms` |
| Anthropic | `request-id` | `date` | `x-envoy-upstream-service-time` |
| xAI | `x-request-id` | `date` | `x-metrics-e2e-ms` |
| DeepSeek | `x-ds-trace-id` | `date` | — |
| Google Gemini | — | `date` | `server-timing` |

These headers link each proof to the provider's internal logs. In an audit or dispute, the provider can confirm whether a request ID exists in their records and whether the recorded response matches. This creates an **auditable chain** from IOProof's proof to the provider's own data.

Note: Google Gemini does not return a unique request ID, making it the weakest link in the audit trail. Only the `date` header is available for correlation.

### 3. Provider-signed (cryptographic, when supported)

AI providers can install [`@ioproof/provider`](https://www.npmjs.com/package/@ioproof/provider) — a lightweight Express middleware that Ed25519-signs every response. The signature ties the exact request content to the exact response content:

1. Provider signs: `Ed25519(ioproof:v1:{SHA-256(request)}|{SHA-256(response)}|{timestamp})`
2. IOProof captures the signature headers automatically (via existing header capture)
3. IOProof fetches the provider's public key from `{providerBaseUrl}/.well-known/ioproof.json`
4. IOProof verifies the signature cryptographically
5. Proof is marked as **"Provider Verified"** — tamper-proof

When a provider supports signing, proofs reach the highest trust level: anyone can verify that the provider actually processed the request and generated the response, without trusting the operator or IOProof. The signature headers are:

| Header | Value |
|---|---|
| `X-IOProof-Sig` | Base64 Ed25519 signature |
| `X-IOProof-Sig-Ts` | ISO timestamp used in signature |
| `X-IOProof-Key-Id` | Key identifier for rotation |

See [@ioproof/provider on npm](https://www.npmjs.com/package/@ioproof/provider) for installation instructions. Zero dependencies, 3 lines to add to an Express server.

### 4. Operator trust (assumption, when provider doesn't sign)

Without provider signing, IOProof proves that recorded data hasn't changed — but does **not** independently prove that an AI provider generated specific content. In a self-hosted deployment, the operator controls both the API call and the proof generation. Without provider confirmation, the operator could theoretically submit fabricated content and generate a valid-looking proof.

**In practice**: IOProof proves *when* a proof was committed and that data hasn't changed since. Combined with provider response headers, it creates a strong audit trail. But in a scenario where the operator's integrity is the specific question being asked, the provider's logs — keyed by the captured request ID — would be the independent source of truth.

> **Note on "without trusting each other"**: The dual-secret system (described in Privacy model above) means two parties can independently verify the *same recorded data* — neither can alter the proof without the other noticing. This is distinct from proving the data is genuine in the first place, which requires the provider's cooperation or provider signing.

## Provider signing (@ioproof/provider)

AI providers can make IOProof proofs tamper-proof by installing a lightweight middleware that Ed25519-signs every API response. When installed, IOProof automatically verifies the signature and marks the proof as **"Provider Verified"**.

SDKs available for **Node.js**, **Python**, and **Go**. Generate keys with the CLI:

```bash
npx @ioproof/provider init
```

### Node.js (Express)

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

Zero dependencies, uses only Node.js built-in `crypto`. Never crashes your API — signing errors are caught and logged.

### Python (FastAPI)

```bash
pip install ioproof
```

```python
from ioproof.middleware_fastapi import IOProofMiddleware, well_known_route

app.add_middleware(IOProofMiddleware,
    private_key=os.environ["IOPROOF_PRIVATE_KEY"],
    key_id=os.environ["IOPROOF_KEY_ID"])

@app.get("/.well-known/ioproof.json")
async def ioproof_keys():
    return well_known_route([{"kid": os.environ["IOPROOF_KEY_ID"],
                              "public_key": os.environ["IOPROOF_PUBLIC_KEY"]}])
```

Also supports Flask — see `ioproof.middleware_flask`.

### Go (net/http)

```bash
go get github.com/ioproof/go-provider
```

```go
import ioproof "github.com/ioproof/go-provider"

handler := ioproof.Middleware(os.Getenv("IOPROOF_PRIVATE_KEY"),
    os.Getenv("IOPROOF_KEY_ID"))(mux)
```

Zero dependencies — Go standard library only. Works with chi, gorilla/mux, and stdlib.

### Full documentation

- [Provider onboarding guide](docs/provider-onboarding.md) — step-by-step setup for all languages
- [Trust model for providers](docs/trust-model-for-providers.md) — security team reference
- [Runnable examples](docs/examples/) — copy-paste examples for Express, FastAPI, Flask, Go

### For operators (services using IOProof)

No changes needed. When a provider installs `@ioproof/provider`, the signature headers are automatically captured by IOProof's existing header capture and verified server-side. The proof receipt and verification page will show the "Provider Verified" badge.

### Post-hoc attestation

For services that use streaming or need to submit proofs after the fact:

```bash
curl -X POST https://ioproof.com/v1/attest \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -d '{
    "request_body": "{\"messages\":[...]}",
    "response_body": "{\"choices\":[...]}",
    "provider": "openai",
    "provider_headers": {
      "x-request-id": "req_abc123",
      "date": "Tue, 25 Feb 2026 21:00:00 GMT",
      "X-IOProof-Sig": "base64signature...",
      "X-IOProof-Sig-Ts": "2026-02-25T21:00:00.000Z",
      "X-IOProof-Key-Id": "2026-02"
    }
  }'
```

The `provider_headers` field is optional. When present, IOProof extracts the provider request ID, timestamp, and verifies any provider signature automatically.

## License

MIT

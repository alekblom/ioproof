# IOProof

Cryptographic attestation proxy for AI interactions. Proves what inputs were sent and what outputs were received, with Merkle-batched proof commitments to Solana.

## How it works

IOProof sits between you and your AI provider. For every API call:

1. **SHA-256 hashes** the exact request payload
2. **Forwards** the request to the AI provider (OpenAI, Anthropic, xAI, Gemini)
3. **SHA-256 hashes** the exact response payload
4. **Queues** the proof for the next Merkle batch
5. **Returns** the AI response alongside a verification receipt

Periodically (default: hourly), the batch processor:

1. Collects all pending proofs
2. Builds a Merkle tree from their combined hashes
3. Commits the Merkle root to Solana in a single transaction
4. Stores individual Merkle paths for each proof

The result is tamper-evident, on-chain records of AI interactions — at a fraction of the cost of per-request transactions.

## Supported providers

- **OpenAI** (GPT-4o, o1, etc.)
- **Anthropic** (Claude)
- **xAI** (Grok)
- **Google Gemini**

## Quick start

```bash
git clone https://github.com/alekblom/ioproof.git
cd ioproof
npm install
cp .env.example .env
# Edit .env with your Solana keypair
npm start
```

## Usage

Send requests to the proxy instead of directly to the AI provider. Pass your API key via the `X-Provider-Key` header.

### OpenAI

```bash
curl -X POST http://localhost:3000/v1/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
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
  -H "X-Provider-Key: your-gemini-key" \
  -d '{
    "contents": [{"parts": [{"text": "Hello"}]}]
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
    "timestamp": "2026-02-20T17:45:00.000Z",
    "batch_status": "pending_batch",
    "verify_url": "https://ioproof.com/verify/789ghi..."
  }
}
```

After batch processing, the proof is updated with Merkle data and Solana confirmation:

```json
{
  "found": true,
  "combined_hash": "789ghi...",
  "solana_status": "confirmed",
  "batch_id": "batch_m2abc_1f2e3d4c",
  "merkle_root": "aaa111...",
  "merkle_proof": [{"hash": "...", "position": "left"}, ...],
  "solana_signature": "5Kz...",
  "merkle_valid": true
}
```

## Merkle batching

Instead of committing each proof individually (expensive), IOProof batches proofs into a Merkle tree:

- **Cost reduction**: 1000 proofs = 1 Solana transaction instead of 1000
- **Same security**: Each proof includes a Merkle path to the on-chain root
- **Independent verification**: Anyone can verify a proof's inclusion using the Merkle path
- **Configurable interval**: Default hourly, adjust via `BATCH_INTERVAL_MS`

## Verify a proof

Look up any hash (request, response, or combined):

```bash
curl https://ioproof.com/api/verify/<hash>
```

Look up a batch:

```bash
curl https://ioproof.com/api/verify/batch/<batch_id>
```

Or visit https://ioproof.com/verify/<hash> in your browser.

## API endpoints

| Endpoint | Description |
|---|---|
| `POST /v1/proxy/:provider/*` | Proxy + attest an AI API call |
| `GET /api/verify/:hash` | Look up a proof by hash |
| `GET /api/verify/batch/:batchId` | Look up a batch by ID |
| `GET /health` | Health check (includes Solana balance) |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment |
| `SOLANA_RPC_URL` | devnet | Solana RPC endpoint |
| `SOLANA_KEYPAIR_SECRET` | - | JSON array of Ed25519 secret key bytes |
| `BATCH_INTERVAL_MS` | 3600000 | Batch processing interval (1 hour) |
| `BATCH_MIN_PROOFS` | 1 | Minimum proofs to trigger a batch |

## How verification works

- The proxy captures the **exact raw bytes** of every request and response
- SHA-256 hashes are computed before any parsing or transformation
- A combined hash is created: `SHA-256(request_hash + "|" + response_hash + "|" + timestamp)`
- Proofs are collected and a Merkle tree is built from their combined hashes
- The Merkle root is committed to Solana via a [memo transaction](https://spl.solana.com/memo)
- Each proof stores its Merkle path for independent verification
- Anyone can verify by: (1) re-hashing the original payloads, (2) walking the Merkle path to the root, (3) checking the root matches the on-chain commitment

## License

MIT

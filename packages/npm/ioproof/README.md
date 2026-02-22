# ioproof

Cryptographic attestation for AI interactions — tamper-evident proofs with Merkle-batched Solana commitments, zero-knowledge privacy, and dual-secret verification.

## Status

SDK is under active development. For now, use the REST API directly.

## Key feature: Dual-secret verification

Every proof generates two independent secrets:
- **`secret`** — for the API caller (service/owner)
- **`user_secret`** — for the end-user

Both secrets independently unlock full proof details. The service keeps one and gives the other to the end-user. In a dispute, both parties can verify the exact request and response against the on-chain proof — without trusting each other.

## Quick start (REST API)

```bash
curl -X POST https://ioproof.com/v1/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: sk-your-openai-key" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

The response includes both secrets:

```json
{
  "provider_response": { "..." },
  "verification": {
    "secret": "owner-secret-hex...",
    "user_secret": "user-secret-hex...",
    "verify_url": "https://ioproof.com/verify/hash?secret=...",
    "user_verify_url": "https://ioproof.com/verify/hash?secret=..."
  }
}
```

## Related packages

- [`@ioproof/client`](https://www.npmjs.com/package/@ioproof/client) — HTTP client for the IOProof API
- [`@ioproof/core`](https://www.npmjs.com/package/@ioproof/core) — Hash verification and Merkle proof utilities

## Links

- [Website](https://ioproof.com)
- [GitHub](https://github.com/alekblom/ioproof)
- [Documentation](https://github.com/alekblom/ioproof#readme)

## License

MIT — [Alexiuz AS](https://alexiuz.com)

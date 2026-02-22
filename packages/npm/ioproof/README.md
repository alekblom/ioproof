# ioproof

Cryptographic attestation for AI interactions — tamper-evident proofs with Merkle-batched Solana commitments and zero-knowledge privacy.

## Status

SDK is under active development. For now, use the REST API directly.

## Quick start (REST API)

```bash
curl -X POST https://ioproof.com/v1/proxy/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-IOProof-Key: iop_live_your_key" \
  -H "X-Provider-Key: sk-your-openai-key" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
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

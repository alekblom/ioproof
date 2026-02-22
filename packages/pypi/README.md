# ioproof

Cryptographic attestation for AI interactions — tamper-evident proofs with Merkle-batched Solana commitments, zero-knowledge privacy, and dual-secret verification.

## Status

Python SDK is under active development. For now, use the REST API directly.

## Key feature: Dual-secret verification

Every proof generates two independent secrets:
- **`secret`** — for the API caller (service/owner)
- **`user_secret`** — for the end-user

Both secrets independently unlock full proof details. The service keeps one and gives the other to the end-user. In a dispute, both parties can verify the exact request and response against the on-chain proof — without trusting each other.

## Quick start (REST API)

```python
import requests

response = requests.post(
    "https://ioproof.com/v1/proxy/openai/v1/chat/completions",
    headers={
        "Content-Type": "application/json",
        "X-IOProof-Key": "iop_live_your_key",
        "X-Provider-Key": "sk-your-openai-key",
    },
    json={
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": "Hello"}],
    },
)

data = response.json()
print(data["provider_response"])              # Original AI response
print(data["verification"]["secret"])         # Owner secret (keep server-side)
print(data["verification"]["user_secret"])    # User secret (give to end-user)
print(data["verification"]["user_verify_url"])  # Verification link for end-user
```

## Planned API

```python
from ioproof import IOProofClient

client = IOProofClient(api_key="iop_live_...")

result = client.proxy(
    provider="openai",
    path="/v1/chat/completions",
    provider_key="sk-...",
    body={"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]},
)

print(result.provider_response)
print(result.verification.secret)        # Owner secret
print(result.verification.user_secret)   # User secret
```

## Links

- [Website](https://ioproof.com)
- [GitHub](https://github.com/alekblom/ioproof)
- [npm packages](https://www.npmjs.com/package/ioproof)

## License

MIT — [Alexiuz AS](https://alexiuz.com)

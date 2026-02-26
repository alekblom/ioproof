"""
Example: FastAPI server with IOProof response signing.

Run:
    pip install fastapi uvicorn ioproof
    uvicorn fastapi-provider:app --reload

Test:
    curl -X POST http://localhost:8000/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}' -v
"""

import os
from fastapi import FastAPI
from ioproof.provider import generate_keypair
from ioproof.middleware_fastapi import IOProofMiddleware, well_known_route

# Generate keys for demo (in production, use env vars)
keys = generate_keypair()
print(f"Public key:  {keys['public_key']}")
print(f"Private key: {keys['private_key']}")
print(f"Key ID:      {keys['key_id']}")

app = FastAPI()

# IOProof signing middleware — signs every response
app.add_middleware(
    IOProofMiddleware,
    private_key=keys["private_key"],
    key_id=keys["key_id"],
)

# Public key endpoint
@app.get("/.well-known/ioproof.json")
async def ioproof_keys():
    return well_known_route([{"kid": keys["key_id"], "public_key": keys["public_key"]}])

# Example API endpoint
@app.post("/v1/chat/completions")
async def chat(body: dict):
    return {
        "id": "chatcmpl-demo",
        "choices": [{"message": {"role": "assistant", "content": "Hello from the signed API!"}}],
    }

"""
Example: Flask server with IOProof response signing.

Run:
    pip install flask ioproof
    python flask-provider.py

Test:
    curl -X POST http://localhost:5000/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}' -v
"""

from flask import Flask, jsonify
from ioproof.provider import generate_keypair
from ioproof.middleware_flask import init_app, well_known_blueprint

# Generate keys for demo (in production, use env vars)
keys = generate_keypair()
print(f"Public key:  {keys['public_key']}")
print(f"Private key: {keys['private_key']}")
print(f"Key ID:      {keys['key_id']}")

app = Flask(__name__)

# IOProof signing middleware
init_app(app, private_key=keys["private_key"], key_id=keys["key_id"])

# Public key endpoint
app.register_blueprint(well_known_blueprint([
    {"kid": keys["key_id"], "public_key": keys["public_key"]},
]))

# Example API endpoint
@app.post("/v1/chat/completions")
def chat():
    return jsonify({
        "id": "chatcmpl-demo",
        "choices": [{"message": {"role": "assistant", "content": "Hello from the signed API!"}}],
    })

if __name__ == "__main__":
    app.run(debug=True)

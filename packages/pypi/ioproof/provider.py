"""
IOProof provider signing — Ed25519 response signing for AI providers.

Install this on your API server to cryptographically sign every response.
IOProof captures the signature, making proofs tamper-proof.

Signature format (cross-language compatible with Node.js and Go SDKs):
    ioproof:v1:{SHA256(request)}|{SHA256(response)}|{timestamp}
"""

import hashlib
import base64
import logging
from datetime import datetime, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger("ioproof.provider")


def sha256_hex(data):
    """SHA-256 hash, returned as lowercase hex."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def generate_keypair():
    """
    Generate a new Ed25519 keypair for signing responses.

    Returns:
        dict with keys: public_key (hex), private_key (hex), key_id (YYYY-MM)
    """
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    # Extract raw 32-byte keys as hex
    priv_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )

    now = datetime.now(timezone.utc)
    key_id = f"{now.year}-{now.month:02d}"

    return {
        "public_key": pub_bytes.hex(),
        "private_key": priv_bytes.hex(),
        "key_id": key_id,
    }


def create_signer(private_key_hex, key_id):
    """
    Create a signing function from a hex-encoded Ed25519 private key.

    Args:
        private_key_hex: 32-byte hex-encoded Ed25519 seed
        key_id: Key identifier (e.g. "2026-02")

    Returns:
        Callable sign(request_body, response_body) -> dict
    """
    private_key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_key_hex))

    def sign(request_body, response_body):
        if isinstance(request_body, str):
            request_body = request_body.encode("utf-8")
        if isinstance(response_body, str):
            response_body = response_body.encode("utf-8")

        req_hash = sha256_hex(request_body)
        res_hash = sha256_hex(response_body)
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
            f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"

        message = f"ioproof:v1:{req_hash}|{res_hash}|{timestamp}"
        signature = private_key.sign(message.encode("utf-8"))
        sig_b64 = base64.b64encode(signature).decode("ascii")

        return {
            "signature": sig_b64,
            "timestamp": timestamp,
            "key_id": key_id,
            "request_hash": req_hash,
            "response_hash": res_hash,
            "headers": {
                "X-IOProof-Sig": sig_b64,
                "X-IOProof-Sig-Ts": timestamp,
                "X-IOProof-Key-Id": key_id,
            },
        }

    return sign


def sign_with_timestamp(private_key_hex, key_id, request_body, response_body, timestamp):
    """
    Sign with an explicit timestamp (for testing / cross-language verification).
    """
    private_key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_key_hex))

    if isinstance(request_body, str):
        request_body = request_body.encode("utf-8")
    if isinstance(response_body, str):
        response_body = response_body.encode("utf-8")

    req_hash = sha256_hex(request_body)
    res_hash = sha256_hex(response_body)
    message = f"ioproof:v1:{req_hash}|{res_hash}|{timestamp}"
    signature = private_key.sign(message.encode("utf-8"))

    return {
        "signature": base64.b64encode(signature).decode("ascii"),
        "timestamp": timestamp,
        "key_id": key_id,
        "request_hash": req_hash,
        "response_hash": res_hash,
        "message": message,
    }


def verify_signature(public_key_hex, message, signature_b64):
    """
    Verify an Ed25519 signature.

    Returns True if valid, False otherwise.
    """
    try:
        pub_bytes = bytes.fromhex(public_key_hex)
        public_key = Ed25519PublicKey.from_public_bytes(pub_bytes)
        sig_bytes = base64.b64decode(signature_b64)
        public_key.verify(sig_bytes, message.encode("utf-8"))
        return True
    except Exception:
        return False


def well_known_response(keys):
    """
    Build the .well-known/ioproof.json response body.

    Args:
        keys: list of dicts with 'kid' and 'public_key' (hex)

    Returns:
        dict ready to be serialized as JSON
    """
    return {
        "version": "1.0",
        "keys": [
            {
                "kid": k["kid"],
                "algorithm": "ed25519",
                "public_key": k["public_key"],
            }
            for k in keys
        ],
    }

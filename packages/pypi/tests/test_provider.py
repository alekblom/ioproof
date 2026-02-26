"""
IOProof provider signing test suite.

Uses the same cross-language test vector as the Node.js and Go test suites.
Ed25519 is deterministic: same key + message = same signature.
"""

import hashlib
import base64

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from ioproof.provider import (
    generate_keypair,
    create_signer,
    sign_with_timestamp,
    verify_signature,
    sha256_hex,
    well_known_response,
)

# ── Cross-language test vector (identical to Node.js and Go) ─────────────────
VECTOR = {
    "private_key": "4c830864429505b175ea2fd113367a2b0671a24bd78a827fa24377c66d66b64f",
    "public_key":  "24ab368303288a10e15205fa54f15d0761b7cd3363bb017a2d4afaec1db14703",
    "key_id":      "test-2026",
    "request_body":  '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}',
    "response_body": '{"choices":[{"message":{"content":"Hi there!"}}]}',
    "timestamp":     "2026-01-15T12:00:00.000Z",
    "request_hash":  "32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02",
    "response_hash": "018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf",
    "message":       "ioproof:v1:32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02|018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf|2026-01-15T12:00:00.000Z",
    "signature":     "kz5LDmarkNtpwNa4up0Yvb+1+r/C7QIKr7R3WPvDEtdl5TQQp9bj7bG4LvcLRi+Lan1jEv0KugLC6q3ZVbnXCg==",
}


class TestGenerateKeypair:
    def test_returns_64_char_hex_keys(self):
        kp = generate_keypair()
        assert len(kp["public_key"]) == 64
        assert len(kp["private_key"]) == 64
        assert all(c in "0123456789abcdef" for c in kp["public_key"])
        assert all(c in "0123456789abcdef" for c in kp["private_key"])

    def test_returns_yyyy_mm_key_id(self):
        kp = generate_keypair()
        parts = kp["key_id"].split("-")
        assert len(parts) == 2
        assert len(parts[0]) == 4
        assert len(parts[1]) == 2

    def test_generates_unique_keys(self):
        a = generate_keypair()
        b = generate_keypair()
        assert a["public_key"] != b["public_key"]
        assert a["private_key"] != b["private_key"]


class TestCreateSigner:
    def test_returns_callable(self):
        sign = create_signer(VECTOR["private_key"], VECTOR["key_id"])
        assert callable(sign)

    def test_produces_valid_signature(self):
        sign = create_signer(VECTOR["private_key"], VECTOR["key_id"])
        result = sign("test request", "test response")

        assert "signature" in result
        assert "timestamp" in result
        assert result["key_id"] == VECTOR["key_id"]
        assert "X-IOProof-Sig" in result["headers"]
        assert "X-IOProof-Sig-Ts" in result["headers"]
        assert "X-IOProof-Key-Id" in result["headers"]

        # Verify signature
        msg = f"ioproof:v1:{result['request_hash']}|{result['response_hash']}|{result['timestamp']}"
        assert verify_signature(VECTOR["public_key"], msg, result["signature"])

    def test_handles_bytes_input(self):
        sign = create_signer(VECTOR["private_key"], VECTOR["key_id"])
        result = sign(b"req", b"res")
        assert result["signature"]

    def test_handles_empty_body(self):
        sign = create_signer(VECTOR["private_key"], VECTOR["key_id"])
        result = sign("", "")
        assert result["signature"]


class TestCrossLanguageVector:
    def test_produces_exact_expected_hashes(self):
        req_hash = sha256_hex(VECTOR["request_body"])
        res_hash = sha256_hex(VECTOR["response_body"])
        assert req_hash == VECTOR["request_hash"]
        assert res_hash == VECTOR["response_hash"]

    def test_builds_exact_expected_message(self):
        msg = f"ioproof:v1:{VECTOR['request_hash']}|{VECTOR['response_hash']}|{VECTOR['timestamp']}"
        assert msg == VECTOR["message"]

    def test_produces_exact_expected_signature(self):
        result = sign_with_timestamp(
            VECTOR["private_key"],
            VECTOR["key_id"],
            VECTOR["request_body"],
            VECTOR["response_body"],
            VECTOR["timestamp"],
        )
        assert result["signature"] == VECTOR["signature"], (
            f"Signature mismatch!\n"
            f"  Expected: {VECTOR['signature']}\n"
            f"  Got:      {result['signature']}"
        )

    def test_verifies_expected_signature(self):
        assert verify_signature(
            VECTOR["public_key"],
            VECTOR["message"],
            VECTOR["signature"],
        )


class TestWellKnown:
    def test_returns_correct_structure(self):
        keys = [{"kid": "2026-01", "public_key": "aa" * 32}]
        result = well_known_response(keys)
        assert result["version"] == "1.0"
        assert len(result["keys"]) == 1
        assert result["keys"][0]["kid"] == "2026-01"
        assert result["keys"][0]["algorithm"] == "ed25519"
        assert result["keys"][0]["public_key"] == "aa" * 32

    def test_handles_multiple_keys(self):
        keys = [
            {"kid": "2026-01", "public_key": "aa" * 32},
            {"kid": "2026-02", "public_key": "bb" * 32},
        ]
        result = well_known_response(keys)
        assert len(result["keys"]) == 2

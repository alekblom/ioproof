"""
IOProof — Ed25519 response signing for AI providers.

Makes IOProof proofs tamper-proof by cryptographically binding
requests to responses with provider signatures.

https://ioproof.com | https://github.com/alekblom/ioproof

Quick start (FastAPI):
    from ioproof.middleware_fastapi import IOProofMiddleware
    app.add_middleware(IOProofMiddleware, private_key="...", key_id="2026-02")

Quick start (Flask):
    from ioproof.middleware_flask import init_app
    init_app(app, private_key="...", key_id="2026-02")

Generate keys:
    ioproof-keygen
"""

__version__ = "0.3.0"
__author__ = "Alexiuz AS"
__url__ = "https://ioproof.com"

from .provider import (
    generate_keypair,
    create_signer,
    sign_with_timestamp,
    verify_signature,
    sha256_hex,
    well_known_response,
)

__all__ = [
    "generate_keypair",
    "create_signer",
    "sign_with_timestamp",
    "verify_signature",
    "sha256_hex",
    "well_known_response",
]

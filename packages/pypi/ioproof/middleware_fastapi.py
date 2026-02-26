"""
IOProof signing middleware for FastAPI / Starlette.

Usage:
    from fastapi import FastAPI
    from ioproof.middleware_fastapi import IOProofMiddleware, well_known_route

    app = FastAPI()
    app.add_middleware(
        IOProofMiddleware,
        private_key="your-hex-key",
        key_id="2026-02",
    )

    @app.get("/.well-known/ioproof.json")
    async def ioproof_keys():
        return well_known_route([{"kid": "2026-02", "public_key": "your-hex-pub"}])
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .provider import create_signer, well_known_response

logger = logging.getLogger("ioproof.provider")


class IOProofMiddleware(BaseHTTPMiddleware):
    """Signs every response with Ed25519. Never crashes the API on errors."""

    def __init__(self, app, private_key, key_id):
        super().__init__(app)
        self.sign = create_signer(private_key, key_id)

    async def dispatch(self, request: Request, call_next):
        # Capture request body
        request_body = await request.body()

        # Call the actual endpoint
        response = await call_next(request)

        # Read the response body (can only iterate once)
        body_chunks = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            body_chunks.append(chunk)
        response_body = b"".join(body_chunks)

        # Sign
        try:
            result = self.sign(request_body, response_body)
            headers = dict(response.headers)
            headers["X-IOProof-Sig"] = result["signature"]
            headers["X-IOProof-Sig-Ts"] = result["timestamp"]
            headers["X-IOProof-Key-Id"] = result["key_id"]
        except Exception as e:
            logger.warning("IOProof signing error: %s", e)
            headers = dict(response.headers)

        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )


def well_known_route(keys):
    """
    Returns the .well-known/ioproof.json response dict.
    Use as a FastAPI route handler return value.

    Example:
        @app.get("/.well-known/ioproof.json")
        async def keys():
            return well_known_route([{"kid": "2026-02", "public_key": "abcd..."}])
    """
    return well_known_response(keys)

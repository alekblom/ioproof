"""
IOProof signing middleware for Flask.

Usage:
    from flask import Flask
    from ioproof.middleware_flask import init_app, well_known_blueprint

    app = Flask(__name__)
    init_app(app, private_key="your-hex-key", key_id="2026-02")
    app.register_blueprint(
        well_known_blueprint([{"kid": "2026-02", "public_key": "your-hex-pub"}])
    )
"""

import logging

from flask import Blueprint, jsonify, request

from .provider import create_signer, well_known_response

logger = logging.getLogger("ioproof.provider")


def init_app(app, private_key, key_id):
    """
    Register IOProof Ed25519 signing on a Flask app.
    Signs every response. Never crashes the API on errors.
    """
    sign = create_signer(private_key, key_id)

    @app.after_request
    def ioproof_sign_response(response):
        try:
            request_body = request.get_data()
            response_body = response.get_data()
            result = sign(request_body, response_body)
            response.headers["X-IOProof-Sig"] = result["signature"]
            response.headers["X-IOProof-Sig-Ts"] = result["timestamp"]
            response.headers["X-IOProof-Key-Id"] = result["key_id"]
        except Exception as e:
            logger.warning("IOProof signing error: %s", e)
        return response

    return app


def well_known_blueprint(keys):
    """
    Returns a Flask Blueprint that serves /.well-known/ioproof.json.

    Usage:
        app.register_blueprint(
            well_known_blueprint([{"kid": "2026-02", "public_key": "abcd..."}])
        )
    """
    bp = Blueprint("ioproof_well_known", __name__)
    body = well_known_response(keys)

    @bp.route("/.well-known/ioproof.json")
    def serve_well_known():
        resp = jsonify(body)
        resp.headers["Cache-Control"] = "public, max-age=3600"
        return resp

    return bp

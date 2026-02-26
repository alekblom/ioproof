"""
IOProof key generation CLI.

Usage:
    python -m ioproof.keygen
    # or via entry point:
    ioproof-keygen
"""

from .provider import generate_keypair


def main():
    kp = generate_keypair()
    print()
    print("IOProof Ed25519 Keypair Generated")
    print("=" * 40)
    print()
    print("Add these to your .env file:")
    print()
    print(f"IOPROOF_PRIVATE_KEY={kp['private_key']}")
    print(f"IOPROOF_PUBLIC_KEY={kp['public_key']}")
    print(f"IOPROOF_KEY_ID={kp['key_id']}")
    print()


if __name__ == "__main__":
    main()

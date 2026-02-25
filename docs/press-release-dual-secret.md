# IOProof Introduces Dual-Secret Verification: Both Parties in an AI Interaction Can Now Prove What Happened

**Skien, Norway — February 22, 2026** — IOProof, an open-source cryptographic attestation service for AI interactions, today announced dual-secret verification — a feature that gives both parties in an AI-powered interaction independent, tamper-evident proof of what was sent and received.

The feature addresses a growing concern as AI systems handle increasingly consequential tasks: when an AI gives medical guidance, financial advice, or generates legal content — who can prove what was actually said?

## The Problem

Today's AI services operate as black boxes. If a chatbot gives incorrect financial advice, neither the user nor the service can cryptographically prove what happened. Disputes become he-said-she-said. Compliance teams have no verifiable audit trail. Regulators have no standard of proof.

## How It Works

IOProof sits as a proxy between any AI service and its API provider (OpenAI, Anthropic, xAI, Google Gemini, or any HTTP API). For every interaction, IOProof:

1. SHA-256 hashes the exact request and response bytes
2. Generates **two independent secrets** — one for the service operator, one for the end-user
3. Blinds the proof and queues it for Merkle batching
4. Commits the Merkle root to the Solana blockchain in a single transaction

Either party can independently verify the proof at any time. No trust required between them. The full request and response payloads are stored server-side and accessible only with a valid secret.

"The original version gave one secret to the API caller. That meant the end-user had to trust the service to share it," said Alek Blom, founder of Alexiuz AS. "Now both parties get their own secret by default. In a dispute, both can independently prove exactly what the AI was asked and what it responded — backed by an on-chain commitment."

## Who It's For

- **AI service builders** — add verifiable trust to your product with one API change. Give users proof that your AI said what it said.
- **End-users** — receive a verification link for every AI interaction. Keep it. If something goes wrong, you have cryptographic evidence.
- **Compliance teams** — tamper-evident audit trails for every AI interaction, with Solana on-chain proof and full payload retrieval.

## Early Access Available Now

IOProof is accepting early testers today ahead of its public launch on **March 1, 2026**. The free tier includes 100 proofs per month with full dashboard access.

- **Hosted**: Register at [ioproof.com/register](https://ioproof.com/register) — no credit card required
- **Self-hosted**: Clone from [github.com/alekblom/ioproof](https://github.com/alekblom/ioproof) — MIT licensed, unlimited proofs

IOProof supports OpenAI, Anthropic, xAI, and Google Gemini out of the box, with any HTTP API configurable in minutes.

## Technical Details

- **Privacy**: Zero-knowledge blinded commitments — no interaction data appears on-chain
- **Efficiency**: Merkle batching — one Solana transaction proves thousands of interactions
- **Open source**: MIT license, self-hostable with your own Solana keys
- **Packages**: Available on [npm](https://www.npmjs.com/package/ioproof) (v0.2.0) and [PyPI](https://pypi.org/project/ioproof/) (v0.2.0)
- **Independent verification**: Standalone browser-based verifier requires zero trust in IOProof

## About Alexiuz AS

Alexiuz AS is a Norwegian software company building AI-powered services including Botlor (AI butler), Generor (content generation), Darobodo (AI life coaching), Naited (smart notes), and Statility (financial analytics). IOProof provides the cryptographic trust layer across all Alexiuz services and is available to any third-party developer.

**Contact**: hello@alexiuz.com
**Website**: [ioproof.com](https://ioproof.com)
**GitHub**: [github.com/alekblom/ioproof](https://github.com/alekblom/ioproof)

---

*IOProof is open source (MIT). Solana is used for on-chain commitments. IOProof is not affiliated with the Solana Foundation.*

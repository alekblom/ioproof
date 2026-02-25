# IOProof Launch Content — Social Posts

## 1. Show HN

### Title

```
Show HN: IOProof – Cryptographic attestation proxy for AI API calls (Solana + Merkle)
```

### Top-Level Comment

Hi HN. I built IOProof because I kept running into the same problem: when a service makes an AI call on behalf of a user, neither party can prove what was actually sent or received. The user has to trust the service. The service has to trust its own logs. In a dispute, it's just "he said, she said."

IOProof is a proxy that sits between your service and any AI API (OpenAI, Anthropic, xAI, Gemini). For every call, it SHA-256 hashes the exact request and response bytes, then generates two independent 256-bit secrets — one for the service operator, one for the end-user. The proof is blinded (SHA-256 of the combined hash + secret), so the Merkle leaf reveals nothing about the interaction. Proofs are batched into a Merkle tree hourly, and the root is committed to Solana via a memo transaction. One Solana tx covers the whole batch — about $0.001/hour regardless of volume.

The interesting part is the dual-secret model. Either party can independently verify the full interaction against the on-chain root, without needing the other's cooperation. There's also a standalone browser verifier that re-derives everything client-side and checks the Solana RPC directly — zero trust in IOProof required.

It's open source (MIT), self-hostable, or hosted at ioproof.com (100 free proofs/month). npm and PyPI packages available. Currently on devnet, moving to mainnet for launch March 1. Happy to take early testers.

Would love feedback on the cryptographic approach and any edge cases I'm missing.

GitHub: https://github.com/alekblom/ioproof

---

## 2. Reddit — r/artificial

### Title

```
I built a cryptographic proof layer for AI API calls — so both the service AND the user can independently verify what the AI actually said
```

### Body

I've been building AI-powered services and kept hitting the same trust problem: when your app calls an AI on behalf of a user, how does the user know you're showing them the real response? And how do you prove you sent the right prompt if something goes wrong?

IOProof is an open-source proxy that sits between your service and any AI API (OpenAI, Anthropic, xAI, Gemini). It hashes the exact request and response, generates two cryptographic secrets — one for you, one for your user — and batches everything into a Merkle tree committed to Solana.

The key idea: both parties get independent proof. Your user doesn't need to trust you. You don't need to trust your logs. Either secret unlocks the full audit trail against on-chain data. Without a secret, nobody can see anything.

Use cases I'm thinking about: AI agent accountability, compliance documentation, dispute resolution, content attribution.

It's MIT licensed, self-hostable, or hosted at ioproof.com with 100 free proofs/month. Early access is open — launching March 1.

Curious what this community thinks. Is the trust gap between services and users something you've run into? What use cases am I not seeing?

https://github.com/alekblom/ioproof

---

## 3. Reddit — r/solana

### Title

```
Using Solana memo transactions as a cheap commitment layer for cryptographic AI attestations
```

### Body

I built an open-source proxy called IOProof that creates tamper-proof records of AI API interactions (OpenAI, Anthropic, etc.) and anchors them to Solana.

The Solana part is elegant in its simplicity: IOProof collects SHA-256 proofs throughout the hour, builds a Merkle tree from blinded hashes, and commits the single root as a memo transaction. One tx per hour, ~$0.024/day, covering unlimited proofs. Previous version did one tx per proof — Merkle batching was a massive cost reduction while keeping the same verification guarantees.

Each proof generates dual 256-bit secrets. The blinded hash (SHA-256 of combined hash + secret) is the Merkle leaf — nothing on-chain reveals any interaction data. Either secret holder can independently walk the Merkle path back to the on-chain root to verify. There's a standalone browser verifier that hits Solana RPC directly.

Right now it's on devnet, moving to mainnet-beta for the March 1 launch. The memo format is: `ioproof|batch|{batchId}|{merkleRoot}|{proofCount}|{timestamp}`

Has anyone here used memo transactions as a commitment layer like this? Interested in feedback on the approach. Also curious about alternatives to memo — would a custom program make sense at scale, or is memo sufficient?

Early access open at ioproof.com. MIT licensed.

https://github.com/alekblom/ioproof

---

## 4. LinkedIn

I've spent the last few months building something I think matters.

When a service uses AI on behalf of its users, there's a trust gap. The user sees an AI response but can't prove what was actually sent or received. The service has logs, but logs can be edited. In a dispute, it's one party's word against the other.

Today I'm opening early access to IOProof — a cryptographic attestation proxy for AI interactions. It sits between your service and any AI API, hashes every request and response, and generates two independent secrets: one for the service operator, one for the end-user. Proofs are blinded, Merkle-batched, and committed to Solana. Either party can verify the full interaction independently. No trust required between them.

This started as a simple hash-per-call approach, but the cost didn't scale. Merkle batching brought it down to one Solana transaction per hour, covering any volume, at roughly $0.02/day.

IOProof is open source under MIT, self-hostable, or hosted at ioproof.com. It works with OpenAI, Anthropic, xAI, and Gemini today, and you can add any HTTP API.

We're launching March 1 with a free tier (100 proofs/month). Early testers are welcome now.

If you're building AI-powered products and care about accountability, I'd love to hear from you.

ioproof.com | github.com/alekblom/ioproof

---

## Distribution Schedule

### Now (Early Access Phase)
- [ ] LinkedIn post (personal account)
- [x] r/solana post
- [ ] r/artificial post
- [ ] r/SideProject post
- [ ] Submit to Solana ecosystem listing (GitHub PR)
- [x] Dev.to article (technical)

### March 1 (Launch Day)
- [ ] Show HN (Tuesday morning ~8-10 AM US Eastern)
- [ ] Product Hunt launch
- [ ] BlockchainWire PR submission (free tier)
- [ ] Pitch to Ben's Bites newsletter
- [ ] Pitch to TLDR AI newsletter
- [ ] Twitter/X launch thread
- [ ] r/CryptoCurrency post
- [ ] Submit to BetaList, There's An AI For That, AlternativeTo

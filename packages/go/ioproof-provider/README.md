# IOProof Go Provider SDK

Ed25519 response signing middleware for AI providers. Makes IOProof proofs tamper-proof.

**Zero external dependencies** — uses only Go standard library (`crypto/ed25519`, `crypto/sha256`).

## Install

```bash
go get github.com/ioproof/go-provider
```

## Quick Start

```go
package main

import (
    "net/http"
    "os"

    ioproof "github.com/ioproof/go-provider"
)

func main() {
    mux := http.NewServeMux()

    // Your API endpoints
    mux.HandleFunc("/v1/chat/completions", handleChat)

    // Public key endpoint
    wellKnown, _ := ioproof.WellKnownJSON([]ioproof.KeyEntry{
        {KID: os.Getenv("IOPROOF_KEY_ID"), PublicKey: os.Getenv("IOPROOF_PUBLIC_KEY")},
    })
    mux.HandleFunc("/.well-known/ioproof.json", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Cache-Control", "public, max-age=3600")
        w.Write(wellKnown)
    })

    // Wrap with IOProof signing middleware
    handler := ioproof.Middleware(
        os.Getenv("IOPROOF_PRIVATE_KEY"),
        os.Getenv("IOPROOF_KEY_ID"),
    )(mux)

    http.ListenAndServe(":8080", handler)
}
```

## Generate Keys

```bash
npx @ioproof/provider keygen
```

Or in Go:

```go
kp, _ := ioproof.GenerateKeyPair()
fmt.Println("IOPROOF_PRIVATE_KEY=" + kp.PrivateKey)
fmt.Println("IOPROOF_PUBLIC_KEY=" + kp.PublicKey)
fmt.Println("IOPROOF_KEY_ID=" + kp.KeyID)
```

## API

- `GenerateKeyPair()` — Create Ed25519 keypair
- `NewSigner(privateKeyHex, keyID)` — Create signing function
- `Middleware(privateKeyHex, keyID)` — net/http middleware (works with chi, gorilla, stdlib)
- `WellKnownJSON(keys)` — Build `.well-known/ioproof.json` response
- `VerifySignature(publicKeyHex, message, signatureB64)` — Verify a signature

## Cross-Language Compatible

Produces byte-identical signatures with the Node.js (`@ioproof/provider`) and Python (`ioproof`) SDKs. All three use the same Ed25519 signing format:

```
ioproof:v1:{SHA256(request)}|{SHA256(response)}|{timestamp}
```

## License

MIT

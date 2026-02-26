// Example: AI provider API server with IOProof response signing.
//
// Run:
//
//	go run main.go
//
// Test:
//
//	curl -X POST http://localhost:8080/v1/chat/completions \
//	  -H "Content-Type: application/json" \
//	  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}' -v
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	ioproof "github.com/ioproof/go-provider"
)

func main() {
	privateKey := os.Getenv("IOPROOF_PRIVATE_KEY")
	publicKey := os.Getenv("IOPROOF_PUBLIC_KEY")
	keyID := os.Getenv("IOPROOF_KEY_ID")

	if privateKey == "" {
		// Generate a keypair for demo purposes
		kp, _ := ioproof.GenerateKeyPair()
		privateKey = kp.PrivateKey
		publicKey = kp.PublicKey
		keyID = kp.KeyID
		fmt.Printf("Generated demo keypair:\n  IOPROOF_PRIVATE_KEY=%s\n  IOPROOF_PUBLIC_KEY=%s\n  IOPROOF_KEY_ID=%s\n\n", privateKey, publicKey, keyID)
	}

	mux := http.NewServeMux()

	// Serve public key for verification
	wellKnown, _ := ioproof.WellKnownJSON([]ioproof.KeyEntry{
		{KID: keyID, PublicKey: publicKey},
	})
	mux.HandleFunc("/.well-known/ioproof.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(wellKnown)
	})

	// Example API endpoint
	mux.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"choices": []map[string]interface{}{
				{"message": map[string]string{"content": "Hello from the signed API!"}},
			},
		})
	})

	// Wrap with IOProof signing middleware
	handler := ioproof.Middleware(privateKey, keyID)(mux)

	log.Println("Listening on :8080 with IOProof signing enabled")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

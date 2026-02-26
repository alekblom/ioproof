// Package ioproof provides Ed25519 response signing for AI providers.
//
// Install this middleware on your API server to cryptographically sign every
// response. IOProof captures the signature, making proofs tamper-proof.
//
// Zero external dependencies — uses only Go standard library.
package ioproof

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// KeyPair holds an Ed25519 keypair with hex-encoded raw keys.
type KeyPair struct {
	PublicKey  string // 32-byte hex-encoded public key
	PrivateKey string // 32-byte hex-encoded seed
	KeyID      string // Suggested identifier (YYYY-MM)
}

// SignResult holds the output of a signing operation.
type SignResult struct {
	Signature    string // Base64-encoded Ed25519 signature
	Timestamp    string // ISO 8601 timestamp used in signing
	KeyID        string // Key identifier
	RequestHash  string // SHA-256 hex of request body
	ResponseHash string // SHA-256 hex of response body
	Message      string // The signed message string
}

// KeyEntry is used for the .well-known/ioproof.json response.
type KeyEntry struct {
	KID       string `json:"kid"`
	PublicKey string `json:"public_key"`
}

type wellKnownKey struct {
	KID       string `json:"kid"`
	Algorithm string `json:"algorithm"`
	PublicKey string `json:"public_key"`
}

type wellKnownResponse struct {
	Version string         `json:"version"`
	Keys    []wellKnownKey `json:"keys"`
}

// GenerateKeyPair creates a new Ed25519 keypair.
func GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("ioproof: generate key: %w", err)
	}

	now := time.Now().UTC()
	return &KeyPair{
		PublicKey:  hex.EncodeToString(pub),
		PrivateKey: hex.EncodeToString(priv.Seed()),
		KeyID:      fmt.Sprintf("%d-%02d", now.Year(), now.Month()),
	}, nil
}

// SignFunc signs a request/response pair and returns the result.
type SignFunc func(requestBody, responseBody []byte) (*SignResult, error)

// NewSigner creates a signing function from a hex-encoded Ed25519 seed.
func NewSigner(privateKeyHex, keyID string) (SignFunc, error) {
	seed, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("ioproof: invalid private key hex: %w", err)
	}
	if len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("ioproof: private key must be %d bytes, got %d", ed25519.SeedSize, len(seed))
	}

	privKey := ed25519.NewKeyFromSeed(seed)

	return func(requestBody, responseBody []byte) (*SignResult, error) {
		reqHash := sha256Hex(requestBody)
		resHash := sha256Hex(responseBody)
		timestamp := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")

		message := fmt.Sprintf("ioproof:v1:%s|%s|%s", reqHash, resHash, timestamp)
		sig := ed25519.Sign(privKey, []byte(message))

		return &SignResult{
			Signature:    base64.StdEncoding.EncodeToString(sig),
			Timestamp:    timestamp,
			KeyID:        keyID,
			RequestHash:  reqHash,
			ResponseHash: resHash,
			Message:      message,
		}, nil
	}, nil
}

// SignWithTimestamp signs with an explicit timestamp (for testing / cross-language verification).
func SignWithTimestamp(privateKeyHex, keyID string, requestBody, responseBody []byte, timestamp string) (*SignResult, error) {
	seed, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("ioproof: invalid private key hex: %w", err)
	}

	privKey := ed25519.NewKeyFromSeed(seed)
	reqHash := sha256Hex(requestBody)
	resHash := sha256Hex(responseBody)

	message := fmt.Sprintf("ioproof:v1:%s|%s|%s", reqHash, resHash, timestamp)
	sig := ed25519.Sign(privKey, []byte(message))

	return &SignResult{
		Signature:    base64.StdEncoding.EncodeToString(sig),
		Timestamp:    timestamp,
		KeyID:        keyID,
		RequestHash:  reqHash,
		ResponseHash: resHash,
		Message:      message,
	}, nil
}

// VerifySignature verifies an Ed25519 signature against a public key.
func VerifySignature(publicKeyHex, message, signatureB64 string) bool {
	pubBytes, err := hex.DecodeString(publicKeyHex)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return false
	}

	sig, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubBytes), []byte(message), sig)
}

// WellKnownJSON returns the JSON bytes for a .well-known/ioproof.json response.
func WellKnownJSON(keys []KeyEntry) ([]byte, error) {
	wk := wellKnownResponse{
		Version: "1.0",
		Keys:    make([]wellKnownKey, len(keys)),
	}
	for i, k := range keys {
		wk.Keys[i] = wellKnownKey{
			KID:       k.KID,
			Algorithm: "ed25519",
			PublicKey: k.PublicKey,
		}
	}
	return json.Marshal(wk)
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

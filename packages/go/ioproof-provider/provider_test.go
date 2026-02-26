package ioproof

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Cross-language test vector — identical to Node.js and Python test suites.
// Ed25519 is deterministic: same key + message = same signature.
var vector = struct {
	PrivateKey   string
	PublicKey    string
	KeyID        string
	RequestBody  string
	ResponseBody string
	Timestamp    string
	RequestHash  string
	ResponseHash string
	Message      string
	Signature    string
}{
	PrivateKey:   "4c830864429505b175ea2fd113367a2b0671a24bd78a827fa24377c66d66b64f",
	PublicKey:    "24ab368303288a10e15205fa54f15d0761b7cd3363bb017a2d4afaec1db14703",
	KeyID:        "test-2026",
	RequestBody:  `{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}`,
	ResponseBody: `{"choices":[{"message":{"content":"Hi there!"}}]}`,
	Timestamp:    "2026-01-15T12:00:00.000Z",
	RequestHash:  "32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02",
	ResponseHash: "018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf",
	Message:      "ioproof:v1:32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02|018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf|2026-01-15T12:00:00.000Z",
	Signature:    "kz5LDmarkNtpwNa4up0Yvb+1+r/C7QIKr7R3WPvDEtdl5TQQp9bj7bG4LvcLRi+Lan1jEv0KugLC6q3ZVbnXCg==",
}

func TestGenerateKeyPair(t *testing.T) {
	kp, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	if len(kp.PublicKey) != 64 {
		t.Errorf("PublicKey length = %d, want 64", len(kp.PublicKey))
	}
	if len(kp.PrivateKey) != 64 {
		t.Errorf("PrivateKey length = %d, want 64", len(kp.PrivateKey))
	}

	// Must be valid hex
	if _, err := hex.DecodeString(kp.PublicKey); err != nil {
		t.Errorf("PublicKey not valid hex: %v", err)
	}
	if _, err := hex.DecodeString(kp.PrivateKey); err != nil {
		t.Errorf("PrivateKey not valid hex: %v", err)
	}

	// Unique each call
	kp2, _ := GenerateKeyPair()
	if kp.PublicKey == kp2.PublicKey {
		t.Error("Two keypairs should not have identical public keys")
	}
}

func TestNewSigner(t *testing.T) {
	sign, err := NewSigner(vector.PrivateKey, vector.KeyID)
	if err != nil {
		t.Fatalf("NewSigner failed: %v", err)
	}

	result, err := sign([]byte("test request"), []byte("test response"))
	if err != nil {
		t.Fatalf("Sign failed: %v", err)
	}

	if result.KeyID != vector.KeyID {
		t.Errorf("KeyID = %q, want %q", result.KeyID, vector.KeyID)
	}

	// Verify the signature
	pubBytes, _ := hex.DecodeString(vector.PublicKey)
	sigBytes, _ := base64.StdEncoding.DecodeString(result.Signature)
	if !ed25519.Verify(pubBytes, []byte(result.Message), sigBytes) {
		t.Error("Signature verification failed")
	}
}

func TestCrossLanguageVector_Hashes(t *testing.T) {
	reqHash := sha256Hex([]byte(vector.RequestBody))
	resHash := sha256Hex([]byte(vector.ResponseBody))

	if reqHash != vector.RequestHash {
		t.Errorf("Request hash = %s, want %s", reqHash, vector.RequestHash)
	}
	if resHash != vector.ResponseHash {
		t.Errorf("Response hash = %s, want %s", resHash, vector.ResponseHash)
	}
}

func TestCrossLanguageVector_Message(t *testing.T) {
	msg := "ioproof:v1:" + vector.RequestHash + "|" + vector.ResponseHash + "|" + vector.Timestamp
	if msg != vector.Message {
		t.Errorf("Message = %s, want %s", msg, vector.Message)
	}
}

func TestCrossLanguageVector_Signature(t *testing.T) {
	result, err := SignWithTimestamp(
		vector.PrivateKey,
		vector.KeyID,
		[]byte(vector.RequestBody),
		[]byte(vector.ResponseBody),
		vector.Timestamp,
	)
	if err != nil {
		t.Fatalf("SignWithTimestamp failed: %v", err)
	}

	if result.Signature != vector.Signature {
		t.Errorf("Signature mismatch!\n  Expected: %s\n  Got:      %s", vector.Signature, result.Signature)
	}
}

func TestCrossLanguageVector_Verify(t *testing.T) {
	if !VerifySignature(vector.PublicKey, vector.Message, vector.Signature) {
		t.Error("Cross-language vector signature verification failed")
	}
}

func TestVerifySignature_Invalid(t *testing.T) {
	if VerifySignature(vector.PublicKey, "wrong message", vector.Signature) {
		t.Error("Should not verify with wrong message")
	}
	if VerifySignature("bad hex", vector.Message, vector.Signature) {
		t.Error("Should not verify with bad public key")
	}
}

func TestMiddleware_AddsHeaders(t *testing.T) {
	kp, _ := GenerateKeyPair()
	mw := Middleware(kp.PrivateKey, kp.KeyID)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"ok":true}`))
	}))

	req := httptest.NewRequest("POST", "/test", strings.NewReader(`{"test":true}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	resp := rec.Result()
	if resp.Header.Get("X-IOProof-Sig") == "" {
		t.Error("Missing X-IOProof-Sig header")
	}
	if resp.Header.Get("X-IOProof-Sig-Ts") == "" {
		t.Error("Missing X-IOProof-Sig-Ts header")
	}
	if resp.Header.Get("X-IOProof-Key-Id") != kp.KeyID {
		t.Errorf("X-IOProof-Key-Id = %q, want %q", resp.Header.Get("X-IOProof-Key-Id"), kp.KeyID)
	}

	// Verify the signature
	body, _ := io.ReadAll(resp.Body)
	_ = sha256.Sum256([]byte(`{"test":true}`))
	_ = sha256.Sum256(body)

	pubBytes, _ := hex.DecodeString(kp.PublicKey)
	sigBytes, _ := base64.StdEncoding.DecodeString(resp.Header.Get("X-IOProof-Sig"))
	reqHash := sha256Hex([]byte(`{"test":true}`))
	resHash := sha256Hex(body)
	msg := "ioproof:v1:" + reqHash + "|" + resHash + "|" + resp.Header.Get("X-IOProof-Sig-Ts")

	if !ed25519.Verify(pubBytes, []byte(msg), sigBytes) {
		t.Error("Middleware signature verification failed")
	}
}

func TestWellKnownJSON(t *testing.T) {
	keys := []KeyEntry{
		{KID: "2026-01", PublicKey: strings.Repeat("aa", 32)},
		{KID: "2026-02", PublicKey: strings.Repeat("bb", 32)},
	}

	data, err := WellKnownJSON(keys)
	if err != nil {
		t.Fatalf("WellKnownJSON failed: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("Invalid JSON: %v", err)
	}

	if result["version"] != "1.0" {
		t.Errorf("version = %v, want 1.0", result["version"])
	}

	keysArr := result["keys"].([]interface{})
	if len(keysArr) != 2 {
		t.Errorf("keys length = %d, want 2", len(keysArr))
	}

	first := keysArr[0].(map[string]interface{})
	if first["kid"] != "2026-01" {
		t.Errorf("first key kid = %v, want 2026-01", first["kid"])
	}
	if first["algorithm"] != "ed25519" {
		t.Errorf("first key algorithm = %v, want ed25519", first["algorithm"])
	}
}

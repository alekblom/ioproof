package ioproof

import (
	"bytes"
	"io"
	"log"
	"net/http"
)

// Middleware returns an http.Handler middleware that signs every response
// with Ed25519. Compatible with stdlib, chi, gorilla/mux, and any
// router that uses the standard middleware pattern.
//
// Never crashes the API — signing errors are logged and the response
// is sent without signature headers.
func Middleware(privateKeyHex, keyID string) func(http.Handler) http.Handler {
	sign, err := NewSigner(privateKeyHex, keyID)
	if err != nil {
		panic("ioproof: invalid private key: " + err.Error())
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Read and buffer request body, then restore it
			var reqBody []byte
			if r.Body != nil {
				reqBody, _ = io.ReadAll(r.Body)
				r.Body.Close()
				r.Body = io.NopCloser(bytes.NewReader(reqBody))
			}

			// Wrap ResponseWriter to capture response body
			rec := &responseRecorder{
				ResponseWriter: w,
				body:           &bytes.Buffer{},
				statusCode:     http.StatusOK,
			}

			// Call the next handler
			next.ServeHTTP(rec, r)

			// Sign the request/response pair
			resBody := rec.body.Bytes()
			result, signErr := sign(reqBody, resBody)
			if signErr != nil {
				log.Printf("[ioproof/provider] Signing error: %v", signErr)
			} else {
				w.Header().Set("X-IOProof-Sig", result.Signature)
				w.Header().Set("X-IOProof-Sig-Ts", result.Timestamp)
				w.Header().Set("X-IOProof-Key-Id", result.KeyID)
			}

			// Write the actual response
			w.WriteHeader(rec.statusCode)
			w.Write(resBody)
		})
	}
}

// responseRecorder captures the response body and status code
// without writing to the underlying ResponseWriter.
type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
	wroteHead  bool
}

func (r *responseRecorder) WriteHeader(code int) {
	if !r.wroteHead {
		r.statusCode = code
		r.wroteHead = true
	}
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	return r.body.Write(b)
}

// @ioproof/client — HTTP client for the IOProof API
// https://ioproof.com | https://github.com/alekblom/ioproof
//
// Full SDK coming soon. Will include:
//   - IOProofClient class with proxy(), verify(), export() methods
//   - Automatic API key handling
//   - TypeScript types for all responses
//   - Support for all providers (OpenAI, Anthropic, xAI, Gemini, custom)
//
// For now, use the REST API directly:
//   POST https://ioproof.com/v1/proxy/:provider/*
//   GET  https://ioproof.com/api/verify/:hash?secret=...

module.exports = {
  version: '0.1.0',
  docs: 'https://ioproof.com',
  github: 'https://github.com/alekblom/ioproof',
};

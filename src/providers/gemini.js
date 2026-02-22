module.exports = {
  name: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com',

  buildHeaders(apiKey) {
    return {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    };
  },

  buildUrl(path) {
    return `https://generativelanguage.googleapis.com${path}`;
  },
};

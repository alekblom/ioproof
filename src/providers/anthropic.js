module.exports = {
  name: 'anthropic',
  baseUrl: 'https://api.anthropic.com',

  buildHeaders(apiKey) {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
  },

  buildUrl(path) {
    return `https://api.anthropic.com${path}`;
  },
};

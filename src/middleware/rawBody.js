function rawBodyMiddleware(req, res, next) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    try {
      req.body = JSON.parse(req.rawBody.toString('utf-8'));
    } catch {
      req.body = null;
    }
    next();
  });
}

module.exports = { rawBodyMiddleware };

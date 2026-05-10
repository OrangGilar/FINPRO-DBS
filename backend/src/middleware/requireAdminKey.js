function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'ADMIN_KEY is not configured' });
    }
    // Dev mode only — no key configured, skip auth
    return next();
  }

  const provided = req.header('X-Admin-Key');
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing X-Admin-Key' });
  }
  next();
}
 
module.exports = requireAdminKey;
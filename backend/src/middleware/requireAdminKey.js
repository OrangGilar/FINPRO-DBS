function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_KEY;
 
  // Dev mode — no key configured, skip auth
  if (!expected) return next();
 
  const provided = req.header('X-Admin-Key');
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing X-Admin-Key' });
  }
  next();
}
 
module.exports = requireAdminKey;
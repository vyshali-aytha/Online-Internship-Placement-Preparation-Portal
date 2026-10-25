// TEMPORARY placeholder until Yashas's role-based access middleware (issue #18) is merged.
// Replace this with his middleware, then delete this file.
// For now it blocks everyone unless NODE_ENV is 'test', so the admin list is never public.
module.exports = function adminOnly(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  return res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'Admin access required.' },
  });
};

import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * JWT authentication middleware.
 * Reads Bearer token from Authorization header.
 * Attaches { id, email, plan } to req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autentisering krävs' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email, plan: payload.plan };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token har gått ut', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Ogiltig token' });
  }
}

/**
 * Optional auth – attaches user if token is present but doesn't reject without one.
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email, plan: payload.plan };
  } catch {
    // Ignore invalid tokens
  }
  next();
}

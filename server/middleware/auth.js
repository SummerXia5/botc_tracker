/**
 * JWT authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded payload to `req.user`.
 *
 * Usage:
 *   import { authenticateJWT } from './middleware/auth.js';
 *   router.post('/protected', authenticateJWT, handler);
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user info so downstream handlers can use it
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

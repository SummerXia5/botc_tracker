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
import db from '../db.js';

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
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

export function requireGroupOwner(req, res, next) {
  const groupId = req.params.group_id || req.body.group_id || req.params.id;
  if (!groupId) return res.status(400).json({ error: 'group_id required' });

  const group = db.prepare('SELECT created_by FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.user.userId) {
    return res.status(403).json({ error: '只有组的创建者才能执行此操作' });
  }
  next();
}

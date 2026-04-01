import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAdmin (req: Request, res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (h === undefined || !h.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret === '') {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }
  try {
    const token = h.slice(7);
    jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

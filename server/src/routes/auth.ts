import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/pool';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const username = (req.body?.username as string | undefined)?.trim();
  const password = req.body?.password as string | undefined;
  const secret = process.env.JWT_SECRET;

  if (username === undefined || password === undefined) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  if (secret === undefined || secret === '') {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  const { rows } = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM admins WHERE username = $1',
    [username]
  );
  const row = rows[0];
  if (row === undefined) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ sub: username, role: 'admin' }, secret, { expiresIn: '7d' });
  res.json({ token, username });
});

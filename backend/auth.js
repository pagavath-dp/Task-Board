import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function verifySocketToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET is not set — using an insecure development fallback.');
}

export const signToken = (user) =>
  jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '1d' });

export const publicUser = (user) => ({
  _id: user._id,
  userId: user._id,
  email: user.email,
  role: user.role,
  orgId: user.orgId || null,
});

/**
 * Verifies the JWT and loads the CURRENT user from the database.
 * Role and orgId always come from the DB, never from the (possibly stale) token —
 * otherwise a user who just created an org still carries role "none" in their token.
 */
export const verifyToken = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      orgId: user.orgId ? user.orgId.toString() : null,
    };
    req.userDoc = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireOrg = (req, res, next) => {
  if (!req.user?.orgId) {
    return res.status(400).json({ message: 'You do not belong to an organization yet.' });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: admins only.' });
  }
  next();
};

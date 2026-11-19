import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { signToken, publicUser } from '../middleware/authMiddleware.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signup = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    res.status(201).json({
      message: 'User created successfully',
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({
      message: 'Login successful',
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Returns the current user (fresh from DB) plus their organization. */
export const me = async (req, res) => {
  try {
    let organization = null;
    if (req.user.orgId) {
      const org = await Organization.findById(req.user.orgId);
      if (org) {
        organization = {
          _id: org._id,
          name: org.name,
          // Only admins get to see the invite code
          inviteCode: req.user.role === 'admin' ? org.inviteCode : undefined,
        };
      }
    }
    res.json({ user: publicUser(req.userDoc), organization });
  } catch (error) {
    console.error('Error in me:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

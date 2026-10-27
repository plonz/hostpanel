const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { config, updateConfig } = require('../config');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username !== config.username) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, config.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Generate JWT (valid for 7 days)
  const token = jwt.sign(
    { username: config.username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      username: config.username,
      role: 'admin',
      rootPath: config.rootPath
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      username: config.username,
      role: 'admin',
      rootPath: config.rootPath
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const isCurrentValid = bcrypt.compareSync(currentPassword, config.passwordHash);
  if (!isCurrentValid) {
    return res.status(400).json({ error: 'Current password does not match.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  updateConfig({ passwordHash: newHash });

  return res.json({ message: 'Password changed successfully.' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;

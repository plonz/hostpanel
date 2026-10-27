const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const domainService = require('../services/domainService');

// GET /api/domains - List all domains
router.get('/', authMiddleware, (req, res) => {
  try {
    const domains = domainService.getDomains();
    res.json(domains);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains - Add a new domain/website
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { domain, type, port, documentRoot, email } = req.body;
    const newDomain = await domainService.addDomain({
      domain,
      type,
      port,
      documentRoot,
      email
    });
    res.status(201).json(newDomain);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/domains/:id/toggle - Toggle enable/disable website
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const updated = await domainService.toggleDomain(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/domains/:id/ssl - Issue Let's Encrypt SSL
router.post('/:id/ssl', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await domainService.issueSsl(req.params.id, email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/domains/:id - Delete website
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleteFiles = req.query.deleteFiles === 'true';
    const result = await domainService.deleteDomain(req.params.id, deleteFiles);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const databaseService = require('../services/databaseService');
const { authMiddleware } = require('../middleware/auth');
const { DATA_DIR } = require('../config');

router.use(authMiddleware);

// Get status
router.get('/status', async (req, res) => {
  try {
    const status = await databaseService.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List databases
router.get('/list', async (req, res) => {
  try {
    const databases = await databaseService.listDatabases();
    res.json(databases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create database
router.post('/create', async (req, res) => {
  try {
    const { name, charset, collation } = req.body;
    const newDb = await databaseService.createDatabase({ name, charset, collation });
    res.status(201).json(newDb);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete database
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await databaseService.deleteDatabase(name);
    res.json({ message: `Database ${name} deleted successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List users
router.get('/users', async (req, res) => {
  try {
    const users = await databaseService.listUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
router.post('/users/create', async (req, res) => {
  try {
    const { username, host, password, database, privileges } = req.body;
    const user = await databaseService.createUser({ username, host, password, database, privileges });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const host = req.query.host || 'localhost';
    await databaseService.deleteUser(username, host);
    res.json({ message: `User '${username}'@'${host}' deleted` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Change user password
router.post('/users/password', async (req, res) => {
  try {
    const { username, host, password } = req.body;
    await databaseService.changeUserPassword(username, host || 'localhost', password);
    res.json({ message: `Password for '${username}' updated successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Execute Query (SQL Console)
router.post('/query', async (req, res) => {
  try {
    const { query, database } = req.body;
    const result = await databaseService.executeQuery(query, database);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Backup Database
router.post('/backup/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const backup = await databaseService.backupDatabase(name);
    res.json(backup);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List Backups
router.get('/backups', (req, res) => {
  try {
    const backups = databaseService.listBackups();
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download Backup file
router.get('/backups/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, 'backups', safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    res.download(filePath, safeName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore Database
router.post('/restore', async (req, res) => {
  try {
    const { database, sqlContent } = req.body;
    const result = await databaseService.restoreDatabase(database, sqlContent);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

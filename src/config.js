const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');

// Initialize default config if not exists
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (err) {
      console.error('Error reading config file, using defaults:', err);
    }
  }

  // Default configuration
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(initialPassword, salt);

  const defaultConfig = {
    username: process.env.INITIAL_ADMIN_USERNAME || 'admin',
    passwordHash: hashedPassword,
    jwtSecret: process.env.JWT_SECRET || 'panel-secret-' + Math.random().toString(36).substring(2) + Date.now().toString(36),
    port: parseInt(process.env.PORT, 10) || 3000,
    rootPath: process.env.ROOT_PATH || (process.platform === 'win32' ? process.cwd() : '/var/www'),
    allowSystemRoot: process.env.ALLOW_SYSTEM_ROOT !== 'false',
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
  return defaultConfig;
}

const config = loadConfig();

function updateConfig(newConfig) {
  const current = loadConfig();
  const updated = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  Object.assign(config, updated);
  return config;
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  CONFIG_FILE,
  APPS_FILE,
  config,
  updateConfig,
};

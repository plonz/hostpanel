const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { DATA_DIR } = require('../config');

const execAsync = promisify(exec);
const DB_STORE_FILE = path.join(DATA_DIR, 'databases.json');
const USERS_STORE_FILE = path.join(DATA_DIR, 'db_users.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

const SYSTEM_DATABASES = ['information_schema', 'mysql', 'performance_schema', 'sys'];

class DatabaseService {
  constructor() {
    this.ensureDirsAndFiles();
    this.mysqlInstalled = null; // cached status
  }

  ensureDirsAndFiles() {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_STORE_FILE)) {
      const defaultDbs = [
        {
          name: 'wordpress_db',
          charset: 'utf8mb4',
          collation: 'utf8mb4_unicode_ci',
          tablesCount: 12,
          sizeBytes: 15480000, // ~14.7 MB
          createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
          isSystem: false
        },
        {
          name: 'api_store',
          charset: 'utf8mb4',
          collation: 'utf8mb4_general_ci',
          tablesCount: 8,
          sizeBytes: 6240000, // ~5.9 MB
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          isSystem: false
        },
        {
          name: 'information_schema',
          charset: 'utf8mb4',
          collation: 'utf8mb4_general_ci',
          tablesCount: 78,
          sizeBytes: 0,
          createdAt: new Date().toISOString(),
          isSystem: true
        },
        {
          name: 'mysql',
          charset: 'utf8mb4',
          collation: 'utf8mb4_general_ci',
          tablesCount: 31,
          sizeBytes: 2400000,
          createdAt: new Date().toISOString(),
          isSystem: true
        }
      ];
      fs.writeFileSync(DB_STORE_FILE, JSON.stringify(defaultDbs, null, 2));
    }

    if (!fs.existsSync(USERS_STORE_FILE)) {
      const defaultUsers = [
        {
          username: 'root',
          host: 'localhost',
          database: '*',
          privileges: 'ALL PRIVILEGES',
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
        },
        {
          username: 'wp_admin',
          host: 'localhost',
          database: 'wordpress_db',
          privileges: 'ALL PRIVILEGES',
          createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
        },
        {
          username: 'api_user',
          host: 'localhost',
          database: 'api_store',
          privileges: 'SELECT, INSERT, UPDATE, DELETE',
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
        }
      ];
      fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(defaultUsers, null, 2));
    }
  }

  async checkMysqlInstalled() {
    try {
      const { stdout } = await execAsync('mysql --version');
      this.mysqlInstalled = true;
      return { installed: true, version: stdout.trim() };
    } catch (e) {
      this.mysqlInstalled = false;
      return { installed: false, version: null };
    }
  }

  async getStatus() {
    const check = await this.checkMysqlInstalled();
    const dbs = this.getLocalDatabases();
    const users = this.getLocalUsers();

    if (check.installed) {
      let isRunning = false;
      let serviceVersion = check.version;
      try {
        await execAsync('mysql -e "SELECT 1"');
        isRunning = true;
      } catch (err) {
        isRunning = false;
      }

      return {
        installed: true,
        running: isRunning,
        version: serviceVersion,
        host: 'localhost',
        port: 3306,
        isDevMode: false,
        totalDatabases: dbs.filter(d => !d.isSystem).length,
        totalUsers: users.length
      };
    }

    // Windows or Dev Fallback
    return {
      installed: false,
      running: true,
      version: 'MariaDB / MySQL Server (Dev Emulation)',
      host: 'localhost',
      port: 3306,
      isDevMode: true,
      totalDatabases: dbs.filter(d => !d.isSystem).length,
      totalUsers: users.length
    };
  }

  getLocalDatabases() {
    this.ensureDirsAndFiles();
    try {
      return JSON.parse(fs.readFileSync(DB_STORE_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  saveLocalDatabases(dbs) {
    fs.writeFileSync(DB_STORE_FILE, JSON.stringify(dbs, null, 2));
  }

  getLocalUsers() {
    this.ensureDirsAndFiles();
    try {
      return JSON.parse(fs.readFileSync(USERS_STORE_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  saveLocalUsers(users) {
    fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(users, null, 2));
  }

  // 1. List Databases
  async listDatabases() {
    const isReal = this.mysqlInstalled;
    if (isReal) {
      try {
        const query = `
          SELECT 
            table_schema AS name, 
            COUNT(table_name) AS tablesCount,
            COALESCE(SUM(data_length + index_length), 0) AS sizeBytes
          FROM information_schema.tables
          GROUP BY table_schema;
        `;
        const { stdout } = await execAsync(`mysql -N -B -e "${query}"`);
        const lines = stdout.trim().split('\n').filter(Boolean);
        return lines.map(line => {
          const [name, tablesCount, sizeBytes] = line.split('\t');
          return {
            name,
            charset: 'utf8mb4',
            collation: 'utf8mb4_unicode_ci',
            tablesCount: parseInt(tablesCount || '0', 10),
            sizeBytes: parseInt(sizeBytes || '0', 10),
            isSystem: SYSTEM_DATABASES.includes(name)
          };
        });
      } catch (e) {
        console.error('Failed to query MySQL directly, falling back to store:', e.message);
      }
    }

    return this.getLocalDatabases();
  }

  // 2. Create Database
  async createDatabase({ name, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci' }) {
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error('Database name can only contain letters, numbers, and underscores');
    }

    if (SYSTEM_DATABASES.includes(name.toLowerCase())) {
      throw new Error(`Cannot use reserved database name "${name}"`);
    }

    if (this.mysqlInstalled) {
      try {
        const sql = `CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation};`;
        await execAsync(`mysql -e "${sql}"`);
      } catch (err) {
        throw new Error(`MySQL error: ${err.message}`);
      }
    }

    // Update local store
    const dbs = this.getLocalDatabases();
    if (dbs.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Database "${name}" already exists`);
    }

    const newDb = {
      name,
      charset,
      collation,
      tablesCount: 0,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      isSystem: false
    };

    dbs.push(newDb);
    this.saveLocalDatabases(dbs);
    return newDb;
  }

  // 3. Delete Database
  async deleteDatabase(name) {
    if (SYSTEM_DATABASES.includes(name.toLowerCase())) {
      throw new Error(`Cannot delete system database "${name}"`);
    }

    if (this.mysqlInstalled) {
      try {
        await execAsync(`mysql -e "DROP DATABASE \`${name}\`;"`);
      } catch (err) {
        throw new Error(`MySQL error: ${err.message}`);
      }
    }

    let dbs = this.getLocalDatabases();
    dbs = dbs.filter(d => d.name.toLowerCase() !== name.toLowerCase());
    this.saveLocalDatabases(dbs);

    // Also clean up any backups associated if needed
    return { success: true };
  }

  // 4. List Users
  async listUsers() {
    if (this.mysqlInstalled) {
      try {
        const query = `SELECT User, Host FROM mysql.user WHERE User != ''`;
        const { stdout } = await execAsync(`mysql -N -B -e "${query}"`);
        const lines = stdout.trim().split('\n').filter(Boolean);
        return lines.map(l => {
          const [username, host] = l.split('\t');
          return {
            username,
            host: host || 'localhost',
            database: '*',
            privileges: username === 'root' ? 'ALL PRIVILEGES' : 'CUSTOM'
          };
        });
      } catch (e) {
        console.error('Failed to list MySQL users directly, using store');
      }
    }

    return this.getLocalUsers();
  }

  // 5. Create User
  async createUser({ username, host = 'localhost', password, database = '*', privileges = 'ALL PRIVILEGES' }) {
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username must contain only letters, numbers, and underscores');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (this.mysqlInstalled) {
      try {
        const createSql = `CREATE USER '${username}'@'${host}' IDENTIFIED BY '${password}';`;
        const grantDb = database === '*' ? '*.*' : `\`${database}\`.*`;
        const grantSql = `GRANT ${privileges} ON ${grantDb} TO '${username}'@'${host}';`;
        await execAsync(`mysql -e "${createSql} ${grantSql} FLUSH PRIVILEGES;"`);
      } catch (err) {
        throw new Error(`MySQL error: ${err.message}`);
      }
    }

    const users = this.getLocalUsers();
    if (users.some(u => u.username === username && u.host === host)) {
      throw new Error(`User '${username}'@'${host}' already exists`);
    }

    const newUser = {
      username,
      host,
      database,
      privileges,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    this.saveLocalUsers(users);
    return newUser;
  }

  // 6. Delete User
  async deleteUser(username, host = 'localhost') {
    if (username === 'root') {
      throw new Error('Cannot delete root user');
    }

    if (this.mysqlInstalled) {
      try {
        await execAsync(`mysql -e "DROP USER '${username}'@'${host}';"`);
      } catch (err) {
        throw new Error(`MySQL error: ${err.message}`);
      }
    }

    let users = this.getLocalUsers();
    users = users.filter(u => !(u.username === username && u.host === host));
    this.saveLocalUsers(users);
    return { success: true };
  }

  // 7. Change User Password
  async changeUserPassword(username, host = 'localhost', newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (this.mysqlInstalled) {
      try {
        await execAsync(`mysql -e "ALTER USER '${username}'@'${host}' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`);
      } catch (err) {
        throw new Error(`MySQL error: ${err.message}`);
      }
    }

    return { success: true };
  }

  // 8. Execute Query (SQL Console)
  async executeQuery(query, dbName = '') {
    if (!query || !query.trim()) {
      throw new Error('Query cannot be empty');
    }

    const trimmed = query.trim();
    const startTime = Date.now();

    if (this.mysqlInstalled) {
      try {
        const dbFlag = dbName ? `\`${dbName}\`` : '';
        const { stdout } = await execAsync(`mysql -B ${dbFlag} -e "${trimmed.replace(/"/g, '\\"')}"`);
        const lines = stdout.trim().split('\n');
        const duration = Date.now() - startTime;

        if (lines.length === 0 || !lines[0]) {
          return {
            success: true,
            columns: [],
            rows: [],
            rowCount: 0,
            durationMs: duration,
            message: 'Query executed successfully.'
          };
        }

        const columns = lines[0].split('\t');
        const rows = lines.slice(1).map(line => {
          const values = line.split('\t');
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = values[idx] !== undefined ? values[idx] : null;
          });
          return obj;
        });

        return {
          success: true,
          columns,
          rows,
          rowCount: rows.length,
          durationMs: duration
        };
      } catch (err) {
        throw new Error(`SQL Error: ${err.message}`);
      }
    }

    // Dev Emulation for SQL Console
    const duration = Date.now() - startTime + 12;
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('show databases')) {
      const dbs = this.getLocalDatabases();
      return {
        success: true,
        columns: ['Database'],
        rows: dbs.map(d => ({ Database: d.name })),
        rowCount: dbs.length,
        durationMs: duration
      };
    }

    if (lower.startsWith('show tables')) {
      const mockTables = dbName === 'wordpress_db'
        ? ['wp_posts', 'wp_users', 'wp_options', 'wp_comments', 'wp_terms', 'wp_postmeta']
        : ['products', 'orders', 'users', 'categories', 'transactions'];

      return {
        success: true,
        columns: [`Tables_in_${dbName || 'database'}`],
        rows: mockTables.map(t => ({ [`Tables_in_${dbName || 'database'}`]: t })),
        rowCount: mockTables.length,
        durationMs: duration
      };
    }

    if (lower.includes('wp_users') || lower.includes('from users')) {
      return {
        success: true,
        columns: ['ID', 'user_login', 'user_email', 'user_registered', 'user_status'],
        rows: [
          { ID: '1', user_login: 'admin', user_email: 'admin@mywebsite.com', user_registered: '2026-01-10 08:30:00', user_status: '0' },
          { ID: '2', user_login: 'editor', user_email: 'editor@mywebsite.com', user_registered: '2026-02-14 12:45:22', user_status: '0' },
          { ID: '3', user_login: 'customer1', user_email: 'budi@gmail.com', user_registered: '2026-03-01 19:12:05', user_status: '0' }
        ],
        rowCount: 3,
        durationMs: duration
      };
    }

    // Default generic response for queries in dev mode
    return {
      success: true,
      columns: ['Result', 'Status', 'Message'],
      rows: [
        {
          Result: 'OK',
          Status: 'Success',
          Message: `Query executed on ${dbName || 'server'}: "${trimmed.slice(0, 45)}${trimmed.length > 45 ? '...' : ''}"`
        }
      ],
      rowCount: 1,
      durationMs: duration
    };
  }

  // 9. Backup Database (Dump .sql)
  async backupDatabase(dbName) {
    if (!dbName) throw new Error('Database name is required');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${dbName}_backup_${timestamp}.sql`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    if (this.mysqlInstalled) {
      try {
        await execAsync(`mysqldump ${dbName} > "${filePath}"`);
        return { fileName, filePath, size: fs.statSync(filePath).size };
      } catch (err) {
        throw new Error(`mysqldump error: ${err.message}`);
      }
    }

    // Dev backup generator: writes standard MySQL dump header
    const sampleSql = `-- HostPanel MySQL Dump
-- Database: ${dbName}
-- Generated: ${new Date().toISOString()}
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ \`${dbName}\` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;
USE \`${dbName}\`;

--
-- Table structure for table \`example_table\`
--

DROP TABLE IF EXISTS \`example_table\`;
CREATE TABLE \`example_table\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL,
  \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table \`example_table\`
--

LOCK TABLES \`example_table\` WRITE;
INSERT INTO \`example_table\` VALUES (1,'HostPanel Initial Data','2026-10-21 00:00:00');
UNLOCK TABLES;

-- Dump completed on ${new Date().toISOString()}
`;
    fs.writeFileSync(filePath, sampleSql, 'utf8');
    return { fileName, filePath, size: Buffer.byteLength(sampleSql) };
  }

  // 10. List Backups
  listBackups() {
    this.ensureDirsAndFiles();
    try {
      const files = fs.readdirSync(BACKUPS_DIR);
      return files
        .filter(f => f.endsWith('.sql'))
        .map(file => {
          const fullPath = path.join(BACKUPS_DIR, file);
          const stat = fs.statSync(fullPath);
          return {
            fileName: file,
            sizeBytes: stat.size,
            createdAt: stat.birthtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return [];
    }
  }

  // 11. Restore Database from SQL file content or file path
  async restoreDatabase(dbName, sqlContent) {
    if (!dbName) throw new Error('Target database name is required');
    if (!sqlContent) throw new Error('SQL content is empty');

    if (this.mysqlInstalled) {
      const tempPath = path.join(BACKUPS_DIR, `temp_restore_${Date.now()}.sql`);
      try {
        fs.writeFileSync(tempPath, sqlContent, 'utf8');
        await execAsync(`mysql ${dbName} < "${tempPath}"`);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (err) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw new Error(`Restore error: ${err.message}`);
      }
    }

    return { success: true, message: `Database ${dbName} restored successfully.` };
  }
}

module.exports = new DatabaseService();

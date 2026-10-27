const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { config } = require('../config');

let archiverModule = null;
async function getArchiver() {
  if (!archiverModule) {
    const mod = await import('archiver');
    archiverModule = mod.default || mod;
  }
  return archiverModule;
}

// Recognized text file extensions
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.php', '.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1',
  '.env', '.yaml', '.yml', '.xml', '.svg', '.ini', '.conf', '.cfg',
  '.toml', '.sql', '.log', '.gitignore', '.dockerignore', 'dockerfile',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.java', '.rb'
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'
]);

const ARCHIVE_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'
]);

function normalizePath(targetPath) {
  if (!targetPath) {
    return config.rootPath || process.cwd();
  }
  return path.resolve(targetPath);
}

function getAvailableDrives() {
  if (process.platform === 'win32') {
    const drives = [];
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of possible) {
      const drivePath = `${letter}:\\`;
      try {
        if (fs.existsSync(drivePath)) {
          drives.push(drivePath);
        }
      } catch (e) {
        // Drive not accessible
      }
    }
    return drives;
  }
  return ['/'];
}

function isTextFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(base) || base.startsWith('.env');
}

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function isArchiveFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ARCHIVE_EXTENSIONS.has(ext);
}

async function listDirectory(dirPath) {
  const resolved = normalizePath(dirPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }

  const stat = await fs.promises.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });

  const items = [];
  for (const entry of entries) {
    const itemPath = path.join(resolved, entry.name);
    try {
      const itemStat = await fs.promises.stat(itemPath);
      const isDir = entry.isDirectory();
      items.push({
        name: entry.name,
        path: itemPath,
        isDirectory: isDir,
        size: isDir ? 0 : itemStat.size,
        modifiedAt: itemStat.mtime,
        extension: isDir ? '' : path.extname(entry.name).toLowerCase(),
        isText: isDir ? false : isTextFile(entry.name),
        isImage: isDir ? false : isImageFile(entry.name),
        isArchive: isDir ? false : isArchiveFile(entry.name)
      });
    } catch (e) {
      // Permission error or broken symlink
      items.push({
        name: entry.name,
        path: itemPath,
        isDirectory: entry.isDirectory(),
        size: 0,
        modifiedAt: null,
        error: 'Inaccessible'
      });
    }
  }

  // Sort: directories first, then alphabetically
  items.sort((a, b) => {
    if (a.isDirectory === b.isDirectory) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    return a.isDirectory ? -1 : 1;
  });

  const parentPath = path.dirname(resolved);

  return {
    currentPath: resolved,
    parentPath: parentPath !== resolved ? parentPath : null,
    items,
    drives: getAvailableDrives()
  };
}

async function readFileContent(filePath, maxBytes = 5 * 1024 * 1024) {
  const resolved = normalizePath(filePath);
  const stat = await fs.promises.stat(resolved);

  if (stat.isDirectory()) {
    throw new Error('Cannot read directory as text file');
  }

  if (stat.size > maxBytes) {
    throw new Error(`File is too large (${(stat.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed is 5 MB.`);
  }

  const content = await fs.promises.readFile(resolved, 'utf8');
  return {
    path: resolved,
    name: path.basename(resolved),
    size: stat.size,
    content
  };
}

async function saveFileContent(filePath, content) {
  const resolved = normalizePath(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  await fs.promises.writeFile(resolved, content, 'utf8');
  return { path: resolved, size: Buffer.byteLength(content, 'utf8') };
}

async function createNewFile(parentDir, fileName) {
  const resolvedDir = normalizePath(parentDir);
  const targetPath = path.join(resolvedDir, fileName);

  if (fs.existsSync(targetPath)) {
    throw new Error('File already exists');
  }

  await fs.promises.writeFile(targetPath, '', 'utf8');
  return { path: targetPath };
}

async function createNewFolder(parentDir, folderName) {
  const resolvedDir = normalizePath(parentDir);
  const targetPath = path.join(resolvedDir, folderName);

  if (fs.existsSync(targetPath)) {
    throw new Error('Folder already exists');
  }

  await fs.promises.mkdir(targetPath, { recursive: true });
  return { path: targetPath };
}

async function renameItem(oldPath, newPath) {
  const resolvedOld = normalizePath(oldPath);
  const resolvedNew = normalizePath(newPath);

  if (!fs.existsSync(resolvedOld)) {
    throw new Error('Source item does not exist');
  }

  if (fs.existsSync(resolvedNew)) {
    throw new Error('Destination name already exists');
  }

  await fs.promises.rename(resolvedOld, resolvedNew);
  return { oldPath: resolvedOld, newPath: resolvedNew };
}

async function deleteItem(targetPath) {
  const resolved = normalizePath(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error('Item does not exist');
  }

  const stat = await fs.promises.stat(resolved);
  if (stat.isDirectory()) {
    await fs.promises.rm(resolved, { recursive: true, force: true });
  } else {
    await fs.promises.unlink(resolved);
  }

  return { path: resolved };
}

async function extractZip(zipFilePath, destinationDir) {
  const resolvedZip = normalizePath(zipFilePath);
  const targetDir = destinationDir ? normalizePath(destinationDir) : path.dirname(resolvedZip);

  if (!fs.existsSync(resolvedZip)) {
    throw new Error('Zip archive does not exist');
  }

  const zip = new AdmZip(resolvedZip);
  zip.extractAllTo(targetDir, true);
  return { extractedTo: targetDir };
}

async function compressToZip(sourcePath, outputZipPath) {
  const resolvedSource = normalizePath(sourcePath);
  const targetZip = outputZipPath
    ? normalizePath(outputZipPath)
    : `${resolvedSource}.zip`;

  if (!fs.existsSync(resolvedSource)) {
    throw new Error('Source file or directory does not exist');
  }

  const archiver = await getArchiver();
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve({ zipPath: targetZip, size: archive.pointer() });
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    const stat = fs.statSync(resolvedSource);
    if (stat.isDirectory()) {
      archive.directory(resolvedSource, false);
    } else {
      archive.file(resolvedSource, { name: path.basename(resolvedSource) });
    }

    archive.finalize();
  });
}

module.exports = {
  normalizePath,
  listDirectory,
  readFileContent,
  saveFileContent,
  createNewFile,
  createNewFolder,
  renameItem,
  deleteItem,
  extractZip,
  compressToZip,
  getAvailableDrives
};

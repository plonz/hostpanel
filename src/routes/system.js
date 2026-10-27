const express = require('express');
const router = express.Router();
const si = require('systeminformation');
const { authMiddleware } = require('../middleware/auth');
const { execSync } = require('child_process');

let cachedStaticInfo = null;

async function getStaticInfo() {
  if (cachedStaticInfo) return cachedStaticInfo;

  try {
    const [osInfo, cpuInfo, sys] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.system()
    ]);

    // Check runtime versions
    let nodeVer = process.version;
    let pythonVer = 'Not found';
    try {
      pythonVer = execSync('python3 --version || python --version', { encoding: 'utf8', timeout: 2000 }).trim();
    } catch (e) {
      // ignore
    }

    cachedStaticInfo = {
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        hostname: osInfo.hostname
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: cpuInfo.speed
      },
      system: {
        model: sys.model,
        manufacturer: sys.manufacturer
      },
      runtimes: {
        node: nodeVer,
        python: pythonVer
      }
    };
  } catch (err) {
    console.error('Error fetching static system info:', err);
  }

  return cachedStaticInfo;
}

// GET /api/system/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [currentLoad, mem, fsSize, time, staticInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
      getStaticInfo()
    ]);

    // Calculate disk summary
    const disks = fsSize.map(d => ({
      fs: d.fs,
      type: d.type,
      size: d.size,
      used: d.used,
      available: d.available,
      use: d.use,
      mount: d.mount
    }));

    res.json({
      timestamp: Date.now(),
      uptime: time.uptime,
      load: {
        currentLoad: Math.round(currentLoad.currentLoad),
        cpus: currentLoad.cpus ? currentLoad.cpus.map(c => Math.round(c.load)) : []
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.active || (mem.total - mem.available) || mem.used,
        available: mem.available,
        usedPercent: Math.round(((mem.total - mem.available) / mem.total) * 100)
      },
      disks,
      static: staticInfo
    });
  } catch (err) {
    console.error('System stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve system statistics' });
  }
});

module.exports = router;

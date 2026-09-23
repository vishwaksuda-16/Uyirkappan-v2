const { execSync } = require('child_process');

function killPort(port = 5000) {
  console.log(`Checking for processes occupying port ${port}...`);
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.split('\n').filter(l => l.includes(`:${port}`) && l.includes('LISTENING'));

      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }

      if (pids.size === 0) {
        console.log(`✓ Port ${port} is not occupied.`);
        return;
      }

      for (const pid of pids) {
        console.log(`Terminating process PID ${pid} listening on port ${port}...`);
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`✓ Terminated PID ${pid}.`);
        } catch (e) {
          console.warn(`Failed to terminate PID ${pid}: ${e.message}`);
        }
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
      if (output) {
        const pids = output.split('\n').filter(Boolean);
        for (const pid of pids) {
          console.log(`Terminating process PID ${pid} listening on port ${port}...`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`✓ Terminated PID ${pid}.`);
        }
      } else {
        console.log(`✓ Port ${port} is not occupied.`);
      }
    }
  } catch (err) {
    // netstat/findstr returns code 1 if no matches found
    console.log(`✓ Port ${port} is free.`);
  }
}

if (require.main === module) {
  const ports = process.argv[2] ? [parseInt(process.argv[2], 10)] : [5000, 4000];
  for (const p of ports) {
    killPort(p);
  }
}

module.exports = { killPort };

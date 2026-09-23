/*
 * Make repeated `npm start` / `npm run dev` safe on Windows and Unix.
 * A stopped terminal can leave a Node listener behind; release only that
 * listener before starting the backend again.  A non-Node process is left
 * untouched and reported clearly rather than being killed unexpectedly.
 */
const { execFileSync, execSync } = require('child_process');

const port = Number(process.env.PORT) || 5000;

function listenersOnPort() {
  if (process.platform === 'win32') {
    try {
      const lines = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).split(/\r?\n/);
      return [...new Set(lines.filter((line) => line.includes('LISTENING'))
        .map((line) => line.trim().split(/\s+/).at(-1)).filter(Boolean))];
    } catch (_) { return []; }
  }
  try { return execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean); } catch (_) { return []; }
}

for (const pid of listenersOnPort()) {
  try {
    const processName = process.platform === 'win32'
      ? execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).ProcessName`], { encoding: 'utf8' }).trim()
      : execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim();
    if (!/node(?:\.exe)?$/i.test(processName)) {
      console.error(`Port ${port} is used by ${processName} (PID ${pid}); it was not stopped.`);
      process.exit(1);
    }
    console.log(`Stopping previous UyirKappan Node listener (PID ${pid}) on port ${port}…`);
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGTERM');
  } catch (error) {
    console.error(`Could not release port ${port}: ${error.message}`);
    process.exit(1);
  }
}

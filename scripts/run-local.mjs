import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tasks = {
  build: ['vinext', ['build'], 180_000],
  dev: ['vite', [], 0],
  start: ['vinext', ['start'], 0],
  lint: ['eslint', ['.', '--ignore-pattern', 'dist', '--ignore-pattern', '.next'], 120_000],
  'db:generate': ['drizzle-kit', ['generate'], 60_000],
  'test:integration': [null, ['--test', 'tests/integration/*.test.mjs'], 90_000],
};
const task = tasks[process.argv[2]];
if (!task) throw new Error(`Unknown local task: ${process.argv[2]}`);
const [pkg, args, deadline] = task;
let bin = [];
if (pkg) {
  const directory = resolve(root, 'node_modules', pkg);
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  const entry = typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin)[0];
  bin = [resolve(directory, entry)];
}

// Preserve HOME, npm cache, proxy and credentials; scope only runtime scratch files.
const env = {
  ...process.env,
  WRANGLER_WRITE_LOGS: 'false',
  WRANGLER_LOG_PATH: resolve(root, '.wrangler/logs'),
  MINIFLARE_REGISTRY_PATH: resolve(root, '.wrangler/registry'),
};
const child = spawn(process.execPath, [...bin, ...args, ...process.argv.slice(3)], {
  cwd: root, env, stdio: 'inherit', shell: false,
  detached: process.platform !== 'win32', windowsHide: true,
});
let requestedExit;
function stop(code) {
  if (requestedExit !== undefined || !child.pid) return;
  requestedExit = code;
  // Kill only this task's process tree, including workerd, on cancellation/timeout.
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true, shell: false,
    });
    killer.on('error', () => child.kill('SIGKILL'));
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
const timer = deadline ? setTimeout(() => {
  console.error(`${process.argv[2]} exceeded ${deadline / 1000}s.`);
  stop(124);
}, deadline) : null;
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
child.on('error', error => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 1;
});
child.on('close', code => {
  clearTimeout(timer);
  process.exitCode = requestedExit ?? code ?? 1;
});

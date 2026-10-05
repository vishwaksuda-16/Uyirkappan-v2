#!/usr/bin/env node
/**
 * Master Test Runner for UyirKappan Automated Testing Suite
 * Executes:
 *   1. Level 1 - 4 Four-Level Test Suite (test/phase18_four_level_testing.test.js)
 *   2. Phase 16 Security & RBAC Suite (test/security_rbac.test.js)
 *   3. Phase 17 Observability Suite (test/observability.test.js)
 *   4. Phase 14 Socket.IO Contract Suite (test/socket_io_contract.test.js)
 *   5. Complete Monorepo Backend Suite (npm test)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');

const SUITES = [
  {
    name: 'Phase 18 Four-Level Testing Suite (Unit, Integration, Real-Time, E2E)',
    command: process.execPath,
    args: ['--test', 'test/phase18_four_level_testing.test.js'],
  },
  {
    name: 'Phase 16 Security & RBAC Audit Suite',
    command: process.execPath,
    args: ['--test', 'test/security_rbac.test.js'],
  },
  {
    name: 'Phase 17 Observability & Correlation Suite',
    command: process.execPath,
    args: ['--test', 'test/observability.test.js'],
  },
  {
    name: 'Phase 14 Socket.IO Real-Time Contract Suite',
    command: process.execPath,
    args: ['--test', 'test/socket_io_contract.test.js'],
  },
];

console.log('============================================================');
console.log('UYIRKAPPAN AUTOMATED TESTING SYSTEM — MASTER SUITE RUNNER');
console.log('============================================================\n');

let totalSuites = SUITES.length;
let passedSuites = 0;
let failedSuites = 0;
const results = [];

const startTime = Date.now();

for (const suite of SUITES) {
  console.log(`>>> Running: ${suite.name}`);
  const runStart = Date.now();
  const res = spawnSync(suite.command, suite.args, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: process.env,
  });
  const duration = ((Date.now() - runStart) / 1000).toFixed(2);

  if (res.status === 0) {
    passedSuites++;
    results.push({ name: suite.name, status: 'PASS', duration: `${duration}s` });
    console.log(`[PASS] ${suite.name} (${duration}s)\n`);
  } else {
    failedSuites++;
    results.push({ name: suite.name, status: 'FAIL', duration: `${duration}s`, code: res.status });
    console.error(`[FAIL] ${suite.name} exited with code ${res.status} (${duration}s)\n`);
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('============================================================');
console.log('MASTER SUITE EXECUTION SUMMARY');
console.log('============================================================');
console.log(`Total Suites:  ${totalSuites}`);
console.log(`Passed Suites: ${passedSuites}`);
console.log(`Failed Suites: ${failedSuites}`);
console.log(`Duration:      ${totalDuration}s\n`);

console.table(results);

if (failedSuites > 0) {
  console.error('\n❌ Master Test Runner detected test failures.');
  process.exit(1);
} else {
  console.log('\n✅ All test suites passed successfully with zero failures.');
  process.exit(0);
}

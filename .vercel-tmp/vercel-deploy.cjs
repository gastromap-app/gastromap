#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
const ALLOWED_COMMANDS = new Set(['vercel', 'npm', 'pnpm', 'yarn']);
function log(msg) { console.error(msg); }
function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) throw new Error(`Command not in whitelist: ${cmd}`);
  try {
    if (isWindows) { const r = spawnSync('where', [cmd], { stdio: 'ignore' }); return r.status === 0; }
    else { const r = spawnSync('sh', ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' }); return r.status === 0; }
  } catch { return false; }
}
function getCommandOutput(cmd, args) {
  try { const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows }); return r.status === 0 ? (r.stdout || '').trim() : null; } catch { return null; }
}
function checkVercelInstalled() {
  if (!commandExists('vercel')) { log('Error: Vercel CLI is not installed'); process.exit(1); }
  log(`Vercel CLI version: ${getCommandOutput('vercel', ['--version']) || 'unknown'}`);
}
function checkLoginStatus() {
  try {
    const r = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    const output = (r.stdout || '').trim();
    if (r.status === 0 && output && !output.includes('Error') && !output.includes('not logged in')) { log(`Logged in as: ${output}`); return true; }
  } catch {}
  return false;
}
function runBuildIfNeeded(projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return true;
  let packageJson;
  try { packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')); } catch { return true; }
  if (!packageJson.scripts || !packageJson.scripts.build) { log('No build script found, skipping build'); return true; }
  log('\n========================================\nRunning pre-deployment build...\n========================================\n');
  let pkgManager = 'npm';
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) pkgManager = 'pnpm';
  else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) pkgManager = 'yarn';
  else if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) pkgManager = 'npm';
  log(`Using package manager: ${pkgManager}`);
  const buildArgs = pkgManager === 'npm' ? ['run', 'build'] : ['build'];
  log(`Executing: ${pkgManager} ${buildArgs.join(' ')}\n`);
  const r = spawnSync(pkgManager, buildArgs, { cwd: projectPath, stdio: 'inherit', shell: isWindows });
  if (r.status !== 0) { log('\nBuild FAILED!'); process.exit(1); }
  log('\n========================================\nBuild completed successfully!\n========================================');
  return true;
}
function doDeploy(projectPath) {
  log('\nStarting deployment...\n');
  log('Deployment environment: Production (Public)');
  log('Executing command: vercel --yes --prod\n========================================\n');
  const result = spawnSync('vercel', ['--yes', '--prod'], { cwd: projectPath, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'], timeout: 300000, shell: isWindows });
  const output = (result.stdout || '') + (result.stderr || '');
  log(output);
  if (result.status !== 0) { log('\nDeployment failed'); process.exit(1); }
  const aliased_match = output.match(/Aliased:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
  const deploymentMatch = output.match(/Production:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
  const finalUrl = (aliased_match ? aliased_match[1] : null) || (deploymentMatch ? deploymentMatch[1] : null);
  log('\n========================================\nDeployment successful!\n========================================\n');
  if (finalUrl) { log(`Your site is live! Visit: ${finalUrl}\n`); console.log(JSON.stringify({ status: 'success', url: finalUrl })); }
}
function main() {
  log('========================================\nVercel CLI Project Deployment\n========================================\n');
  checkVercelInstalled(); log('');
  if (!checkLoginStatus()) { log('\nError: Not logged in'); process.exit(1); }
  const projectPath = path.resolve('.');
  log(`Project path: ${projectPath}`);
  runBuildIfNeeded(projectPath);
  doDeploy(projectPath);
}
main();

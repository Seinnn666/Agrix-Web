// Measure actual dashboard UIs, never the sign-in or Landing Page by mistake.
// Lighthouse attaches to a Chrome instance whose storage holds ONLY QA fixture sessions.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const role = process.argv[2];
if (!['admin', 'client'].includes(role)) throw new Error('Usage: node lighthouse-dashboard-audit.mjs admin|client');
const url = 'http://127.0.0.1:4180/';
const outDir = './lighthouse-reports';
const chromePort = role === 'admin' ? 9222 : 9223;
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    `--remote-debugging-port=${chromePort}`,
    '--no-first-run', '--no-default-browser-check',
  ],
});
const page = await browser.newPage();
const errors = [];
const fixtureResponses = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('response', (response) => {
  if (response.url().startsWith(`${url}api/`)) fixtureResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
});

const expected = role === 'admin'
  ? ['Welcome back, Admin', 'Total Users', '34', 'Recent Users']
  : ['Track storage and field conditions in one place', 'Purpose', 'Alerts'];

async function verify(label) {
  await page.waitForFunction(
    (terms) => terms.every((term) => document.body.innerText.includes(term)),
    { timeout: 30000 }, expected,
  );
  const state = await page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText.slice(0, 2000),
    appBooted: Boolean(window.__AGRIX_APP_BOOTED__),
  }));
  if (!state.appBooted || state.text.includes('App crashed while rendering') || state.text.includes('Cannot reach API')) {
    throw new Error(`${role} dashboard did not load successfully (${label}): ${state.text.slice(0, 500)}`);
  }
  return { label, ...state };
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((selectedRole) => {
    localStorage.clear();
    if (selectedRole === 'admin') {
      localStorage.setItem('agrix_admin_token', 'qa-only-synthetic-admin-token');
      localStorage.setItem('agrix_admin_expiresAt', new Date(Date.now() + 60 * 60 * 1000).toISOString());
    } else {
      localStorage.setItem('agrix_token', 'qa-only-synthetic-client-token');
      localStorage.setItem('agrix_user', JSON.stringify({
        id: 'qa-client-1', _id: 'qa-client-1', firstName: 'Sample', lastName: 'Farmer',
        fullName: 'Sample Farmer', email: 'sample@example.test', role: 'user',
        isAdmin: false, emailVerified: true,
      }));
    }
  }, role);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  const verified = [await verify('before-first-run')];
  await page.screenshot({ path: `${outDir}/${role}-fixture-ui.png`, fullPage: false });

  for (let run = 1; run <= 5; run += 1) {
    // Preserve the synthetic storage between runs. The dedicated browser
    // process prevents other tests and real user sessions from contaminating it.
    const report = `${outDir}/${role}-run-${run}.json`;
    const result = spawnSync('lighthouse', [url,
      '--preset=desktop', '--only-categories=performance',
      `--port=${chromePort}`, '--disable-storage-reset',
      '--output=json', `--output-path=${report}`, '--quiet',
    ], { encoding: 'utf8', timeout: 180000 });
    if (result.status !== 0) {
      throw new Error(`Lighthouse ${role} run ${run} failed: ${result.stderr || result.stdout || result.error}`);
    }
    // Re-verify the actual role after EACH run, not merely the URL.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    verified.push(await verify(`after-run-${run}`));
    console.log(`${role} Lighthouse run ${run}/5: dashboard visibly verified`);
  }
  const diagnostic = { role, testMode: 'synthetic-local-session-and-api-fixtures', url, expected, verified, fixtureResponses, errors };
  fs.writeFileSync(`${outDir}/${role}-verification.json`, `${JSON.stringify(diagnostic, null, 2)}\n`);
} catch (error) {
  const state = await page.evaluate(() => document.body.innerText.slice(0, 2000)).catch(() => '[unavailable]');
  fs.writeFileSync(`${outDir}/${role}-verification-error.json`, `${JSON.stringify({ role, message: String(error), visibleText: state, errors, fixtureResponses }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

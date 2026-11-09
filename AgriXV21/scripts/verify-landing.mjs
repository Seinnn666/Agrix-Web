import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const url = 'http://127.0.0.1:4180/';
const errors = [];
const failedRequests = [];
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

let passed = false;
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText || 'failed'}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('AgriX Coffee Monitoring'),
      { timeout: 20000 },
    );
    passed = true;
  } catch (_error) {
    // The diagnostic below is authoritative for why page verification failed.
  }
  const state = await page.evaluate(() => ({
    title: document.title,
    visibleText: document.body.innerText.slice(0, 1200),
    bundleLoaded: Boolean(window.__AGRIX_BUNDLE_LOADED__),
    appBooted: Boolean(window.__AGRIX_APP_BOOTED__),
  }));
  const diagnostic = {
    url: page.url(),
    renderedExpectedLandingPage: passed,
    ...state,
    errors: errors.slice(0, 25),
    failedRequests: failedRequests.slice(0, 25),
  };
  fs.writeFileSync('./lighthouse-reports/landing-verification.json', `${JSON.stringify(diagnostic, null, 2)}\n`);
  console.log('Landing browser verification:', JSON.stringify(diagnostic, null, 2));
  if (!passed) {
    fs.writeFileSync('./lighthouse-reports/landing-dom.html', await page.content());
  }
} finally {
  await browser.close();
}

if (!passed) {
  throw new Error('The Landing Page did not render, so Lighthouse measurements were not collected.');
}

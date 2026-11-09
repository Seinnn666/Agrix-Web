import fs from 'node:fs';
import path from 'node:path';

const reportsDirectory = process.argv[2] || './lighthouse-reports';
const targetUrl = 'http://127.0.0.1:4180/';
const runs = [];

const metric = (audits, auditId, divisor = 1) => {
  const value = audits?.[auditId]?.numericValue;
  if (!Number.isFinite(value)) {
    throw new Error(`Missing valid Lighthouse metric: ${auditId}`);
  }
  return value / divisor;
};

for (let run = 1; run <= 5; run += 1) {
  const filename = path.join(reportsDirectory, `landing-run-${run}.json`);
  const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const finalUrl = report.finalDisplayedUrl || report.finalUrl || '';
  if (report.requestedUrl !== targetUrl || !finalUrl.startsWith(targetUrl)) {
    throw new Error(`Run ${run} audited an unexpected URL: ${finalUrl}`);
  }
  if (report.runtimeError) {
    throw new Error(`Run ${run} failed: ${report.runtimeError.message}`);
  }
  const score = report.categories?.performance?.score;
  if (!Number.isFinite(score)) {
    throw new Error(`Run ${run} has no Performance score`);
  }
  runs.push({
    executionRun: run,
    performanceScore: score * 100,
    speedIndexSeconds: metric(report.audits, 'speed-index', 1000),
    fcpSeconds: metric(report.audits, 'first-contentful-paint', 1000),
    lcpSeconds: metric(report.audits, 'largest-contentful-paint', 1000),
    tbtMilliseconds: metric(report.audits, 'total-blocking-time'),
    cls: metric(report.audits, 'cumulative-layout-shift'),
    lighthouseVersion: report.lighthouseVersion,
    fetchTime: report.fetchTime,
  });
}

const metricKeys = [
  'performanceScore', 'speedIndexSeconds', 'fcpSeconds',
  'lcpSeconds', 'tbtMilliseconds', 'cls',
];
const averages = Object.fromEntries(metricKeys.map((key) => [
  key,
  runs.reduce((sum, row) => sum + row[key], 0) / runs.length,
]));

const summary = {
  module: 'Landing Page',
  deviceMode: 'desktop',
  testMode: 'signed out, production web export, no API fixtures',
  testedCommit: process.env.GITHUB_SHA || '[TO BE FILLED: tested commit]',
  testedUrl: targetUrl,
  lighthouseVersion: runs[0].lighthouseVersion,
  runs,
  averages,
  metTarget90: averages.performanceScore >= 90,
};

fs.writeFileSync(path.join(reportsDirectory, 'landing-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
const header = 'Execution Runs,Performance Score,Speed Index (second),FCP (second),LCP (second),TBT (millisecond),CLS';
const csvRows = runs.map((row) => [
  row.executionRun, ...metricKeys.map((key) => row[key].toFixed(key === 'cls' ? 4 : 2)),
].join(','));
csvRows.push(['Overall Average Performance Result', ...metricKeys.map((key) => averages[key].toFixed(key === 'cls' ? 4 : 2))].join(','));
fs.writeFileSync(path.join(reportsDirectory, 'landing-summary.csv'), `${[header, ...csvRows].join('\n')}\n`);

console.log(JSON.stringify({
  testedCommit: summary.testedCommit,
  lighthouseVersion: summary.lighthouseVersion,
  averagePerformanceScore: Number(averages.performanceScore.toFixed(2)),
  target90Met: summary.metTarget90,
  averages,
}, null, 2));

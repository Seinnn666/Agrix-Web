import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || './lighthouse-reports';
const url = 'http://127.0.0.1:4180/';
const metrics = {
  speedIndexSeconds: ['speed-index', 1000],
  fcpSeconds: ['first-contentful-paint', 1000],
  lcpSeconds: ['largest-contentful-paint', 1000],
  tbtMilliseconds: ['total-blocking-time', 1],
  cls: ['cumulative-layout-shift', 1],
};

for (const role of ['admin', 'client']) {
  const verification = JSON.parse(fs.readFileSync(path.join(dir, `${role}-verification.json`), 'utf8'));
  if (verification.verified?.length !== 6 || !verification.fixtureResponses.some((item) => item.status === 200 && item.path === (role === 'admin' ? '/api/admin/metrics' : '/api/sensors/history'))) {
    throw new Error(`${role}: no proof of dashboard rendering and successful API fixture response`);
  }
  const runs = [];
  for (let i = 1; i <= 5; i += 1) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, `${role}-run-${i}.json`), 'utf8'));
    if (data.requestedUrl !== url || !(data.finalDisplayedUrl || data.finalUrl || '').startsWith(url) || data.runtimeError) {
      throw new Error(`${role} run ${i} did not complete at the expected URL`);
    }
    const score = data.categories?.performance?.score;
    if (!Number.isFinite(score)) throw new Error(`${role} run ${i}: missing Performance score`);
    const run = { executionRun: i, performanceScore: score * 100 };
    for (const [key, [auditId, divisor]] of Object.entries(metrics)) {
      const value = data.audits?.[auditId]?.numericValue;
      if (!Number.isFinite(value)) throw new Error(`${role} run ${i}: missing ${auditId}`);
      run[key] = value / divisor;
    }
    run.lighthouseVersion = data.lighthouseVersion;
    run.fetchTime = data.fetchTime;
    runs.push(run);
  }
  const keys = ['performanceScore', ...Object.keys(metrics)];
  const averages = Object.fromEntries(keys.map((key) => [key, runs.reduce((sum, run) => sum + run[key], 0) / runs.length]));
  const summary = {
    module: role === 'admin' ? 'Admin Dashboard Overview' : 'Client Dashboard Overview',
    testMode: 'SYNTHETIC: saved QA role session + local read-only API fixtures, not live Supabase or Namecheap',
    deviceMode: 'desktop', testedUrl: url, testedCommit: process.env.GITHUB_SHA || '[TO BE FILLED: tested commit]',
    lighthouseVersion: runs[0].lighthouseVersion, runs, averages, metTarget90: averages.performanceScore >= 90,
  };
  fs.writeFileSync(path.join(dir, `${role}-summary.json`), `${JSON.stringify(summary, null, 2)}\n`);
  const cells = (row) => keys.map((key) => Number(row[key]).toFixed(key === 'cls' ? 4 : 2));
  const csv = [
    'Execution Runs,Performance Score,Speed Index (second),FCP (second),LCP (second),TBT (millisecond),CLS',
    ...runs.map((run) => [run.executionRun, ...cells(run)].join(',')),
    ['Overall Average Performance Result', ...cells(averages)].join(','),
  ].join('\n');
  fs.writeFileSync(path.join(dir, `${role}-summary.csv`), `${csv}\n`);
  console.log(JSON.stringify({ role, testedCommit: summary.testedCommit, averagePerformanceScore: Number(averages.performanceScore.toFixed(2)), target90Met: summary.metTarget90, averages }, null, 2));
}

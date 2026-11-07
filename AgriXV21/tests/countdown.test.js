import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCountdownEndAt,
  formatCountdown,
  getRemainingSeconds,
  readCountdownEndAt,
  startCountdownTicker,
  writeCountdownEndAt,
} from '../src/hooks/useCountdown.js';

test('countdown decreases each second, stops at zero, and enables the action', () => {
  let now = 10_000;
  let callback;
  let cleared = false;
  const states = [];
  const endAt = createCountdownEndAt(3, now);
  const stop = startCountdownTicker(endAt, (seconds) => states.push(seconds), {
    now: () => now,
    setInterval: (fn) => { callback = fn; return 1; },
    clearInterval: (id) => { assert.equal(id, 1); cleared = true; },
  });

  assert.equal(getRemainingSeconds(endAt, now) > 0, true);
  now += 1000;
  callback();
  now += 1000;
  callback();
  now += 1000;
  callback();

  assert.deepEqual(states, [3, 2, 1, 0]);
  assert.equal(states.at(-1) === 0, true);
  assert.equal(cleared, true);
  stop();
});

test('restores the end timestamp and calculates the current remaining time', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const now = 50_000;
  const endAt = createCountdownEndAt(150, now);
  writeCountdownEndAt('forgot-reset', endAt, storage);

  const restoredEndAt = readCountdownEndAt('forgot-reset', storage, now + 30_000);
  assert.equal(restoredEndAt, endAt);
  assert.equal(getRemainingSeconds(restoredEndAt, now + 30_000), 120);
  assert.equal(formatCountdown(120), '2:00');
  assert.equal(formatCountdown(1), '1 second');
  assert.equal(formatCountdown(0), '0 seconds');
  assert.equal(readCountdownEndAt('forgot-reset', storage, endAt + 1), 0);
  assert.equal(values.has('forgot-reset'), false);
});

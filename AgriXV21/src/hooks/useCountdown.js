import { useCallback, useEffect, useState } from 'react';

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch (_err) {
    return null;
  }
}

export function createCountdownEndAt(seconds, now = Date.now()) {
  const duration = Math.max(0, Math.ceil(Number(seconds) || 0));
  return duration ? now + duration * 1000 : 0;
}

export function getRemainingSeconds(endAt, now = Date.now()) {
  const end = Number(endAt);
  if (!Number.isFinite(end) || end <= now) return 0;
  return Math.ceil((end - now) / 1000);
}

export function formatCountdown(seconds) {
  const value = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const remainder = String(value % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }
  return `${value} second${value === 1 ? '' : 's'}`;
}

export function readCountdownEndAt(key, storage = getSessionStorage(), now = Date.now()) {
  try {
    const endAt = Number(storage?.getItem(key));
    if (!Number.isFinite(endAt) || endAt <= 0) return 0;
    if (endAt <= now) {
      storage?.removeItem(key);
      return 0;
    }
    return endAt;
  } catch (_err) {
    return 0;
  }
}

export function writeCountdownEndAt(key, endAt, storage = getSessionStorage()) {
  try {
    if (storage) storage.setItem(key, String(endAt));
  } catch (_err) {
  }
}

export function clearCountdownEndAt(key, storage = getSessionStorage()) {
  try {
    storage?.removeItem(key);
  } catch (_err) {
  }
}

export function startCountdownTicker(endAt, onTick, scheduler = {}) {
  const now = scheduler.now || (() => Date.now());
  const schedule = scheduler.setInterval || setInterval;
  const cancel = scheduler.clearInterval || clearInterval;
  let intervalId = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const remaining = getRemainingSeconds(endAt, now());
    onTick(remaining);
    if (remaining === 0 && intervalId !== null) {
      stopped = true;
      cancel(intervalId);
      intervalId = null;
    }
  };

  tick();
  if (!stopped && getRemainingSeconds(endAt, now()) > 0) {
    intervalId = schedule(tick, 1000);
  }

  return () => {
    stopped = true;
    if (intervalId !== null) cancel(intervalId);
  };
}

export function useCountdown(storageKey) {
  const [endAt, setEndAt] = useState(() => readCountdownEndAt(storageKey));
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(endAt));

  const clearCountdown = useCallback(() => {
    clearCountdownEndAt(storageKey);
    setEndAt(0);
    setRemainingSeconds(0);
  }, [storageKey]);

  const startCountdown = useCallback((seconds) => {
    const nextEndAt = createCountdownEndAt(seconds);
    if (!nextEndAt) {
      clearCountdown();
      return 0;
    }
    writeCountdownEndAt(storageKey, nextEndAt);
    setEndAt(nextEndAt);
    setRemainingSeconds(getRemainingSeconds(nextEndAt));
    return nextEndAt;
  }, [clearCountdown, storageKey]);

  useEffect(() => {
    if (!endAt) {
      setRemainingSeconds(0);
      return undefined;
    }

    let active = true;
    const applyRemaining = (remaining) => {
      if (!active) return;
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        clearCountdownEndAt(storageKey);
        setEndAt(0);
      }
    };
    const stopTicker = startCountdownTicker(endAt, applyRemaining);
    const onVisibilityChange = () => applyRemaining(getRemainingSeconds(endAt));
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      stopTicker();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [clearCountdown, endAt, storageKey]);

  return { remainingSeconds, isActive: remainingSeconds > 0, startCountdown, clearCountdown };
}

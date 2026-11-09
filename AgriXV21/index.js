const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined';

// Expo's Metro runtime loads on-demand chunks in production web exports.
if (IS_WEB) {
  require('@expo/metro-runtime');
}

function ensureStartupOverlay() {
  if (!IS_WEB) return null;
  const id = 'agrix-startup-overlay';
  const existing = document.getElementById(id);
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.setAttribute(
    'style',
    [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'background:#ffffff',
      'color:#0f172a',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      'padding:18px',
      'display:flex',
      'align-items:flex-start',
      'justify-content:center',
    ].join(';'),
  );

  const box = document.createElement('div');
  box.setAttribute(
    'style',
    [
      'width:min(900px,100%)',
      'border:1px solid #e2e8f0',
      'border-radius:12px',
      'padding:16px',
      'background:#fff',
      'box-shadow:0 10px 30px rgba(2,6,23,0.08)',
    ].join(';'),
  );

  const title = document.createElement('div');
  title.textContent = 'Loading AgriX…';
  title.setAttribute('style', 'font-weight:800;font-size:16px;margin-bottom:8px;');

  const body = document.createElement('pre');
  body.id = 'agrix-startup-overlay-body';
  body.textContent = 'If this stays here, the app failed to mount. Checking…';
  body.setAttribute('style', 'white-space:pre-wrap;margin:0;color:#334155;font-size:12px;line-height:1.4;');

  box.appendChild(title);
  box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return overlay;
}

function setOverlayMessage(message) {
  if (!IS_WEB) return;
  const overlay = ensureStartupOverlay();
  if (!overlay) return;
  const body = document.getElementById('agrix-startup-overlay-body');
  if (body) body.textContent = String(message || '');
}

if (IS_WEB) {
  try {
    window.__AGRIX_BUNDLE_LOADED__ = true;
  } catch (_err) {}

  const styleId = 'agrix-web-scroll-fix';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.appendChild(
      document.createTextNode(`
        html, body { width: 100%; margin: 0; padding: 0; overflow-y: auto !important; overscroll-behavior: auto; }
        html { scroll-behavior: smooth; }
        body { min-height: 100vh; }
        #root, #main { min-height: 100vh; height: auto; width: 100%; overflow: visible !important; }
      `),
    );
    document.head.appendChild(style);
  }

  ensureStartupOverlay();

  const removeOverlayIfBooted = setInterval(() => {
    try {
      if (!window.__AGRIX_APP_BOOTED__) return;
    } catch (_err) {
      return;
    }
    try {
      const el = document.getElementById('agrix-startup-overlay');
      if (el) el.remove();
    } catch (_err) {}
    clearInterval(removeOverlayIfBooted);
  }, 150);

  window.addEventListener('error', (event) => {
    const err = event?.error;
    const message = err?.stack || err?.message || event?.message || String(event);
    setOverlayMessage(message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = reason?.stack || reason?.message || String(reason);
    setOverlayMessage(message);
  });

  setTimeout(() => {
    try {
      if (window.__AGRIX_APP_BOOTED__) return;
    } catch (_err) {}
    setOverlayMessage(
      [
        'AgriX bundle loaded, but React did not mount the app.',
        '',
        'Try:',
        '- Hard refresh (Ctrl+Shift+R)',
        '- Open DevTools Console to see errors',
      ].join('\n'),
    );
  }, 4500);
}

require('./src/polyfill-react19');
require('react-native-gesture-handler');
const { registerRootComponent } = require('expo');
const App = require('./App').default;

registerRootComponent(App);

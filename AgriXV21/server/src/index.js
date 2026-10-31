import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { checkDb } from './lib/db.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';
import farmsRouter from './routes/farms.js';
import sensorsRouter from './routes/sensors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

const app = express();
app.set('trust proxy', true);

const basePath = String(process.env.BASE_PATH || '').trim();
const normalizedBasePath =
  basePath && basePath !== '/'
    ? `/${basePath}`.replace(/\/+/g, '/').replace(/\/$/, '')
    : '';

if (normalizedBasePath) {
  app.use((req, _res, next) => {
    const url = String(req.url || '');
    if (url === normalizedBasePath) {
      req.url = '/';
      return next();
    }
    if (url.startsWith(`${normalizedBasePath}/`)) {
      req.url = url.slice(normalizedBasePath.length) || '/';
      return next();
    }
    return next();
  });
}

const hasClientOriginEnv = Boolean(String(process.env.CLIENT_ORIGIN || '').trim());
const allowedOrigins = String(process.env.CLIENT_ORIGIN || 'http://localhost:8082')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedHostnames = new Set(
  allowedOrigins
    .map((entry) => {
      try {
        return new URL(entry).hostname.toLowerCase();
      } catch (_err) {
        return String(entry).replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim().toLowerCase();
      }
    })
    .filter(Boolean)
);

function getRequestHost(req) {
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.get('host') || '').trim();
  return String(host || '').split(':')[0].trim().toLowerCase();
}

function getSameSiteHostnames(req) {
  const host = getRequestHost(req);
  const out = new Set();
  if (!host) return out;
  out.add(host);
  if (host.startsWith('www.')) out.add(host.slice(4));
  if (host.startsWith('api.')) {
    const root = host.slice(4);
    if (root) {
      out.add(root);
      out.add(`www.${root}`);
    }
  } else {
    out.add(`www.${host}`);
    out.add(`api.${host}`);
  }
  return out;
}

app.use(
  cors((req, callback) => {
    const origin = String(req.get('origin') || '').trim();
    if (!origin) return callback(null, { origin: true, credentials: false });

    let originHostname = '';
    try {
      originHostname = new URL(origin).hostname.toLowerCase();
    } catch (_err) {
    }

    const isAllowed =
      allowedOrigins.includes(origin) ||
      (originHostname && allowedHostnames.has(originHostname)) ||
      /^https?:\/\/localhost:\d+$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
      (!hasClientOriginEnv && originHostname && getSameSiteHostnames(req).has(originHostname)) ||
      (process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/.test(
          origin
        ));

    return callback(null, { origin: isAllowed, credentials: false, optionsSuccessStatus: 204 });
  })
);
app.use(express.json({ limit: '100kb' }));

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/health', async (_req, res) => {
  try {
    await checkDb();
    return res.json({
      ok: true,
      db: {
        provider: 'supabase',
        connected: true,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      db: {
        provider: 'supabase',
        connected: false,
        error: String(err?.message || err),
      },
    });
  }
});

app.get('/reset-password', (req, res) => {
  const token = String(req.query?.resetToken || '').trim();
  const safeToken = token.replace(/"/g, '&quot;');
  const homeUrl = String(process.env.PASSWORD_RESET_HOME_URL || allowedOrigins[0] || 'http://localhost:8082').trim();
  const safeHomeUrl = homeUrl.replace(/"/g, '&quot;');
  res
    .status(200)
    .type('html')
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset Password</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f6f8fb; margin: 0; padding: 24px; }
      .card { max-width: 520px; width: 100%; margin: 0 auto; background: #fff; border: 1px solid #e6eaf0; border-radius: 12px; padding: 20px; }
      .toprow { display: flex; justify-content: flex-end; margin-bottom: 6px; }
      .homeLink { color: #2E7D32; font-weight: 900; text-decoration: none; }
      .homeLink:hover { text-decoration: underline; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p { margin: 0 0 16px; color: #425466; }
      label { display: block; font-weight: 600; margin: 12px 0 6px; }
      .pw-wrap { display: flex; align-items: stretch; }
      .pw-wrap input { flex: 1; padding: 12px; border: 1px solid #d9dee7; border-right: none; border-radius: 10px 0 0 10px; font-size: 14px; }
      .pw-wrap .pw-toggle { padding: 12px 12px; border: 1px solid #d9dee7; border-left: none; background: #fff; color: #2E7D32; font-weight: 800; border-radius: 0 10px 10px 0; cursor: pointer; width: auto; margin-top: 0; }
      button { width: 100%; margin-top: 16px; padding: 12px 14px; background: #2E7D32; border: none; border-radius: 12px; color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
      button:disabled { opacity: 0.7; cursor: not-allowed; }
      .hint { font-size: 12px; color: #667085; margin-top: 10px; }
      .msg { margin-top: 14px; font-weight: 700; }
      .err { color: #b00020; }
      .ok { color: #2E7D32; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="toprow"><a class="homeLink" href="${safeHomeUrl}">Home</a></div>
      <h1>Reset Password</h1>
      <p>Enter a new password to continue.</p>
      <form id="form">
        <input type="hidden" id="token" value="${safeToken}" />
        <label for="password">New Password</label>
        <div class="pw-wrap">
          <input id="password" type="password" autocomplete="new-password" required />
          <button id="togglePassword" class="pw-toggle" type="button">Show</button>
        </div>
        <label for="confirmPassword">Confirm Password</label>
        <div class="pw-wrap">
          <input id="confirmPassword" type="password" autocomplete="new-password" required />
          <button id="toggleConfirm" class="pw-toggle" type="button">Show</button>
        </div>
        <button id="btn" type="submit">Reset Password</button>
      </form>
      <div class="hint">Minimum 8 characters, include letters, numbers, and 1+ special character.</div>
      <div id="msg" class="msg"></div>
    </div>
    <script>
      (function () {
        var form = document.getElementById('form');
        var msg = document.getElementById('msg');
        var btn = document.getElementById('btn');
        var togglePassword = document.getElementById('togglePassword');
        var toggleConfirm = document.getElementById('toggleConfirm');
        togglePassword.addEventListener('click', function () {
          var input = document.getElementById('password');
          var isHidden = input.type === 'password';
          input.type = isHidden ? 'text' : 'password';
          togglePassword.textContent = isHidden ? 'Hide' : 'Show';
        });
        toggleConfirm.addEventListener('click', function () {
          var input = document.getElementById('confirmPassword');
          var isHidden = input.type === 'password';
          input.type = isHidden ? 'text' : 'password';
          toggleConfirm.textContent = isHidden ? 'Hide' : 'Show';
        });
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          msg.textContent = '';
          msg.className = 'msg';
          btn.disabled = true;
          try {
            var token = document.getElementById('token').value;
            var password = document.getElementById('password').value;
            var confirmPassword = document.getElementById('confirmPassword').value;
            if (!token) throw new Error('Reset link is missing or invalid.');
            if (password !== confirmPassword) throw new Error('Passwords do not match.');
            var res = await fetch('/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token, password: password })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok) {
              var detail = (data && data.fieldErrors && data.fieldErrors.password) ? data.fieldErrors.password
                           : (data && data.error) ? data.error
                           : 'Failed to reset password';
              throw new Error(detail);
            }
            msg.textContent = 'Password reset successful. You can close this tab and sign in.';
            msg.className = 'msg ok';
            form.reset();
          } catch (err) {
            msg.textContent = String(err && err.message ? err.message : err);
            msg.className = 'msg err';
          } finally {
            btn.disabled = false;
          }
        });
      })();
    </script>
  </body>
</html>`);
});

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/admin', adminRouter);
app.use('/farms', farmsRouter);
app.use('/sensors', sensorsRouter);

const distDir = path.resolve(__dirname, '../../dist');
const distIndexPath = path.join(distDir, 'index.html');
if (fs.existsSync(distIndexPath)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(distIndexPath);
  });
}

const port = Number(process.env.PORT || 4000);
const host = String(process.env.HOST || process.env.IP || '0.0.0.0');

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});


function assertEmailJsEnv() {
  const missing = [];
  if (!process.env.EMAILJS_SERVICE_ID) missing.push('EMAILJS_SERVICE_ID');
  if (!process.env.EMAILJS_TEMPLATE_ID) missing.push('EMAILJS_TEMPLATE_ID');
  if (!process.env.EMAILJS_PUBLIC_KEY) missing.push('EMAILJS_PUBLIC_KEY');
  if (missing.length) {
    const err = new Error('Email service is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    err.missing = missing;
    throw err;
  }
}

function assertEmailJsResetEnv() {
  const missing = [];
  if (!process.env.EMAILJS_SERVICE_ID) missing.push('EMAILJS_SERVICE_ID');
  if (!process.env.EMAILJS_RESET_TEMPLATE_ID) missing.push('EMAILJS_RESET_TEMPLATE_ID');
  if (!process.env.EMAILJS_PUBLIC_KEY) missing.push('EMAILJS_PUBLIC_KEY');
  if (missing.length) {
    const err = new Error('Email service is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    err.missing = missing;
    throw err;
  }
}

export async function sendRegistrationOtpEmail({ toEmail, otpCode }) {
  assertEmailJsEnv();
  const to = String(toEmail || '').trim().toLowerCase();
  const code = String(otpCode || '').trim();
  if (!to) {
    const err = new Error('Recipient email is required');
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }
  if (!/^\d{6}$/.test(code)) {
    const err = new Error('OTP code is invalid');
    err.code = 'OTP_INVALID';
    throw err;
  }

  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: to,
      otp_code: code,
    },
  };
  if (process.env.EMAILJS_PRIVATE_KEY) payload.accessToken = process.env.EMAILJS_PRIVATE_KEY;

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!res) {
    const err = new Error('Failed to reach email service');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const err = new Error('Failed to send OTP email');
    err.code = 'EMAIL_SEND_FAILED';
    err.status = res.status;
    err.details = raw ? raw.slice(0, 500) : '';
    throw err;
  }
}

export async function sendPasswordResetEmail({ toEmail, resetUrl }) {
  assertEmailJsResetEnv();
  const to = String(toEmail || '').trim().toLowerCase();
  const url = String(resetUrl || '').trim();
  if (!to) {
    const err = new Error('Recipient email is required');
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }
  if (!url) {
    const err = new Error('Reset URL is required');
    err.code = 'RESET_URL_REQUIRED';
    throw err;
  }

  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_RESET_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: to,
      reset_url: url,
    },
  };
  if (process.env.EMAILJS_PRIVATE_KEY) payload.accessToken = process.env.EMAILJS_PRIVATE_KEY;

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!res) {
    const err = new Error('Failed to reach email service');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const err = new Error('Failed to send password reset email');
    err.code = 'EMAIL_SEND_FAILED';
    err.status = res.status;
    err.details = raw ? raw.slice(0, 500) : '';
    throw err;
  }
}

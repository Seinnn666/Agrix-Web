function redactDiagnosticText(value) {
  return String(value ?? '')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/gi, '[REDACTED_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/((?:password|token|api[_ -]?key)\s*[:=]\s*)[^\s,;)}]+/gi, '$1[REDACTED]');
}

export function getDatabaseErrorInfo(error) {
  const original = error?.details && typeof error.details === 'object' ? error.details : error;
  return {
    message: redactDiagnosticText(original?.message || error?.message || 'Unknown database error'),
    code: redactDiagnosticText(original?.code || error?.code || ''),
    hint: redactDiagnosticText(original?.hint || error?.hint || ''),
    details: redactDiagnosticText(original?.details || ''),
  };
}

export function isDatabaseUnavailableError(error) {
  const info = getDatabaseErrorInfo(error);
  return Boolean(info.code) || /supabase|fetch failed|network|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|missing SUPABASE_/i.test(
    `${info.message} ${info.details}`,
  );
}

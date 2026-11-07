import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { emailNotVerifiedBody, findVerificationUser, hasOtpIdentifier, invalidOtpBody, isEmailOtpValid, requiresEmailVerification } from '../src/lib/authPolicy.js';
import { requireAuth } from '../src/middleware/auth.js';
import { hashCode } from '../src/lib/otp.js';

test('pending users require email verification while verified users and admins do not', () => {
  assert.equal(requiresEmailVerification({ emailVerified: false, isAdmin: false }), true);
  assert.equal(requiresEmailVerification({ emailVerified: true, isAdmin: false }), false);
  assert.equal(requiresEmailVerification({ emailVerified: false, isAdmin: true }), false);
});

test('unverified login response contains only the email needed by the OTP page and no session', () => {
  const body = emailNotVerifiedBody('Pending.User@example.test');
  assert.deepEqual(body, { error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED', email: 'pending.user@example.test' });
  assert.equal('token' in body, false);
  assert.equal('user' in body, false);
  assert.equal('userId' in body, false);
});

test('OTP lookup by email normalizes the address and accepts the matching code', async () => {
  const code = '123456';
  const user = { _id: 'test-user', 'emailVerification.codeHash': hashCode(code) };
  let queriedEmail = '';
  const supabase = { from: () => ({
    select: () => ({ ilike: (_column, value) => {
      queriedEmail = value;
      return { maybeSingle: async () => ({ data: user, error: null }) };
    } }),
  }) };
  const result = await findVerificationUser(supabase, '', ' Pending.User@Example.Test ');
  assert.equal(queriedEmail, 'pending.user@example.test');
  assert.equal(result.data, user);
  assert.equal(isEmailOtpValid(result.data, code), true);
});

test('wrong OTP is rejected and missing identifiers receive the generic response', () => {
  assert.equal(isEmailOtpValid({ 'emailVerification.codeHash': 'not-the-code-hash' }, '123456'), false);
  assert.equal(hasOtpIdentifier('', ''), false);
  assert.equal(hasOtpIdentifier('', ' Not-An-Email '), false);
  assert.deepEqual(invalidOtpBody(), { error: 'Invalid or expired code', code: 'OTP_INVALID' });
});

test('middleware rejects a valid legacy token when its account is pending verification', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret';
  const req = { headers: { authorization: `Bearer ${jwt.sign({ sub: 'test-user' }, process.env.JWT_SECRET)}` } };
  const result = { status: 200, body: null, continued: false };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  const getAdmin = () => ({ from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { _id: 'test-user', emailVerified: false, isAdmin: false },
    }) }) }),
  }) });
  try {
    await requireAuth(req, res, () => { result.continued = true; }, getAdmin);
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, emailNotVerifiedBody());
    assert.equal(result.continued, false);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

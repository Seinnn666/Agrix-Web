import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { emailNotVerifiedBody, requiresEmailVerification } from '../src/lib/authPolicy.js';
import { requireAuth } from '../src/middleware/auth.js';

test('pending users require email verification while verified users and admins do not', () => {
  assert.equal(requiresEmailVerification({ emailVerified: false, isAdmin: false }), true);
  assert.equal(requiresEmailVerification({ emailVerified: true, isAdmin: false }), false);
  assert.equal(requiresEmailVerification({ emailVerified: false, isAdmin: true }), false);
});

test('unverified login response is machine-readable and contains no session or user details', () => {
  const body = emailNotVerifiedBody();
  assert.deepEqual(body, { error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
  assert.equal('token' in body, false);
  assert.equal('user' in body, false);
  assert.equal('email' in body, false);
  assert.equal('userId' in body, false);
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

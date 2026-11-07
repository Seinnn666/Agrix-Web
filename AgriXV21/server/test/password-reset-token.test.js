import test from 'node:test';
import assert from 'node:assert/strict';
import { hashCode, isResetTokenValid } from '../src/lib/otp.js';
import { isValidName, validateDateOfBirth, validateName, validateRegistrationPhone } from '../src/lib/validation.js';

const token = 'test-reset-token';
const now = Date.UTC(2026, 10, 7);

test('accepts a matching, unused token before its expiry', () => {
  assert.equal(isResetTokenValid(token, hashCode(token), new Date(now + 60_000).toISOString(), now), true);
});

test('rejects expired, already-used, and mismatched tokens', () => {
  assert.equal(isResetTokenValid(token, hashCode(token), new Date(now).toISOString(), now), false);
  assert.equal(isResetTokenValid(token, '', new Date(now + 60_000).toISOString(), now), false);
  assert.equal(isResetTokenValid('other-token', hashCode(token), new Date(now + 60_000).toISOString(), now), false);
});

test('server validators enforce shared Cycle 1 field rules', () => {
  assert.equal(isValidName('x'.repeat(35)), true);
  assert.equal(isValidName('José'), true);
  assert.equal(isValidName('Alex1'), false);
  assert.equal(validateName('x'.repeat(36), 'First name'), 'First name must be 35 characters or less');
  assert.equal(validateName('Q', 'Last name'), 'Last name must be at least 2 characters');
  assert.equal(validateDateOfBirth('2026-11-08', new Date(2026, 10, 7)), 'Date of birth cannot be in the future');
  assert.equal(validateDateOfBirth('2000-01-01', new Date(2026, 10, 7)), null);
  assert.equal(validateRegistrationPhone('0976220225'), 'Phone number must be 11 digits (you entered 10)');
  assert.equal(validateRegistrationPhone('09762202225'), null);
  assert.equal(validateRegistrationPhone('+63976220225'), 'Phone number must be 11 digits (you entered 10)');
  assert.equal(validateRegistrationPhone('+639762202225'), null);
});

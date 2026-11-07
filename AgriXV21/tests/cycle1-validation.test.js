import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDateOfBirth, validateName, validatePhoneE164, validateSignUpForm } from '../src/lib/validation.js';

test('names accept 35 characters and reject 36 with the field-specific message', () => {
  assert.equal(validateName('x'.repeat(35), 'First name').ok, true);
  assert.equal(validateName('José', 'First name').ok, true);
  assert.equal(validateName('Alex1', 'First name').ok, false);
  assert.deepEqual(validateName('x'.repeat(36), 'First name'), {
    ok: false,
    value: 'x'.repeat(36),
    message: 'First name must be 35 characters or less',
  });
  assert.equal(validateName('x', 'Last name').message, 'Last name must be at least 2 characters');
});

test('future date of birth is rejected before age validation and today stays a calendar date', () => {
  const now = new Date(2026, 10, 7, 23, 45);
  assert.equal(validateDateOfBirth('2026-11-08', now).message, 'Date of birth cannot be in the future');
  assert.equal(validateDateOfBirth('2000-01-01', now).ok, true);
  assert.equal(validateDateOfBirth('2008-11-08', now).message, 'You must be at least 18 years old');
});

test('+63 requires exactly 11 digits; blank and +1 retain their own validation', () => {
  const short = validatePhoneE164('+6397622022', { required: true, countryCode: '+63', phoneNumber: '0976220225' });
  assert.equal(short.ok, false);
  assert.equal(short.message, 'Phone number must be 11 digits (you entered 10)');
  assert.equal(validatePhoneE164('+63876220225', { required: true, countryCode: '+63', phoneNumber: '08762202225' }).message, 'For Philippines, enter an 11-digit mobile number starting with 09');
  assert.equal(validatePhoneE164('+63976220225', { required: true, countryCode: '+63', phoneNumber: '09762202225' }).ok, true);
  assert.equal(validatePhoneE164('+63', { required: true, countryCode: '+63', phoneNumber: '' }).message, 'Phone number is required');
  assert.equal(validatePhoneE164('+15551234567', { required: true, countryCode: '+1', phoneNumber: '5551234567' }).ok, true);
});

test('registration reports the one-character last name rule', () => {
  const result = validateSignUpForm({ firstName: 'Alex', lastName: 'Q' });
  assert.equal(result.fieldErrors.lastName, 'Last name must be at least 2 characters');
});

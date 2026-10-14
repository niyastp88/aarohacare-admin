import { describe, expect, it } from 'vitest';
import { formatDate, isValidPhone, normalizePhone, toLocalPhone, toTitleCase } from './formatters';

describe('normalizePhone', () => {
  it('strips every non-digit character', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('919876543210');
  });
});

describe('toLocalPhone', () => {
  it('drops a leading country code and keeps 10 digits', () => {
    expect(toLocalPhone('+91 98765-43210')).toBe('9876543210');
    expect(toLocalPhone('919876543210')).toBe('9876543210');
    expect(toLocalPhone('9876543210')).toBe('9876543210');
  });
});

describe('isValidPhone', () => {
  it('accepts 10 or more digits', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+91 98765 43210')).toBe(true);
  });

  it('rejects short numbers', () => {
    expect(isValidPhone('12345')).toBe(false);
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-07-25')).toBe('25 Jul 2026');
  });
});

describe('toTitleCase', () => {
  it('capitalises each word', () => {
    expect(toTitleCase('JOHN doe')).toBe('John Doe');
  });
});

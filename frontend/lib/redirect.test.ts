import { describe, it, expect } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it('allows a same-origin path', () => {
    expect(safeNextPath('/app')).toBe('/app');
    expect(safeNextPath('/invite#abc.def')).toBe('/invite#abc.def');
  });

  it('falls back when there is no target', () => {
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath(undefined)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
  });

  // These are the open-redirect vectors: our own login page bouncing a user onto a
  // convincing fake of itself on somebody else's domain.
  it('refuses an absolute URL', () => {
    expect(safeNextPath('https://evil.example/login')).toBe('/app');
    expect(safeNextPath('http://evil.example')).toBe('/app');
  });

  it('refuses a protocol-relative URL', () => {
    // A browser reads "//host" as "https://host" — so a leading slash is not enough.
    expect(safeNextPath('//evil.example/login')).toBe('/app');
  });

  it('refuses backslashes, which some browsers normalise to slashes', () => {
    expect(safeNextPath('/\\evil.example')).toBe('/app');
    expect(safeNextPath('\\\\evil.example')).toBe('/app');
  });

  it('refuses a javascript: url', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/app');
  });
});

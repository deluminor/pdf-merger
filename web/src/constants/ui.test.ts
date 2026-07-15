import { describe, expect, it } from 'vitest';
import { formatSize } from './ui';

describe('formatSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '2 KB'],
    [1024 * 1024, '1.0 MB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });
});

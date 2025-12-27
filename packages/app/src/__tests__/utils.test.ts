import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, formatDateTime, truncateUrl } from '../utils';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('returns dash for null', () => {
    expect(formatBytes(null)).toBe('-');
  });
});

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(3665000)).toBe('1h 1m');
  });
});

describe('formatDateTime', () => {
  it('formats timestamp to locale string', () => {
    const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
    const result = formatDateTime(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('truncateUrl', () => {
  it('returns original url if shorter than max length', () => {
    expect(truncateUrl('https://example.com')).toBe('https://example.com');
  });

  it('truncates long urls', () => {
    const longUrl = 'https://example.com/very/long/path/that/exceeds/the/maximum/length/allowed';
    const result = truncateUrl(longUrl, 30);
    expect(result.length).toBe(30);
    expect(result.endsWith('...')).toBe(true);
  });
});

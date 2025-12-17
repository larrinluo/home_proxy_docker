import { describe, test, expect } from 'vitest';

describe('Utils Tests', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle string operations', () => {
    const str = 'hello';
    expect(str.toUpperCase()).toBe('HELLO');
  });
});







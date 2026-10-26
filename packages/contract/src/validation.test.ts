import { DEVICE_TYPE_CONTROL, DEVICE_TYPE_NOUN, HomeApiError } from './types';
import { isDeviceType, validateDeviceName, validateEmail, validateLevel, validatePassword } from './validation';

function expectCode(run: () => unknown, code: string): void {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(HomeApiError);
    expect((error as HomeApiError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe('validation', () => {
  it.each(['a@b', 'bad', ' a@b.co', 'a@b.co ', 'a@@b.co'])('rejects email %s', (email) => {
    expectCode(() => validateEmail(email), 'validation');
  });
  it('accepts a valid email', () => { validateEmail('a@b.co'); });
  it('requires at least six password characters', () => {
    expectCode(() => validatePassword('12345'), 'auth/weak-password');
    validatePassword('123456');
  });
  it('trims names and enforces the boundaries', () => {
    expect(validateDeviceName('  Desk Lamp  ')).toBe('Desk Lamp');
    expect(validateDeviceName('a'.repeat(40))).toHaveLength(40);
    for (const name of ['', '   ', 'a'.repeat(41)]) expectCode(() => validateDeviceName(name), 'validation');
  });
  it.each([-1, 101, 50.5, NaN, Infinity])('rejects level %s', (level) => {
    expectCode(() => validateLevel(level), 'validation');
  });
  it.each([0, 50, 100])('accepts level %s', (level) => { validateLevel(level); });
  it('recognizes exactly the six mapped device types', () => {
    expect(Object.keys(DEVICE_TYPE_CONTROL)).toEqual(['light', 'plug', 'dimmer', 'fan', 'blinds', 'speaker']);
    for (const type of Object.keys(DEVICE_TYPE_CONTROL)) {
      expect(isDeviceType(type)).toBe(true);
      if (isDeviceType(type)) expect(typeof DEVICE_TYPE_NOUN[type]).toBe('string');
    }
    for (const value of ['unknown', 'toString', '__proto__', null, 0, {}]) expect(isDeviceType(value)).toBe(false);
  });
});

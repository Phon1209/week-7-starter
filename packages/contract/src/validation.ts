import { HomeApiError, DEVICE_TYPE_CONTROL, type DeviceType } from './types';

export function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HomeApiError('validation', 'Enter a valid email.');
  }
}

export function validatePassword(password: string): void {
  if (password.length < 6) throw new HomeApiError('auth/weak-password');
}

export function validateDeviceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new HomeApiError('validation', 'Name must be 1–40 characters.');
  }
  return trimmed;
}

export function validateLevel(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new HomeApiError('validation', 'Level must be an integer from 0 to 100.');
  }
}

export function isDeviceType(x: unknown): x is DeviceType {
  return typeof x === 'string' && Object.hasOwn(DEVICE_TYPE_CONTROL, x);
}

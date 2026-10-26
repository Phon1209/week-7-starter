import { DEVICE_TYPE_NOUN, type Device, type ActivityEvent, type User } from './types';

export function headline(device: Device): string {
  const state = device.control === 'switch' ? (device.on ? 'on' : 'off') : `${device.level}%`;
  return `${DEVICE_TYPE_NOUN[device.type]} ${state}`;
}

export function tileStateLine(device: Device): string {
  return device.control === 'switch' ? headline(device) : `${DEVICE_TYPE_NOUN[device.type]} · ${device.level}%`;
}

export function lastActionLine(event: ActivityEvent, me: User | null): string {
  const actor = event.actor.uid === me?.uid ? 'You' : event.actor.email;
  const actions = {
    added: 'added it', turned_on: 'turned it on', turned_off: 'turned it off',
    set_level: `set it to ${event.level}%`, removed: 'removed it',
  };
  return `${actor} ${actions[event.action]}`;
}

export function badge(event: ActivityEvent): { kind: 'on' | 'off' | 'level' | 'added' | 'removed'; text: string } {
  switch (event.action) {
    case 'turned_on': return { kind: 'on', text: 'ON' };
    case 'turned_off': return { kind: 'off', text: 'OFF' };
    case 'set_level': return { kind: 'level', text: `${event.level}%` };
    case 'added': return { kind: 'added', text: 'Added' };
    case 'removed': return { kind: 'removed', text: 'Removed' };
  }
}

export function avatarLetter(email: string): string { return email.charAt(0).toUpperCase(); }

export function avatarColorIndex(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (Math.imul(hash, 31) + uid.charCodeAt(i)) | 0;
  return ((hash % 6) + 6) % 6;
}

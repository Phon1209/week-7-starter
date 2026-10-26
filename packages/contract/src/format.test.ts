import { avatarColorIndex, avatarLetter, badge, headline, lastActionLine, tileStateLine } from './format';
import { DEVICE_TYPE_CONTROL, DEVICE_TYPE_NOUN, type ActivityEvent, type Device, type DeviceType } from './types';

const actor = { uid: 'maya', email: 'maya@x.com' };
const base = { id: 'device', name: 'Room', createdAt: 1, createdBy: actor.uid, updatedAt: 2, lastChangedBy: actor, flipCount: 0 };
const event: ActivityEvent = { id: 'event', deviceId: 'device', deviceName: 'Room', actor, action: 'turned_on', at: 2 };

it('formats every device type and both switch states', () => {
  for (const type of Object.keys(DEVICE_TYPE_CONTROL) as DeviceType[]) {
    const noun = DEVICE_TYPE_NOUN[type];
    if (DEVICE_TYPE_CONTROL[type] === 'switch') {
      for (const on of [false, true]) {
        const device: Device = { ...base, type, control: 'switch', on };
        expect(headline(device)).toBe(`${noun} ${on ? 'on' : 'off'}`);
        expect(tileStateLine(device)).toBe(headline(device));
      }
    } else {
      const device: Device = { ...base, type, control: 'slider', level: 60 };
      expect(headline(device)).toBe(`${noun} 60%`);
      expect(tileStateLine(device)).toBe(`${noun} · 60%`);
    }
  }
});

it('uses email or You for last actions', () => {
  expect(lastActionLine(event, null)).toBe('maya@x.com turned it on');
  expect(lastActionLine(event, actor)).toBe('You turned it on');
  expect(lastActionLine({ ...event, action: 'turned_off' }, actor)).toBe('You turned it off');
  expect(lastActionLine({ ...event, action: 'set_level', level: 60 }, null)).toBe('maya@x.com set it to 60%');
  expect(lastActionLine({ ...event, action: 'added' }, actor)).toBe('You added it');
  expect(lastActionLine({ ...event, action: 'removed' }, actor)).toBe('You removed it');
});

it('formats all activity badges', () => {
  expect(badge(event)).toEqual({ kind: 'on', text: 'ON' });
  expect(badge({ ...event, action: 'turned_off' })).toEqual({ kind: 'off', text: 'OFF' });
  expect(badge({ ...event, action: 'set_level', level: 60 })).toEqual({ kind: 'level', text: '60%' });
  expect(badge({ ...event, action: 'added' })).toEqual({ kind: 'added', text: 'Added' });
  expect(badge({ ...event, action: 'removed' })).toEqual({ kind: 'removed', text: 'Removed' });
});

it('derives the avatar letter and stable palette index', () => {
  expect(avatarLetter('jas@x.com')).toBe('J');
  expect(avatarLetter('')).toBe('');
  for (const uid of ['', 'maya', 'sam', 'jas', '💡', 'x'.repeat(500)]) {
    const index = avatarColorIndex(uid);
    expect(index).toBe(avatarColorIndex(uid));
    expect(Number.isInteger(index) && index >= 0 && index <= 5).toBe(true);
  }
});

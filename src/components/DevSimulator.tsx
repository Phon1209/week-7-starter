import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeApiError, type Device, type DeviceType, type HomeApi } from '@funswitch/contract';

import { colors, fonts, radius } from '@/theme/tokens';

const SAM = { email: 'sam@demo.test', password: 'password123' };
const SAMPLES: { name: string; type: DeviceType }[] = [
  { name: 'Desk Lamp', type: 'light' },
  { name: 'Kitchen Plug', type: 'plug' },
  { name: 'Ceiling Fan', type: 'fan' },
  { name: 'Bedroom Blinds', type: 'blinds' },
  { name: 'Living Room Dimmer', type: 'dimmer' },
  { name: 'Speaker', type: 'speaker' },
];

function randomSample() {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

interface SimAction {
  key: 'flip' | 'level' | 'presence' | 'add' | 'delete';
  label: string;
  enabled: boolean;
}

async function ensureSam(api: HomeApi): Promise<void> {
  if (api.auth.currentUser()) return;
  try {
    await api.auth.signIn(SAM.email, SAM.password);
  } catch (e) {
    if (e instanceof HomeApiError && e.code === 'auth/invalid-credentials') await api.auth.signUp(SAM.email, SAM.password);
    else throw e;
  }
}

/**
 * Mock mode only: a second client on the same store, signed in as Sam, so one
 * phone can demonstrate real-time multi-user behavior without a backend.
 */
export function DevSimulator({ simulator }: { simulator: HomeApi }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const deviceId = pathname.startsWith('/devices/') && id && id !== 'new' ? id : null;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [watched, setWatched] = useState<{ id: string; device: Device | null } | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const leaveRef = useRef<(() => Promise<void>) | null>(null);
  const device = watched && watched.id === deviceId ? watched.device : null;

  useEffect(() => {
    if (!deviceId) return;
    return simulator.devices.subscribeOne(deviceId, (d) => setWatched({ id: deviceId, device: d }));
  }, [simulator, deviceId]);

  const samHere = joinedId !== null && joinedId === deviceId;

  async function leave() {
    const fn = leaveRef.current;
    leaveRef.current = null;
    setJoinedId(null);
    await fn?.();
  }

  async function perform(action: SimAction['key']) {
    switch (action) {
      case 'flip':
        if (device?.control === 'switch') await simulator.devices.setOn(device.id, !device.on);
        return;
      case 'level':
        return simulator.devices.setLevel(deviceId!, 60);
      case 'presence':
        if (samHere) return leave();
        await leave();
        leaveRef.current = await simulator.presence.join(deviceId!);
        setJoinedId(deviceId);
        return;
      case 'add': {
        await simulator.devices.add(randomSample());
        return;
      }
      case 'delete':
        if (samHere) await leave();
        return simulator.devices.remove(deviceId!);
    }
  }

  async function act({ key, label }: SimAction) {
    setBusy(true);
    setMessage(null);
    try {
      await ensureSam(simulator);
      await perform(key);
      setMessage(`✓ ${label}`);
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const buttons: SimAction[] = [
    { key: 'flip', label: 'Sam flips this', enabled: device?.control === 'switch' },
    { key: 'level', label: 'Sam sets level 60', enabled: device?.control === 'slider' },
    { key: 'presence', label: samHere ? 'Sam leaves' : 'Sam joins', enabled: !!deviceId },
    { key: 'add', label: 'Sam adds a device', enabled: true },
    { key: 'delete', label: 'Sam deletes this', enabled: !!device },
  ];

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingBottom: insets.bottom + 16, paddingRight: insets.right + 16 }]}>
      <View pointerEvents="box-none" style={styles.anchor}>
        {open && (
          <View style={styles.panel} testID="dev-simulator">
            <Text style={styles.title}>Dev Simulator · acting as {SAM.email}</Text>
            {buttons.map((b) => (
              <Pressable
                key={b.key}
                testID={`sim-${b.key}`}
                accessibilityRole="button"
                disabled={!b.enabled || busy}
                onPress={() => act(b)}
                style={[styles.action, (!b.enabled || busy) && styles.disabled]}
              >
                <Text style={styles.actionText}>{b.label}</Text>
              </Pressable>
            ))}
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
        )}
        <Pressable
          testID="dev-sim-toggle"
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close dev simulator' : 'Open dev simulator'}
          onPress={() => setOpen((o) => !o)}
          style={styles.fab}
        >
          <Text style={styles.fabText}>{open ? '×' : '🐞'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', gap: 12 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { fontSize: 24, color: colors.white },
  panel: {
    width: 260,
    padding: 14,
    gap: 8,
    borderRadius: radius.panel,
    backgroundColor: colors.ink,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 12, marginBottom: 4 },
  action: { backgroundColor: '#2E335A', borderRadius: radius.tile, paddingVertical: 10, paddingHorizontal: 12 },
  actionText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  message: { color: colors.chip, fontFamily: fonts.medium, fontSize: 12 },
});

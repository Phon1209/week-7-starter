import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { DEVICE_TYPE_NOUN, headline, type ActivityEvent, type Device, type SyncMeta, type User } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';
import { confirmDestructive } from '@/components/confirm';
import { FormError } from '@/components/AuthCard';
import { Panel } from '@/components/Panel';
import type { TimedSave } from '@/hooks/useTimedSave';
import { colors, fonts, headlineSize } from '@/theme/tokens';

import { Bulb } from './Bulb';
import { LastAction, SyncPill, type SyncStatus } from './StatusLines';
import { WallSlider } from './WallSlider';
import { WallSwitch } from './WallSwitch';

interface Props {
  device: Device;
  meta: SyncMeta;
  offline: boolean;
  lastEvent: ActivityEvent | undefined;
  me: User | null;
  save: TimedSave;
  onDeleting: () => void;
}

/**
 * An optimistic value is shown until the device snapshot moves past the
 * version it was based on (the save landed, or someone else changed it).
 */
interface Optimistic<T> {
  value: T;
  basedOn: number;
}

export function DeviceMain({ device, meta, offline, lastEvent, me, save, onDeleting }: Props) {
  const api = useApi();
  const { width } = useWindowDimensions();
  const [optimisticOn, setOptimisticOn] = useState<Optimistic<boolean> | null>(null);
  const [optimisticLevel, setOptimisticLevel] = useState<Optimistic<number> | null>(null);
  const [dragLevel, setDragLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fresh = <T,>(o: Optimistic<T> | null) => (o && o.basedOn === device.updatedAt ? o : null);
  const on = device.control === 'switch' ? (fresh(optimisticOn)?.value ?? device.on) : false;
  // While dragging, remote values are ignored and the headline previews the drag.
  const level = device.control === 'slider' ? (dragLevel ?? fresh(optimisticLevel)?.value ?? device.level) : 0;
  const shown: Device = device.control === 'switch' ? { ...device, on } : { ...device, level };
  const glow = device.control === 'switch' ? (on ? 1 : 0) : level / 100;

  const toggle = () => {
    const next = !on;
    setError(null);
    setOptimisticOn({ value: next, basedOn: device.updatedAt });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    save.run(() => api.devices.setOn(device.id, next)).catch(() => {
      setOptimisticOn(null);
      setError("Couldn't save. The switch was reverted.");
    });
  };

  const commitLevel = (value: number) => {
    setDragLevel(null);
    setError(null);
    setOptimisticLevel({ value, basedOn: device.updatedAt });
    save.run(() => api.devices.setLevel(device.id, value)).catch(() => {
      setOptimisticLevel(null);
      setError("Couldn't save. The level was reverted.");
    });
  };

  const remove = () =>
    confirmDestructive('Delete switch?', `"${device.name}" will be removed for everyone.`, 'Delete', async () => {
      onDeleting();
      try {
        await api.devices.remove(device.id);
        router.replace('/');
      } catch {
        setError("Couldn't delete the switch.");
      }
    });

  const status: SyncStatus = offline ? 'offline' : meta.pendingWrites ? 'saving' : 'live';

  return (
    <Panel style={styles.panel} testID="device-main">
      <Bulb glow={glow} />
      <Text style={[styles.headline, { fontSize: headlineSize(width) }]} testID="device-headline" accessibilityRole="header">
        {headline(shown)}
      </Text>
      {device.control === 'switch' ? (
        <WallSwitch on={on} onToggle={toggle} />
      ) : (
        <WallSlider value={level} noun={DEVICE_TYPE_NOUN[device.type]} onChange={setDragLevel} onCommit={commitLevel} />
      )}
      <FormError message={error} />
      <LastAction event={lastEvent} me={me} />
      <SyncPill status={status} />
      <Pressable testID="delete-switch" accessibilityRole="button" onPress={remove} hitSlop={8} style={styles.delete}>
        <Text style={styles.deleteText}>Delete switch</Text>
      </Pressable>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 20, alignItems: 'stretch', paddingVertical: 28 },
  headline: { color: colors.ink, fontFamily: fonts.extrabold, textAlign: 'center', letterSpacing: -1 },
  delete: { alignSelf: 'center', paddingVertical: 4 },
  deleteText: { color: colors.inkMuted, fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: 'underline' },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DEVICE_TYPE_CONTROL, DEVICE_TYPE_NOUN, HomeApiError, validateDeviceName, type DeviceType } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';
import { AuthCard, Field, FormError } from '@/components/AuthCard';
import { Button } from '@/components/Buttons';
import { colors, fonts, radius } from '@/theme/tokens';

const TYPES: { type: DeviceType; icon: string; label: string }[] = [
  { type: 'light', icon: '💡', label: 'Light' },
  { type: 'plug', icon: '🔌', label: 'Plug' },
  { type: 'dimmer', icon: '🎚️', label: 'Dimmer' },
  { type: 'fan', icon: '🌀', label: 'Fan' },
  { type: 'blinds', icon: '🪟', label: 'Blinds' },
  { type: 'speaker', icon: '🔊', label: 'Speaker' },
];

export default function AddSwitchScreen() {
  const api = useApi();
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('light');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    let trimmed: string;
    try {
      trimmed = validateDeviceName(name);
    } catch (e) {
      setError(e instanceof HomeApiError ? e.message : 'Enter a name.');
      return;
    }
    setPending(true);
    try {
      const id = await api.devices.add({ name: trimmed, type });
      router.replace(`/devices/${id}`);
    } catch (e) {
      setError(e instanceof HomeApiError ? e.message : 'Could not create the switch.');
      setPending(false);
    }
  };

  return (
    <AuthCard showLogo={false}>
      <Text style={styles.title}>Add Switch</Text>
      <Field label="Name" testID="device-name" value={name} onChangeText={setName} placeholder="e.g. Flip Room" maxLength={40} autoFocus onSubmitEditing={submit} />
      <View style={styles.types} accessibilityRole="radiogroup">
        {TYPES.map((option) => {
          const selected = option.type === type;
          return (
            <Pressable
              key={option.type}
              testID={`type-${option.type}`}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => setType(option.type)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={styles.icon}>{option.icon}</Text>
              <Text style={styles.chipLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper} testID="type-helper">
        {DEVICE_TYPE_NOUN[type]}: {DEVICE_TYPE_CONTROL[type] === 'switch' ? 'On/off switch' : '0–100 slider'}
      </Text>
      <FormError message={error} />
      <View style={styles.actions}>
        <Button testID="add-cancel" label="Cancel" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.action} />
        <Button testID="add-create" label="Create" onPress={submit} pending={pending} style={styles.action} />
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 28 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    width: '31%',
    flexGrow: 1,
    aspectRatio: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.tile,
    backgroundColor: colors.chip,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#FFF4D1', borderColor: colors.accent },
  icon: { fontSize: 28 },
  chipLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  helper: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { tileStateLine, type Device } from '@funswitch/contract';

import { colors, fonts, radius } from '@/theme/tokens';

export function isActive(device: Device): boolean {
  return device.control === 'switch' ? device.on : device.level > 0;
}

export function SwitchIcon({ active, size = 36 }: { active: boolean; size?: number }) {
  const fill = active ? colors.accent : colors.switchOff;
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 32 40" testID={active ? 'switch-icon-on' : 'switch-icon-off'}>
      <Rect x="1" y="1" width="30" height="38" rx="6" fill={colors.card} stroke={fill} strokeWidth="2" />
      <Rect x="9" y={active ? 7 : 19} width="14" height="14" rx="4" fill={fill} />
      <Circle cx="16" cy="4" r="1" fill={colors.inkMuted} />
      <Circle cx="16" cy="36" r="1" fill={colors.inkMuted} />
    </Svg>
  );
}

export function DeviceTile({ device, size, onPress }: { device: Device; size: number; onPress: () => void }) {
  const state = tileStateLine(device);
  return (
    <Pressable
      testID={`device-tile-${device.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${device.name}, ${state}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}
    >
      <SwitchIcon active={isActive(device)} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {device.name}
        </Text>
        <Text style={styles.state} numberOfLines={1}>
          {state}
        </Text>
      </View>
    </Pressable>
  );
}

export function SkeletonTile({ size }: { size: number }) {
  return <View testID="skeleton-tile" style={[styles.tile, styles.skeleton, { width: size, height: size }]} />;
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.tile,
    padding: 16,
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { gap: 4 },
  name: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
  state: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 14 },
  skeleton: { backgroundColor: colors.chip, borderColor: colors.chip },
});

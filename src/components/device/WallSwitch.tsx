import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

function Screw() {
  return <View style={styles.screw} />;
}

/** Wall-plate rocker. The whole plate is the press target. */
export function WallSwitch({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable
      testID="wall-switch"
      accessibilityRole="switch"
      accessibilityLabel="Power"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [styles.plate, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <Screw />
      <View style={styles.rocker}>
        <View style={[styles.half, on ? styles.onHalf : styles.idleTop]}>{on && <Text style={styles.onText}>ON</Text>}</View>
        <View style={[styles.half, on ? styles.idleBottom : styles.offHalf]}>{!on && <Text style={styles.offText}>OFF</Text>}</View>
      </View>
      <Screw />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: 150,
    height: 190,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  screw: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.switchOff },
  rocker: {
    width: 72,
    height: 118,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onHalf: { backgroundColor: colors.accent },
  offHalf: { backgroundColor: colors.ink },
  idleTop: { backgroundColor: colors.card },
  idleBottom: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  onText: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: 1 },
  offText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: 1 },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Logo } from './Logo';
import { UserPill } from './UserPill';

/** Shared header. Pass `onBack` for back mode (device screens), where `title` is the device name. */
export function Header({ title, onBack }: { title?: string; onBack?: () => void }) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {onBack && (
          <Pressable testID="header-back" accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={styles.back}>
            <Text style={styles.arrow}>←</Text>
          </Pressable>
        )}
        <Logo title={title ?? 'funSwitch'} />
      </View>
      <UserPill />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  back: { paddingRight: 4 },
  arrow: { fontSize: 24, color: colors.ink, fontFamily: fonts.bold },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

export function Dot({ size = 12 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }} />;
}

export function Logo({ title = 'funSwitch', size = 20 }: { title?: string; size?: number }) {
  return (
    <View style={styles.row}>
      <Dot size={size * 0.6} />
      <Text style={[styles.text, { fontSize: size }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  text: { color: colors.ink, fontFamily: fonts.extrabold, flexShrink: 1 },
});

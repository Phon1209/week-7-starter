import { StyleSheet, Text, View } from 'react-native';

import { Panel, SectionLabel } from '@/components/Panel';
import { colors, fonts, radius } from '@/theme/tokens';

function Stat({ value, label, testID }: { value: string; label: string; testID: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value} testID={testID} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function DatabaseCheck({ flipCount, lastSaveMs, liveUpdates }: { flipCount: number; lastSaveMs: number | null; liveUpdates: number }) {
  return (
    <Panel testID="database-check">
      <SectionLabel>Database check</SectionLabel>
      <View style={styles.row}>
        <Stat testID="stat-flips" value={String(flipCount)} label="flips logged" />
        <Stat testID="stat-last-save" value={lastSaveMs === null ? '—' : `${lastSaveMs}ms`} label="last save" />
        <Stat testID="stat-live-updates" value={String(liveUpdates)} label="live updates" />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: colors.chip, borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 10, gap: 4 },
  value: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 24 },
  label: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 12 },
});

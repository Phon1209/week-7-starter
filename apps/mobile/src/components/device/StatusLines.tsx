import { StyleSheet, Text, View } from 'react-native';
import { lastActionLine, type ActivityEvent, type User } from '@funswitch/contract';

import { Avatar } from '@/components/Avatar';
import { relativeTime, useNow } from '@/hooks/useNow';
import { colors, fonts, radius } from '@/theme/tokens';

export function LastAction({ event, me }: { event: ActivityEvent | undefined; me: User | null }) {
  const now = useNow(30_000);
  if (!event) return <Text style={styles.muted}>No changes yet.</Text>;
  return (
    <View style={styles.row} testID="last-action">
      <Avatar uid={event.actor.uid} email={event.actor.email} />
      <Text style={styles.line} numberOfLines={2}>
        {`${lastActionLine(event, me)} · ${relativeTime(event.at, now)}`}
      </Text>
    </View>
  );
}

export type SyncStatus = 'live' | 'saving' | 'offline';

const SYNC = {
  live: { label: 'Live · in sync', color: colors.live },
  saving: { label: 'Saving…', color: colors.saving },
  offline: { label: 'Offline', color: colors.offline },
} as const;

export function SyncPill({ status }: { status: SyncStatus }) {
  const { label, color } = SYNC[status];
  return (
    <View style={styles.pill} testID="sync-pill" accessibilityLabel={label}>
      <Text style={[styles.dot, { color }]}>●</Text>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  line: { color: colors.ink, fontFamily: fonts.medium, fontSize: 15, flexShrink: 1 },
  muted: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
  },
  dot: { fontSize: 12 },
  pillText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 },
});

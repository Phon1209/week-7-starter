import { Fragment, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { badge, type ActivityEvent, type User } from '@funswitch/contract';

import { Avatar } from '@/components/Avatar';
import { DashedDivider } from '@/components/DashedDivider';
import { Panel, SectionLabel } from '@/components/Panel';
import { colors, fonts, radius } from '@/theme/tokens';

const BADGE_STYLE = {
  on: { backgroundColor: colors.accent, color: colors.ink },
  off: { backgroundColor: colors.ink, color: colors.white },
  level: { backgroundColor: colors.chip, color: colors.ink },
  added: { backgroundColor: colors.chip, color: colors.inkMuted },
  removed: { backgroundColor: colors.chip, color: colors.error },
} as const;

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

/** Rendered with .map() (≤ 20 rows) so it can sit inside the screen's ScrollView. */
export function FlipHistory({ events, me }: { events: ActivityEvent[]; me: User | null }) {
  // Rows that existed before the panel opened appear instantly; later ones fade in.
  const [openedAt] = useState(() => Date.now());

  return (
    <Panel testID="flip-history">
      <SectionLabel>Flip history</SectionLabel>
      {events.length === 0 && <Text style={styles.empty}>No flips yet.</Text>}
      {events.map((event, i) => {
        const b = badge(event);
        const { color, backgroundColor } = BADGE_STYLE[b.kind];
        return (
          <Fragment key={event.id}>
            {i > 0 && <DashedDivider />}
            <Animated.View entering={event.at > openedAt ? FadeIn.duration(300) : undefined} style={styles.row} testID="history-row">
              <Avatar uid={event.actor.uid} email={event.actor.email} />
              <Text style={styles.who} numberOfLines={1}>
                {event.actor.uid === me?.uid ? 'You' : event.actor.email}
              </Text>
              <View style={[styles.badge, { backgroundColor }]}>
                <Text style={[styles.badgeText, { color }]}>{b.text}</Text>
              </View>
              <Text style={styles.time}>{formatTime(event.at)}</Text>
            </Animated.View>
          </Fragment>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  who: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, minWidth: 48, alignItems: 'center' },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 0.5 },
  time: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
});

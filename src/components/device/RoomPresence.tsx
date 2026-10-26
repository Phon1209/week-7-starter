import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ActivityEvent, PresenceEntry, User } from '@funswitch/contract';

import { Avatar } from '@/components/Avatar';
import { Panel, SectionLabel } from '@/components/Panel';
import { colors, fonts, radius } from '@/theme/tokens';

const FLIPS = new Set(['turned_on', 'turned_off', 'set_level']);
const HIGHLIGHT_MS = 3000;

/** Outlines a user's chip for 3s after each new flip they make. */
function useRecentFlippers(events: ActivityEvent[], historyLoaded: boolean): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [flippers, setFlippers] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!historyLoaded) return;
    const ids = new Set(events.map((e) => e.id));
    if (seen.current === null) {
      seen.current = ids; // existing history on open is not "new"
      return;
    }
    const fresh = events.filter((e) => !seen.current!.has(e.id) && FLIPS.has(e.action));
    seen.current = ids;
    fresh.forEach(({ actor: { uid } }) => {
      clearTimeout(timers.current.get(uid));
      setFlippers((s) => new Set(s).add(uid));
      timers.current.set(
        uid,
        setTimeout(() => {
          timers.current.delete(uid);
          setFlippers((s) => {
            const next = new Set(s);
            next.delete(uid);
            return next;
          });
        }, HIGHLIGHT_MS),
      );
    });
  }, [events, historyLoaded]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return flippers;
}

interface Props {
  viewers: PresenceEntry[];
  events: ActivityEvent[];
  historyLoaded: boolean;
  me: User | null;
}

export function RoomPresence({ viewers, events, historyLoaded, me }: Props) {
  const flippers = useRecentFlippers(events, historyLoaded);
  const others = viewers.filter((v) => v.uid !== me?.uid).sort((a, b) => a.email.localeCompare(b.email));
  const chips = [...(me ? [{ uid: me.uid, email: me.email, label: 'You' }] : []), ...others.map((v) => ({ uid: v.uid, email: v.email, label: v.email }))];

  return (
    <Panel testID="room-presence">
      <SectionLabel>In the room now</SectionLabel>
      <View style={styles.chips}>
        {chips.map((chip) => (
          <View key={chip.uid} testID={`presence-chip-${chip.uid}`} style={[styles.chip, flippers.has(chip.uid) && styles.highlight]}>
            <Avatar uid={chip.uid} email={chip.email} />
            <Text style={styles.name} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  highlight: { borderColor: colors.accent },
  name: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, flexShrink: 1 },
});

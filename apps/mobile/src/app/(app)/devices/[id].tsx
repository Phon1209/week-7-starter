import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/api/ApiProvider';
import { Button } from '@/components/Buttons';
import { DatabaseCheck } from '@/components/device/DatabaseCheck';
import { DeviceMain } from '@/components/device/DeviceMain';
import { FlipHistory } from '@/components/device/FlipHistory';
import { RoomPresence } from '@/components/device/RoomPresence';
import { Header } from '@/components/Header';
import { Panel } from '@/components/Panel';
import { useDevice } from '@/hooks/useDevice';
import { useDeviceHistory } from '@/hooks/useDeviceHistory';
import { usePresence } from '@/hooks/usePresence';
import { useTimedSave } from '@/hooks/useTimedSave';
import { breakpoints, colors, fonts } from '@/theme/tokens';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function DeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { device, meta, loading, error, liveUpdates } = useDevice(id);
  const history = useDeviceHistory(id, 20);
  const viewers = usePresence(id);
  const save = useTimedSave();
  const [deleting, setDeleting] = useState(false);

  const wide = width >= breakpoints.deviceRow;

  let body: React.ReactNode;
  if (loading) {
    body = <ActivityIndicator style={styles.loading} color={colors.ink} size="large" />;
  } else if (!device) {
    body = deleting ? null : (
      <Panel style={styles.removed} testID="device-removed">
        <Text style={styles.removedText}>{error ? "Couldn't load this switch." : 'This switch was removed'}</Text>
        <Button label="Back to switches" onPress={() => router.replace('/')} />
      </Panel>
    );
  } else {
    body = (
      <View style={[styles.layout, wide && styles.row]}>
        <View style={[styles.column, wide && styles.half]}>
          <DeviceMain
            device={device}
            meta={meta}
            offline={!!error}
            lastEvent={history.events[0]}
            me={user}
            save={save}
            onDeleting={() => setDeleting(true)}
          />
        </View>
        <View style={[styles.column, wide && styles.half]}>
          <RoomPresence viewers={viewers} events={history.events} historyLoaded={!history.loading} me={user} />
          <DatabaseCheck flipCount={device.flipCount} lastSaveMs={save.lastSaveMs} liveUpdates={liveUpdates} />
          <FlipHistory events={history.events} me={user} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header title={device?.name ?? ' '} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </SafeAreaView>
  );
}

const GAP = 16;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 96, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  layout: { gap: GAP },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { gap: GAP },
  half: { flex: 1 },
  loading: { marginTop: 64 },
  removed: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  removedText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' },
});

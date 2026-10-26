import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Buttons';
import { DeviceTile, SkeletonTile } from '@/components/DeviceTile';
import { Header } from '@/components/Header';
import { useDevices } from '@/hooks/useDevices';
import { breakpoints, colors, fonts, radius } from '@/theme/tokens';

const GAP = 16;
const PADDING = 16;
const MAX_WIDTH = 1100;

function columnsFor(width: number): number {
  if (width >= breakpoints.desktop) return 4;
  if (width >= breakpoints.tablet) return 3;
  return 2;
}

export default function HomeScreen() {
  const { data, loading, error, refresh } = useDevices();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  const columns = columnsFor(width);
  const contentWidth = Math.min(width, MAX_WIDTH) - PADDING * 2;
  const tileSize = Math.floor((contentWidth - GAP * (columns - 1)) / columns);

  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), 400);
    return () => clearTimeout(timer);
  }, [refreshing]);

  const addButton = <Button testID="add-switch" label="Add Switch" onPress={() => router.push('/devices/new')} style={styles.add} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header />
      {error && (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{"Couldn't load switches. Pull down to retry."}</Text>
        </View>
      )}
      <FlatList
        // React Native requires a fresh list when numColumns changes.
        key={`grid-${columns}`}
        testID="device-grid"
        data={loading ? [] : data}
        keyExtractor={(device) => device.id}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { width: contentWidth + PADDING * 2 }]}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refresh();
            }}
          />
        }
        ListHeaderComponent={data.length > 0 || loading ? addButton : undefined}
        renderItem={({ item }) => <DeviceTile device={item} size={tileSize} onPress={() => router.push(`/devices/${item.id}`)} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonTile key={i} size={tileSize} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No switches yet. Add one!</Text>
              {addButton}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { alignSelf: 'center', paddingHorizontal: PADDING, paddingBottom: 96, gap: GAP },
  row: { gap: GAP },
  add: { alignSelf: 'center', marginVertical: 8, paddingHorizontal: 32 },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 64 },
  emptyText: { color: colors.inkMuted, fontFamily: fonts.semibold, fontSize: 17 },
  banner: {
    marginHorizontal: PADDING,
    marginBottom: 8,
    padding: 12,
    borderRadius: radius.tile,
    backgroundColor: '#FBE3E3',
  },
  bannerText: { color: colors.error, fontFamily: fonts.semibold },
});

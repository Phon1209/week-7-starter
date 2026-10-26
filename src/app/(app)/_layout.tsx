import { View } from 'react-native';
import { Stack } from 'expo-router';

import { useSimulatorApi } from '@/api/ApiProvider';
import { DevSimulator } from '@/components/DevSimulator';
import { colors } from '@/theme/tokens';

/** Signed-in stack. The root layout guards it; each screen renders its own <Header />. */
export default function AppLayout() {
  const simulator = useSimulatorApi();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      {simulator && <DevSimulator simulator={simulator} />}
    </View>
  );
}

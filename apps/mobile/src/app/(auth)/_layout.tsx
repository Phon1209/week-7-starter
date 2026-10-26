import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

// The (auth) group has no index, so give it a default screen.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

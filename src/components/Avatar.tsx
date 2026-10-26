import { StyleSheet, Text, View } from 'react-native';
import { avatarColorIndex, avatarLetter } from '@funswitch/contract';

import { avatarPalette, colors, fonts } from '@/theme/tokens';

export function Avatar({ uid, email, size = 28 }: { uid: string; email: string; size?: number }) {
  return (
    <View
      testID={`avatar-${uid}`}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarPalette[avatarColorIndex(uid)] }]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.45 }]}>{avatarLetter(email)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.white, fontFamily: fonts.bold },
});

import { useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi, useAuth } from '@/api/ApiProvider';
import { colors, fonts, radius } from '@/theme/tokens';

import { Avatar } from './Avatar';

export function UserPill() {
  const api = useApi();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return null;

  // Signing out flips the route guard, which sends the user back to /login.
  const signOut = () => {
    setMenuOpen(false);
    api.auth.signOut();
  };
  const open = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: user.email, options: ['Cancel', 'Sign out'], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
        (index) => index === 1 && signOut(),
      );
    } else {
      setMenuOpen(true);
    }
  };

  return (
    <>
      <Pressable testID="user-pill" accessibilityRole="button" accessibilityLabel={`Account ${user.email}`} onPress={open} style={styles.pill}>
        <Avatar uid={user.uid} email={user.email} size={24} />
        <Text style={styles.email} numberOfLines={1}>
          {user.email}
        </Text>
      </Pressable>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 56 }]}>
            <Pressable testID="sign-out" accessibilityRole="button" onPress={signOut} style={styles.menuItem}>
              <Text style={styles.menuText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
    flexShrink: 1,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  email: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13, flexShrink: 1 },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.card,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 15 },
});

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeApiError } from '@funswitch/contract';

import { colors, fonts, radius } from '@/theme/tokens';

import { Logo } from './Logo';

/** Centered card on the cream background, used by login, signup and Add Switch. */
export function AuthCard({ children, showLogo = true }: { children: ReactNode; showLogo?: boolean }) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {showLogo && (
              <View style={styles.logo}>
                <Logo size={28} />
              </View>
            )}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.inkMuted} style={styles.input} {...input} />
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text testID="form-error" accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credentials': 'Wrong email or password.',
  'auth/email-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email.',
  validation: 'Enter a valid email.',
};

export function authErrorMessage(e: unknown): string {
  if (e instanceof HomeApiError) return AUTH_MESSAGES[e.code] ?? e.message;
  return 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: 24,
    gap: 16,
  },
  logo: { alignItems: 'center', marginBottom: 8 },
  field: { gap: 6 },
  label: { color: colors.inkMuted, fontFamily: fonts.semibold, fontSize: 13 },
  input: {
    minHeight: 48,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  error: { color: colors.error, fontFamily: fonts.medium, fontSize: 14 },
});

export const authStyles = StyleSheet.create({
  link: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', textDecorationLine: 'underline' },
});

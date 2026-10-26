import { useState } from 'react';
import { Link } from 'expo-router';
import { validateEmail, validatePassword } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';
import { AuthCard, Field, FormError, authErrorMessage, authStyles } from '@/components/AuthCard';
import { Button } from '@/components/Buttons';

export default function SignupScreen() {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    try {
      validateEmail(email.trim());
      validatePassword(password);
    } catch (e) {
      setError(authErrorMessage(e));
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      await api.auth.signUp(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e));
      setPending(false);
    }
  };

  return (
    <AuthCard>
      <Field
        label="Email"
        testID="signup-email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Password"
        testID="signup-password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="new-password"
      />
      <Field
        label="Confirm password"
        testID="signup-confirm"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it again"
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={submit}
      />
      <FormError message={error} />
      <Button testID="signup-submit" label="Create account" onPress={submit} pending={pending} />
      <Link href="/login" replace style={authStyles.link}>
        Have an account? Log in
      </Link>
    </AuthCard>
  );
}

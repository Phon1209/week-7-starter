import { useState } from 'react';
import { Link } from 'expo-router';
import { validateEmail, validatePassword } from '@funswitch/contract';

import { useApi } from '@/api/ApiProvider';
import { AuthCard, Field, FormError, authErrorMessage, authStyles } from '@/components/AuthCard';
import { Button } from '@/components/Buttons';

export default function LoginScreen() {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setPending(true);
    try {
      // On success the root route guard switches to the app stack (Home).
      await api.auth.signIn(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e));
      setPending(false);
    }
  };

  return (
    <AuthCard>
      <Field
        label="Email"
        testID="login-email"
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
        testID="login-password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••"
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      <FormError message={error} />
      <Button testID="login-submit" label="Log in" onPress={submit} pending={pending} />
      <Link href="/signup" replace style={authStyles.link}>
        No account? Sign up
      </Link>
    </AuthCard>
  );
}

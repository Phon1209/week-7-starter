import { Alert, Platform } from 'react-native';

/** Alert.alert does nothing on web, so fall back to the browser's confirm dialog there. */
export function confirmDestructive(title: string, message: string, action: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

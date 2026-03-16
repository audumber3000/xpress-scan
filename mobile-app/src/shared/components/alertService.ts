import type { AlertButton } from './CustomAlertModal';

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

type ShowAlertFn = (options: AlertOptions) => void;

let showAlertFn: ShowAlertFn | null = null;

/**
 * Register the alert handler (called by AlertProvider on mount)
 */
export function registerAlertHandler(handler: ShowAlertFn): void {
  showAlertFn = handler;
}

/**
 * Unregister the alert handler (called by AlertProvider on unmount)
 */
export function unregisterAlertHandler(): void {
  showAlertFn = null;
}

/**
 * Show a custom alert modal. Use this instead of Alert.alert()
 * Can be called from anywhere - components, services, hooks.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void;
export function showAlert(options: AlertOptions): void;
export function showAlert(
  titleOrOptions: string | AlertOptions,
  message?: string,
  buttons?: AlertButton[]
): void {
  const options: AlertOptions =
    typeof titleOrOptions === 'string'
      ? { title: titleOrOptions, message, buttons }
      : titleOrOptions;

  if (showAlertFn) {
    showAlertFn(options);
  } else {
    // Fallback to React Native Alert when provider not mounted (e.g. during tests)
    const { Alert } = require('react-native');
    Alert.alert(options.title, options.message, options.buttons);
  }
}

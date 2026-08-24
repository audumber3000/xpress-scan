import type { AlertButton } from './CustomAlertModal';
import { isPlanBlockedShowing } from '../../services/api/planLock';

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

  // The plan-blocked sheet is already on screen explaining, in the server's own
  // words, why this save was refused. Every screen also catches its own failure
  // and calls this — which stacked a second dialog on top reading "Could not
  // register patient" followed by the raw JSON error body. One explanation.
  if (isPlanBlockedShowing()) return;

  if (showAlertFn) {
    showAlertFn(options);
  } else {
    // Fallback to React Native Alert when provider not mounted (e.g. during tests)
    const { Alert } = require('react-native');
    Alert.alert(options.title, options.message, options.buttons);
  }
}

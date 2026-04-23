export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number; // ms — default 3000
}

type ShowToastFn = (options: ToastOptions) => void;

let _handler: ShowToastFn | null = null;

export function registerToastHandler(fn: ShowToastFn): void {
  _handler = fn;
}

export function unregisterToastHandler(): void {
  _handler = null;
}

function show(options: ToastOptions): void {
  if (_handler) {
    _handler(options);
  }
  // If provider not mounted yet (e.g. during tests), silently ignore
}

// Convenience helpers — use these throughout the app
export const toast = {
  success: (message: string, duration?: number) => show({ message, type: 'success', duration }),
  error:   (message: string, duration?: number) => show({ message, type: 'error',   duration }),
  warning: (message: string, duration?: number) => show({ message, type: 'warning', duration }),
  info:    (message: string, duration?: number) => show({ message, type: 'info',    duration }),
};

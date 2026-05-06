import AsyncStorage from '@react-native-async-storage/async-storage';

let _cachedSymbol: string | null = null;

/**
 * Get the clinic's currency symbol.
 * Reads from the cached user object in AsyncStorage.
 * Falls back to ₹ for existing Indian clinics.
 */
export async function getCurrencySymbolAsync(): Promise<string> {
  if (_cachedSymbol) return _cachedSymbol;
  try {
    const raw = await AsyncStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      const clinic = user.clinic || user.clinics?.[0];
      if (clinic?.currency_symbol) {
        _cachedSymbol = clinic.currency_symbol;
        return _cachedSymbol;
      }
    }
  } catch { /* ignore */ }
  return '₹';
}

/**
 * Synchronous version — uses the last cached value.
 * Call getCurrencySymbolAsync() once on app init to prime the cache.
 */
export function getCurrencySymbol(): string {
  return _cachedSymbol || '₹';
}

/** Call once on login / app boot to prime the cache. */
export function setCurrencySymbol(symbol: string) {
  _cachedSymbol = symbol;
}

/**
 * Format a numeric amount with the clinic's currency symbol.
 */
export function formatCurrency(amount: number | string, symbol?: string): string {
  const s = symbol || getCurrencySymbol();
  const num = Number(amount);
  if (isNaN(num)) return `${s}0`;
  return `${s}${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

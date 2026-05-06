import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@molarplus/lastLogin'

export type LastLoginProvider = 'google' | 'apple' | 'email'

export type LastLogin = {
  provider: LastLoginProvider
  email: string
  name?: string
}

export const saveLastLogin = async (entry: LastLogin): Promise<void> => {
  try {
    if (!entry.email) return
    await AsyncStorage.setItem(KEY, JSON.stringify(entry))
  } catch (err) {
    console.warn('saveLastLogin failed:', err)
  }
}

export const getLastLogin = async (): Promise<LastLogin | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.provider || !parsed?.email) return null
    return parsed as LastLogin
  } catch {
    return null
  }
}

export const clearLastLogin = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/**
 * Mask an email for display: keep the first 3 characters of the local part,
 * replace the rest with an ellipsis, keep the domain. "doctor@gmail.com"
 * -> "doc…@gmail.com". Apple relay addresses come through unchanged in shape.
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email || ''
  const [local, domain] = email.split('@')
  if (local.length <= 3) return `${local}@${domain}`
  return `${local.slice(0, 3)}…@${domain}`
}

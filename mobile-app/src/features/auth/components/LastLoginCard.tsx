import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { GoogleIcon } from '../../../shared/components/icons/GoogleIcon'
import { Mail } from 'lucide-react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'
import { colors } from '../../../shared/constants/colors'
import { getLastLogin, maskEmail, type LastLogin, type LastLoginProvider } from '../../../services/auth/lastLogin'

type Variant = 'login' | 'register'

type Props = {
  variant: Variant
  onContinue: (provider: LastLoginProvider) => void
  isLoading?: boolean
}

const PROVIDER_LABEL: Record<LastLoginProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  email: 'Email',
}

const ProviderIcon: React.FC<{ provider: LastLoginProvider }> = ({ provider }) => {
  if (provider === 'google') return <GoogleIcon size={28} />
  if (provider === 'apple') {
    return (
      <View style={styles.appleIconBg}>
        <Text style={styles.appleIconGlyph}></Text>
      </View>
    )
  }
  return (
    <View style={styles.emailIconBg}>
      <Mail size={18} color="#EF4444" />
    </View>
  )
}

export const LastLoginCard: React.FC<Props> = ({ variant, onContinue, isLoading }) => {
  const [last, setLast] = useState<LastLogin | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    getLastLogin().then((value) => {
      if (!active) return
      // On non-iOS, never offer Apple as the one-tap path.
      if (value?.provider === 'apple' && Platform.OS !== 'ios') {
        setLast(null)
      } else {
        setLast(value)
      }
      setReady(true)
    })
    return () => { active = false }
  }, [])

  if (!ready || !last || dismissed) return null

  const heading = variant === 'register' ? 'Already signed up?' : 'Welcome back'
  const subText = `Last signed in with ${PROVIDER_LABEL[last.provider]}`

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>{heading}</Text>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onContinue(last.provider)}
        disabled={isLoading}
      >
        <ProviderIcon provider={last.provider} />
        <View style={styles.textCol}>
          <Text style={styles.continueText} numberOfLines={1}>
            Continue as <Text style={styles.emailText}>{maskEmail(last.email)}</Text>
          </Text>
          <Text style={styles.subText}>{subText}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.useDifferent}>Use a different account</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 24,
    gap: 10,
  },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  textCol: {
    flex: 1,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },
  emailText: {
    fontWeight: '700',
  },
  subText: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  chevron: {
    fontSize: 26,
    color: colors.gray400,
    marginRight: 4,
  },
  useDifferent: {
    fontSize: 13,
    color: colors.info,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  appleIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIconGlyph: {
    color: '#FFF',
    fontSize: 16,
    marginTop: -2,
  },
  emailIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

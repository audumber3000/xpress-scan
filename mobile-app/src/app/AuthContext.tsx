import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { User, onAuthStateChanged } from "firebase/auth"
import { auth } from "../config/firebase"
import { signInWithEmail, signOutUser } from "../services/auth/authService"
import { registerSessionExpiredHandler, unregisterSessionExpiredHandler } from "../services/api/session"
import { registerPlanBlockedHandler, unregisterPlanBlockedHandler, clearPlanBlocked, PlanBlockedDetail } from "../services/api/planLock"
import { SessionEndedModal } from "../shared/components/SessionEndedModal"
import { PlanBlockedModal } from "../shared/components/PlanBlockedModal"
import { SUPPORT_PHONE_RAW } from "../shared/constants/support"
import { authApiService, type BackendUser } from "../services/api/auth.api"
import { showAlert } from "../shared/components/alertService"
import { usePostHog } from 'posthog-react-native'

export type AuthContextType = {
  isAuthenticated: boolean
  user: User | null
  backendUser: BackendUser | null
  authEmail?: string
  setAuthEmail: (email: string) => void
  signInEmail: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  validationError: string
  isLoading: boolean
  refreshBackendUser: () => Promise<void>
  isClinicSwitcherVisible: boolean
  setIsClinicSwitcherVisible: (visible: boolean) => void
  switchBranch: (clinicId: string) => Promise<void>
  authProvider: 'google' | 'email' | 'apple' | null
  appleFullName: string | null
  setAppleFullName: (name: string | null) => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps { }

export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ children }) => {
  const posthog = usePostHog()
  const [user, setUser] = useState<User | null>(null)
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  // Set only when the clinic ended the session, never on a normal sign-out.
  const [sessionEnded, setSessionEnded] = useState<string | null>(null)
  const [planBlocked, setPlanBlocked] = useState<PlanBlockedDetail | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isClinicSwitcherVisible, setIsClinicSwitcherVisible] = useState(false)
  const [authProvider, setAuthProvider] = useState<'google' | 'email' | 'apple' | null>(null)
  const [appleFullName, setAppleFullName] = useState<string | null>(null)

  // Background-sync with backend — does NOT block loading
  const syncBackendUser = useCallback(async (firebaseUser: User, storedUser: BackendUser | null) => {
    try {
      const idToken = await firebaseUser.getIdToken()

      // Race against a 12-second timeout so fetch never hangs indefinitely
      const makeTimeout = () => new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Backend timeout')), 12000)
      )

      await Promise.race([authApiService.oauthLogin(idToken), makeTimeout()])
      const userInfo = await Promise.race([authApiService.getCurrentUser(), makeTimeout()])

      if (userInfo) {
        setBackendUser(userInfo)
      } else if (!storedUser) {
        // Backend returned nothing AND no cached session — force re-login
        showAlert(
          'Connection Issue',
          'Could not reach the server. Please check your connection and try again.'
        )
        await signOutUser()
      }
      // If userInfo is null but storedUser was already set, keep storedUser — do not overwrite with null
    } catch (err: any) {
      console.warn('[Auth] Backend sync failed:', err.message)
      if (!storedUser) {
        showAlert(
          'Connection Issue',
          'Could not reach the server. Please check your connection and try again.'
        )
        await signOutUser()
      }
    }
  }, [])

  // Which account the listener last settled on, and whether it has settled at
  // all. Both are refs because they gate a side effect, not a render.
  const settledUid = useRef<string | null>(null)
  const hasSettled = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const nextUid = firebaseUser?.uid ?? null

      // `isLoading` puts ConnectingScreen up, and AppNavigator renders that
      // INSTEAD of the NavigationContainer — so raising it unmounts every
      // screen and mounts them again when it drops. That is the right thing on
      // a real sign-in or sign-out, where the whole stack changes anyway, and
      // the wrong thing when the listener simply re-fires for the account we
      // are already on: the customer loses whatever they had half-typed, and
      // any screen with work on mount does that work a second time. The signup
      // verification screen sent another OTP every time it happened.
      //
      // So block only on the first resolution and on an actual change of
      // account. A repeat fire for the same uid updates state in place.
      const isFirstResolution = !hasSettled.current
      const accountChanged = settledUid.current !== nextUid
      if (isFirstResolution || accountChanged) setIsLoading(true)
      settledUid.current = nextUid
      hasSettled.current = true

      setUser(firebaseUser)

      if (firebaseUser) {
        // Determine provider
        const providerId = firebaseUser.providerData[0]?.providerId
        if (providerId === 'google.com') setAuthProvider('google')
        else if (providerId === 'apple.com') setAuthProvider('apple')
        else setAuthProvider('email')

        setAuthEmail(firebaseUser.email || '')

        // 1. Load cached user from AsyncStorage immediately (fast, local)
        const storedUser = await authApiService.getUserInfo()
        if (storedUser) {
          setBackendUser(storedUser)
        }

        // 2. Unblock the loading screen — app can now navigate
        setIsLoading(false)

        // 3. Background-sync with backend (non-blocking)
        syncBackendUser(firebaseUser, storedUser)
      } else {
        // Firebase fired null — this happens on every app restart because the
        // Firebase JS SDK v12 has no AsyncStorage persistence layer on React Native.
        // Before clearing the session, check if the backend token is still valid.
        const storedUser = await authApiService.getUserInfo()
        if (storedUser) {
          const freshUser = await authApiService.getCurrentUser()
          if (freshUser) {
            // Backend token still valid — keep the session alive (staff or
            // post-restart session where Firebase persistence is missing)
            setBackendUser(freshUser)
            setAuthEmail(freshUser.email || '')
            setAuthProvider('email')
            setIsLoading(false)
            return
          }
        }
        // No valid session — clear everything
        setBackendUser(null)
        await authApiService.clearTokens()
        setAuthEmail('')
        setAuthProvider(null)
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [syncBackendUser])

  // Signed out by the clinic, not by the user: an owner deactivated them or
  // blocked this device. The backend already refuses every request; this is
  // what actually returns them to the sign-in screen.
  useEffect(() => {
    registerSessionExpiredHandler(async (reason) => {
      // A modal, not a toast. Being signed out mid-shift is the end of the
      // session, not a notice that can fade before it has been read.
      setSessionEnded(reason)
      try { await signOutUser() } catch { /* already gone */ }
      setBackendUser(null)
    })
    return () => unregisterSessionExpiredHandler()
  }, [])

  // The plan stopped, so the backend refuses every write while still serving
  // reads. Unlike an ended session this does NOT sign anybody out: their
  // records are all still there and still readable, which is most of what the
  // modal has to get across.
  useEffect(() => {
    registerPlanBlockedHandler((detail) => setPlanBlocked(detail))
    return () => unregisterPlanBlockedHandler()
  }, [])

  const logout = useCallback(async () => {
    await signOutUser()
    await authApiService.clearTokens()
    setAuthEmail("")
    setUser(null)
    setBackendUser(null)
    setAuthProvider(null)
    posthog.reset()
  }, [posthog])

  useEffect(() => {
    if (backendUser) {
      posthog.identify(backendUser.id.toString(), {
        name: backendUser.name,
        role: backendUser.role,
        email: backendUser.email
      });
      if (backendUser.clinic?.id) {
        posthog.group('clinic', backendUser.clinic.id.toString(), {
          name: backendUser.clinic.name
        });
      }
    }
  }, [backendUser, posthog])

  const refreshBackendUser = useCallback(async () => {
    if (user) {
      const storedUser = await authApiService.getUserInfo()
      await syncBackendUser(user, storedUser)
      return
    }
    // Backend-only session (staff): hit /auth/me with the stored access token
    const fresh = await authApiService.getCurrentUser()
    if (fresh) setBackendUser(fresh)
  }, [user, syncBackendUser])

  const signInEmail = useCallback(async (email: string, password: string) => {
    const { user: fbUser, backendUser: be, error } = await signInWithEmail(email, password)
    if (error) return { error }

    if (fbUser) {
      // Firebase path — onAuthStateChanged will populate state
      return { error: null }
    }

    // Backend-only path (staff): no Firebase listener will fire, set state manually
    if (be) {
      setBackendUser(be)
      setAuthEmail(be.email || '')
      setAuthProvider('email')
      setIsLoading(false)
    }
    return { error: null }
  }, [])

  const switchBranch = useCallback(async (clinicId: string) => {
    try {
      const updatedUser = await authApiService.switchClinic(clinicId);
      if (updatedUser) {
        setBackendUser(updatedUser);
      }
    } catch (error) {
      console.error('Error in switchBranch:', error);
      throw error;
    }
  }, []);

  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "can't be blank"
    if (authEmail.length < 6) return "must be at least 6 characters"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) return "must be a valid email address"
    return ""
  }, [authEmail])

  const value = {
    isAuthenticated: !!user || !!backendUser,
    user,
    backendUser,
    authEmail,
    setAuthEmail,
    signInEmail,
    logout,
    validationError,
    isLoading,
    refreshBackendUser,
    isClinicSwitcherVisible,
    setIsClinicSwitcherVisible,
    switchBranch,
    authProvider,
    appleFullName,
    setAppleFullName,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionEndedModal
        visible={!!sessionEnded}
        reason={sessionEnded}
        // Dismissing only reveals the sign-in screen the sign-out already put
        // them on. There is nothing else useful for this button to do.
        onSignIn={() => setSessionEnded(null)}
      />
      <PlanBlockedModal
        detail={planBlocked}
        clinicName={backendUser?.clinic?.name}
        supportPhone={SUPPORT_PHONE_RAW}
        onClose={() => { clearPlanBlocked(); setPlanBlocked(null) }}
      />
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

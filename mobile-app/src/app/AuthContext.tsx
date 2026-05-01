import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { User, onAuthStateChanged } from "firebase/auth"
import { auth } from "../config/firebase"
import { signInWithEmail, signOutUser } from "../services/auth/authService"
import { authApiService, type BackendUser } from "../services/api/auth.api"
import { showAlert } from "../shared/components/alertService"

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
}

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps { }

export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isClinicSwitcherVisible, setIsClinicSwitcherVisible] = useState(false)
  const [authProvider, setAuthProvider] = useState<'google' | 'email' | 'apple' | null>(null)

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true)
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

  const logout = useCallback(async () => {
    await signOutUser()
    await authApiService.clearTokens()
    setAuthEmail("")
    setUser(null)
    setBackendUser(null)
    setAuthProvider(null)
  }, [])

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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

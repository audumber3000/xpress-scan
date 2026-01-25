import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { User, onAuthStateChanged } from "firebase/auth"
import { auth } from "../config/firebase"
import { signOutUser } from "../services/auth/authService"
import { authApiService, type BackendUser } from "../services/api/auth.api"

export type AuthContextType = {
  isAuthenticated: boolean
  user: User | null
  backendUser: BackendUser | null
  authEmail?: string
  setAuthEmail: (email: string) => void
  logout: () => Promise<void>
  validationError: string
  isLoading: boolean
  refreshBackendUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps { }

export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Fetch backend user info
  const fetchBackendUser = useCallback(async (firebaseUser: User) => {
    try {
      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken()

      // Try to get stored user info first
      const storedUser = await authApiService.getUserInfo()
      if (storedUser) {
        setBackendUser(storedUser)
      }

      // Sync with backend - this will create/update user and get tokens
      try {
        await authApiService.oauthLogin(idToken)
        // Fetch fresh user info from backend
        const userInfo = await authApiService.getCurrentUser()
        setBackendUser(userInfo)
      } catch (backendError: any) {
        console.warn('Backend sync failed:', backendError)
        // Alert the user so they know something is wrong
        const { Alert } = require('react-native');
        Alert.alert(
          'Connection Issue',
          'Could not connect to the server. Some features may not work.\n' + (backendError.message || '')
        );

        // If backend sync fails, try to use stored user info
        if (!storedUser) {
          // If no stored user, try to fetch from backend with existing token
          try {
            const userInfo = await authApiService.getCurrentUser()
            setBackendUser(userInfo)
          } catch {
            // If that also fails, user might not exist in backend yet
            // This is okay - they'll be created on next successful login
          }
        }
      }
    } catch (error) {
      console.error('Error fetching backend user:', error)
    }
  }, [])

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        // Fetch backend user info when Firebase user is available
        await fetchBackendUser(firebaseUser)
        setAuthEmail(firebaseUser.email || "")
      } else {
        // Clear backend user when Firebase user logs out
        setBackendUser(null)
        await authApiService.clearTokens()
        setAuthEmail("")
      }

      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [fetchBackendUser])

  const logout = useCallback(async () => {
    await signOutUser()
    setAuthEmail("")
    setUser(null)
    setBackendUser(null)
  }, [])

  const refreshBackendUser = useCallback(async () => {
    if (user) {
      await fetchBackendUser(user)
    }
  }, [user, fetchBackendUser])

  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "can't be blank"
    if (authEmail.length < 6) return "must be at least 6 characters"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) return "must be a valid email address"
    return ""
  }, [authEmail])

  const value = {
    isAuthenticated: !!user,
    user,
    backendUser,
    authEmail,
    setAuthEmail,
    logout,
    validationError,
    isLoading,
    refreshBackendUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { authApi } from '../lib/api'

interface AuthState {
  user: User | null
  claims: { tenantId?: string; role?: string } | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  init: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  claims: null,
  loading: true,

  login: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
    // Sincronizar claims con el backend
    await authApi.setClaims()
    // Forzar refresh del token para obtener claims actualizados
    await auth.currentUser?.getIdToken(true)
    const idTokenResult = await auth.currentUser?.getIdTokenResult()
    set({
      user: auth.currentUser,
      claims: {
        tenantId: idTokenResult?.claims.tenantId as string,
        role: idTokenResult?.claims.role as string,
      },
    })
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null, claims: null })
  },

  init: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        set({
          user,
          claims: {
            tenantId: idTokenResult.claims.tenantId as string,
            role: idTokenResult.claims.role as string,
          },
          loading: false,
        })
      } else {
        set({ user: null, claims: null, loading: false })
      }
    })
  },
}))

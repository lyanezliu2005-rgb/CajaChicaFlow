'use client'
import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { authApi } from '../lib/api'

interface UserClaims {
  tenantId?: string
  role?: string
  name?: string
}

interface AuthState {
  user: User | null
  claims: UserClaims | null
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
    const cred = await signInWithEmailAndPassword(auth, email, password)
    // Obtener rol y tenantId desde Firestore (sin Cloud Functions)
    const userData = await authApi.getUserData(cred.user.uid, email)
    set({
      user: cred.user,
      claims: {
        tenantId: userData?.tenantId,
        role: userData?.role,
        name: userData?.name,
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
        const userData = await authApi.getUserData(user.uid, user.email || '')
        set({
          user,
          claims: {
            tenantId: userData?.tenantId,
            role: userData?.role,
            name: userData?.name,
          },
          loading: false,
        })
      } else {
        set({ user: null, claims: null, loading: false })
      }
    })
  },
}))

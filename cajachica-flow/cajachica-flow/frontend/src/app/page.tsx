'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../store/auth.store'

export default function Home() {
  const router = useRouter()
  const { user, loading, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/auth/login')
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600">
      <div className="text-center text-white">
        <div className="text-5xl mb-4">💼</div>
        <h1 className="text-2xl font-bold">CajaChica Flow</h1>
        <p className="text-blue-200 mt-2">Cargando...</p>
        <div className="mt-4 w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}

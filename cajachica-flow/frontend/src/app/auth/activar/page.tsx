'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authApi } from '../../../lib/api'
import Link from 'next/link'

interface ActivarForm {
  password: string
  confirmPassword: string
}

function ActivarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [userData, setUserData] = useState<{ name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ActivarForm>()

  useEffect(() => {
    if (!token) {
      setError('Link inválido. Solicita un nuevo link de invitación al administrador.')
      setLoading(false)
      return
    }
    authApi.getUserByInviteToken(token)
      .then(data => {
        if (!data) {
          setError('Este link ya fue usado o no es válido. Solicita uno nuevo al administrador.')
        } else {
          setUserData(data)
        }
      })
      .catch(() => setError('Error al verificar el link.'))
      .finally(() => setLoading(false))
  }, [token])

  const onSubmit = async (data: ActivarForm) => {
    if (!userData) return
    setSaving(true)
    setError('')
    try {
      await authApi.activateAccount(token, userData.email, data.password)
      router.replace('/auth/login?activated=1')
    } catch (err: any) {
      setError(err.message?.includes('email-already-in-use')
        ? 'Esta cuenta ya fue activada. Intenta iniciar sesión.'
        : 'Error al activar la cuenta. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👋</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userData ? `¡Hola, ${userData.name}!` : 'Activar cuenta'}
          </h1>
          {userData && (
            <p className="text-gray-500 text-sm mt-1">{userData.email}</p>
          )}
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
              {error}
            </div>
            <Link href="/auth/login" className="btn-secondary w-full text-center block py-3">
              Ir al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
              El administrador de tu empresa te ha invitado. Crea tu contraseña para activar tu cuenta.
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Contraseña</label>
                <input
                  {...register('password', { required: 'Requerido', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
                  type="password" className="input" placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="label">Confirmar contraseña</label>
                <input
                  {...register('confirmPassword', {
                    required: 'Requerido',
                    validate: v => v === watch('password') || 'Las contraseñas no coinciden'
                  })}
                  type="password" className="input" placeholder="••••••••"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
                {saving ? 'Activando...' : 'Activar mi cuenta'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ActivarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ActivarContent />
    </Suspense>
  )
}
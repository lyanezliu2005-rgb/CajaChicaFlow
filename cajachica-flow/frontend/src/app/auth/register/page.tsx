'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authApi } from '../../../lib/api'
import Link from 'next/link'

interface RegisterForm {
  companyName: string
  adminName: string
  adminEmail: string
  adminPassword: string
  confirmPassword: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>()

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError('')
    try {
      await authApi.registerTenant({
        companyName: data.companyName,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        plan: 'free',
      })
      router.replace('/auth/login?registered=1')
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('email-already-in-use')) {
        setError('Este email ya está registrado. Intenta iniciar sesión.')
      } else {
        setError('Error al registrar. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏢</div>
          <h1 className="text-2xl font-bold text-gray-900">Registra tu empresa</h1>
          <p className="text-gray-500 text-sm mt-1">Plan gratuito — sin tarjeta de crédito</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Nombre de la empresa</label>
            <input {...register('companyName', { required: 'Requerido' })}
              className="input" placeholder="Mi Empresa S.A." />
            {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
          </div>

          <div>
            <label className="label">Tu nombre (administrador)</label>
            <input {...register('adminName', { required: 'Requerido' })}
              className="input" placeholder="Juan Pérez" />
            {errors.adminName && <p className="text-red-500 text-xs mt-1">{errors.adminName.message}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input {...register('adminEmail', { required: 'Requerido' })}
              type="email" className="input" placeholder="juan@empresa.com" />
            {errors.adminEmail && <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>}
          </div>

          <div>
            <label className="label">Contraseña</label>
            <input {...register('adminPassword', { required: 'Requerido', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
              type="password" className="input" placeholder="••••••••" />
            {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>}
          </div>

          <div>
            <label className="label">Confirmar contraseña</label>
            <input {...register('confirmPassword', {
              required: 'Requerido',
              validate: v => v === watch('adminPassword') || 'Las contraseñas no coinciden'
            })} type="password" className="input" placeholder="••••••••" />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm text-gray-500">
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">Ingresar</Link>
          </p>
          <p>
            ¿Te invitaron a una empresa?{' '}
            <Link href="/auth/activar" className="text-blue-600 hover:underline font-medium">Activa tu cuenta aquí</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
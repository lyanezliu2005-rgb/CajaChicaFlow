'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/auth.store'
import { reportsApi } from '../../lib/api'
import Link from 'next/link'

interface Summary {
  total: number; pending: number; approved: number; rejected: number
  totalAmount: number; approvedAmount: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, claims, loading, logout, init } = useAuthStore()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && claims?.tenantId) {
      reportsApi.summary(claims.tenantId).then(setSummary).catch(console.error)
    }
  }, [user, claims])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💼</span>
            <span className="font-bold text-gray-900">CajaChica Flow</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              {claims?.role || 'usuario'}
            </span>
            <button onClick={() => { logout(); router.replace('/auth/login') }}
              className="text-sm text-gray-500 hover:text-gray-700">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Panel de Control</h1>
          <p className="text-gray-500 text-sm">Resumen de gastos y solicitudes</p>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total solicitudes', value: summary.total },
              { label: 'Pendientes', value: summary.pending },
              { label: 'Aprobadas', value: summary.approved },
              { label: 'Rechazadas', value: summary.rejected },
            ].map(({ label, value }) => (
              <div key={label} className="card text-center">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Monto total solicitado</p>
              <p className="text-xl font-bold text-gray-900">{formatCLP(summary.totalAmount)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 mb-1">Monto aprobado</p>
              <p className="text-xl font-bold text-green-600">{formatCLP(summary.approvedAmount)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/expenses/nueva" className="card hover:shadow-md transition-shadow cursor-pointer group">
            <div className="text-3xl mb-2">➕</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">Nueva Solicitud</h3>
            <p className="text-sm text-gray-500 mt-1">Crear solicitud de gasto o caja chica</p>
          </Link>

          <Link href="/expenses" className="card hover:shadow-md transition-shadow cursor-pointer group">
            <div className="text-3xl mb-2">📋</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">Mis Solicitudes</h3>
            <p className="text-sm text-gray-500 mt-1">Ver historial de solicitudes</p>
          </Link>

          {['admin', 'approver', 'finance', 'superadmin'].includes(claims?.role || '') && (
            <Link href="/expenses?filter=pending" className="card hover:shadow-md transition-shadow cursor-pointer group">
              <div className="text-3xl mb-2">🔔</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">Pendientes de Aprobación</h3>
              <p className="text-sm text-gray-500 mt-1">{summary?.pending || 0} solicitudes esperando</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

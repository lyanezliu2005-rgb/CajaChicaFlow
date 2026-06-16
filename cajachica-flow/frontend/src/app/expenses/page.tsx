'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/auth.store'
import { expensesApi } from '../../lib/api'
import Link from 'next/link'

interface Expense {
  id: string; code: string; title: string; status: string
  expenseType: string; amount: number; currency: string
  requesterName: string; createdAt: any
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-pending' },
  approved: { label: 'Aprobado', cls: 'badge-approved' },
  rejected: { label: 'Rechazado', cls: 'badge-rejected' },
  in_review: { label: 'En revisión', cls: 'badge-in_review' },
  draft: { label: 'Borrador', cls: 'badge-draft' },
}

const typeLabel: Record<string, string> = {
  travel: '✈️ Viaje', petty_cash: '💵 Caja Chica',
  reimbursement: '🔄 Reembolso', advance: '💰 Anticipo',
}

export default function ExpensesPage() {
  const router = useRouter()
  const { user, claims, loading, init } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fetching, setFetching] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => { init() }, [init])
  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && claims?.tenantId) {
      expensesApi.list(claims.tenantId, user.uid, claims.role || '', filter ? { status: filter } : {})
        .then((data: any) => setExpenses(data || []))
        .catch(console.error)
        .finally(() => setFetching(false))
    }
  }, [user, claims, filter])

  const formatCLP = (n: number, currency = 'CLP') =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(n)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Volver</Link>
            <h1 className="font-bold text-gray-900">Solicitudes de Gasto</h1>
          </div>
          <Link href="/expenses/nueva" className="btn-primary text-sm px-3 py-1.5">+ Nueva</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', 'pending', 'in_review', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                ${filter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {s === '' ? 'Todos' : statusLabel[s]?.label || s}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">No hay solicitudes</p>
            <Link href="/expenses/nueva" className="btn-primary inline-block mt-4">Crear primera solicitud</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense: any) => (
              <Link key={expense.id} href={`/expenses/detalle?id=${expense.id}`}
                className="card hover:shadow-md transition-shadow block">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{expense.code}</span>
                      <span className={statusLabel[expense.status]?.cls || 'badge-draft'}>
                        {statusLabel[expense.status]?.label || expense.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{expense.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {typeLabel[expense.expenseType] || expense.expenseType} · {expense.requesterName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{formatCLP(expense.amount, expense.currency)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {expense.createdAt?.seconds
                        ? new Date(expense.createdAt.seconds * 1000).toLocaleDateString('es-CL')
                        : '—'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
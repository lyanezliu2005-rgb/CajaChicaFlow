'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '../../../store/auth.store'
import { erpApi } from '../../../lib/api'

interface Expense {
  id: string
  code?: string
  title?: string
  requesterName?: string
  requesterEmail?: string
  amount?: number
  currency?: string
  status?: string
  expenseType?: string
  createdAt?: any
  updatedAt?: any
  erpSent?: boolean
  erpSentAt?: any
  [key: string]: any
}

function toTimestamp(ts: any): string {
  if (!ts) return ''
  if (ts.toDate) return ts.toDate().toISOString()
  if (typeof ts === 'string') return ts
  return ''
}

function formatDate(ts: any): string {
  const iso = toTimestamp(ts)
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL')
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

function buildJsonPayload(expense: Expense): string {
  return JSON.stringify({
    evento: 'gasto_aprobado',
    sistema_origen: 'CajaChicaFlow',
    timestamp: new Date().toISOString(),
    datos: {
      codigo: expense.code || '',
      tipo: expense.expenseType || 'petty_cash',
      titulo: expense.title || '',
      solicitante: expense.requesterName || '',
      email_solicitante: expense.requesterEmail || '',
      monto: expense.amount || 0,
      moneda: expense.currency || 'CLP',
      estado: 'aprobado',
      fecha_solicitud: toTimestamp(expense.createdAt),
      fecha_aprobacion: toTimestamp(expense.updatedAt),
    },
  }, null, 2)
}

function buildTextPayload(expense: Expense): string {
  return `COMPROBANTE DE GASTO APROBADO
==============================
Código: ${expense.code || '—'}
Tipo: ${expense.expenseType === 'travel' ? 'Viaje' : 'Caja Chica'}
Descripción: ${expense.title || '—'}
Solicitante: ${expense.requesterName || '—'}
Monto: ${formatCLP(expense.amount || 0)}
Fecha solicitud: ${formatDate(expense.createdAt)}
Fecha aprobación: ${formatDate(expense.updatedAt)}
Estado: APROBADO`
}

type Tab = 'pending' | 'sent'
type ModalType = 'json' | 'text' | null

export default function ErpPage() {
  const router = useRouter()
  const { user, claims, loading, init } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [tab, setTab] = useState<Tab>('pending')
  const [modal, setModal] = useState<{ type: ModalType; expense: Expense | null }>({ type: null, expense: null })
  const [sending, setSending] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && claims && !['admin', 'finance', 'superadmin'].includes(claims.role || '')) {
      router.replace('/dashboard')
    }
  }, [user, claims, loading, router])

  useEffect(() => {
    if (user && claims?.tenantId && ['admin', 'finance', 'superadmin'].includes(claims.role || '')) {
      loadData()
    }
  }, [user, claims])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const data = await erpApi.getApproved(claims!.tenantId)
      setExpenses(data as Expense[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingData(false)
    }
  }

  const handleSendToERP = async (expense: Expense) => {
    setSending(expense.id)
    try {
      await erpApi.markSentToERP(claims!.tenantId, expense.id)
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, erpSent: true } : e))
      setSuccessMsg(`Gasto ${expense.code} marcado como enviado al ERP`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      console.error(e)
    } finally {
      setSending(null)
    }
  }

  const pendingExpenses = expenses.filter(e => !e.erpSent)
  const sentExpenses = expenses.filter(e => e.erpSent)
  const displayed = tab === 'pending' ? pendingExpenses : sentExpenses

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">🔗 Integración ERP</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-200 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Por enviar
            {pendingExpenses.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                {pendingExpenses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'sent' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Ya enviados
            {sentExpenses.length > 0 && (
              <span className="ml-2 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">
                {sentExpenses.length}
              </span>
            )}
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {loadingData ? (
            <div className="p-8 text-center text-gray-500">Cargando gastos aprobados...</div>
          ) : displayed.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {tab === 'pending' ? 'No hay gastos pendientes de enviar al ERP' : 'No hay gastos enviados al ERP'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Código</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Descripción</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Solicitante</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Monto</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Fecha aprobación</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{expense.code || '—'}</td>
                      <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{expense.title || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{expense.requesterName || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCLP(expense.amount || 0)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(expense.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setModal({ type: 'json', expense })}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Ver JSON
                          </button>
                          <button
                            onClick={() => setModal({ type: 'text', expense })}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Ver Texto
                          </button>
                          {tab === 'pending' && (
                            <button
                              onClick={() => handleSendToERP(expense)}
                              disabled={sending === expense.id}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {sending === expense.id ? 'Enviando...' : 'Enviar a ERP (simulado)'}
                            </button>
                          )}
                          {tab === 'sent' && (
                            <span className="text-xs text-green-600 font-medium">✓ Enviado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.type && modal.expense && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h2 className="font-bold text-gray-900">
                {modal.type === 'json' ? 'Payload JSON' : 'Comprobante Texto'} — {modal.expense.code}
              </h2>
              <button
                onClick={() => setModal({ type: null, expense: null })}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap break-all border border-gray-200">
                {modal.type === 'json'
                  ? buildJsonPayload(modal.expense)
                  : buildTextPayload(modal.expense)}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  const content = modal.type === 'json'
                    ? buildJsonPayload(modal.expense!)
                    : buildTextPayload(modal.expense!)
                  navigator.clipboard?.writeText(content)
                }}
                className="btn-secondary text-sm"
              >
                Copiar
              </button>
              <button
                onClick={() => setModal({ type: null, expense: null })}
                className="btn-primary text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

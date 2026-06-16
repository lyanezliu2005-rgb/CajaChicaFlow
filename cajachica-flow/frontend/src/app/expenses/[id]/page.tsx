'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '../../../store/auth.store'
import { expensesApi } from '../../../lib/api'
import Link from 'next/link'

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-pending' },
  approved: { label: 'Aprobado', cls: 'badge-approved' },
  rejected: { label: 'Rechazado', cls: 'badge-rejected' },
  in_review: { label: 'En revisión', cls: 'badge-in_review' },
  draft: { label: 'Borrador', cls: 'badge-draft' },
}

export default function ExpenseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, claims, loading, init } = useAuthStore()
  const [expense, setExpense] = useState<any>(null)
  const [approveModal, setApproveModal] = useState(false)
  const [action, setAction] = useState<'approved' | 'rejected' | 'returned'>('approved')
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => { init() }, [init])
  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && claims?.tenantId && params.id) {
      expensesApi.get(claims.tenantId, params.id as string)
        .then(setExpense)
        .catch(() => router.replace('/expenses'))
    }
  }, [user, claims, params.id])

  const handleApprove = async () => {
    if (!claims?.tenantId) return
    setProcessing(true)
    try {
      await expensesApi.approve(claims.tenantId, params.id as string, { action, comment }, {
        uid: user!.uid,
        name: claims.name || user!.email,
      })
      const updated = await expensesApi.get(claims.tenantId, params.id as string)
      setExpense(updated)
      setApproveModal(false)
      setComment('')
    } catch (err: any) {
      alert(err.message || 'Error al procesar')
    } finally {
      setProcessing(false)
    }
  }

  const formatCLP = (n: number, currency = 'CLP') =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(n)

  const formatDate = (ts: any) => ts?.seconds
    ? new Date(ts.seconds * 1000).toLocaleString('es-CL') : '—'

  const isApprover = ['admin', 'approver', 'finance', 'superadmin'].includes(claims?.role || '')
  const canApprove = isApprover && ['pending', 'in_review'].includes(expense?.status)

  if (!expense) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/expenses" className="text-gray-400 hover:text-gray-600">← Volver</Link>
            <span className="font-mono text-sm text-gray-500">{expense.code}</span>
          </div>
          {canApprove && (
            <button onClick={() => setApproveModal(true)} className="btn-primary text-sm px-3 py-1.5">
              Gestionar aprobación
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{expense.title}</h1>
              <p className="text-gray-500 text-sm mt-1">{expense.requesterName} · {formatDate(expense.createdAt)}</p>
            </div>
            <span className={statusLabel[expense.status]?.cls || 'badge-draft'}>
              {statusLabel[expense.status]?.label}
            </span>
          </div>
          {expense.description && (
            <p className="text-gray-600 text-sm mt-3 bg-gray-50 rounded-lg p-3">{expense.description}</p>
          )}
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-gray-500 text-sm">Monto solicitado</span>
            <span className="text-2xl font-bold text-gray-900">
              {formatCLP(expense.amount, expense.currency)}
            </span>
          </div>
        </div>

        {expense.expenseType === 'travel' && (expense.travelOrigin || expense.travelDestination) && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">✈️ Datos del viaje</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500">Origen</p><p className="font-medium">{expense.travelOrigin || '—'}</p></div>
              <div><p className="text-gray-500">Destino</p><p className="font-medium">{expense.travelDestination || '—'}</p></div>
              <div><p className="text-gray-500">Inicio</p><p className="font-medium">{expense.travelStart || '—'}</p></div>
              <div><p className="text-gray-500">Regreso</p><p className="font-medium">{expense.travelEnd || '—'}</p></div>
            </div>
          </div>
        )}

        {expense.approvalSteps?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Flujo de aprobación</h2>
            <div className="space-y-3">
              {expense.approvalSteps.map((step: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0
                    ${step.action === 'approved' ? 'bg-green-100 text-green-600' :
                      step.action === 'rejected' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-600'}`}>
                    {step.action === 'approved' ? '✓' : step.action === 'rejected' ? '✗' : '⏳'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{step.stageName}</p>
                    {step.approverName && <p className="text-xs text-gray-500">Por: {step.approverName}</p>}
                    {step.comment && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">"{step.comment}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {approveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">Gestionar solicitud</h2>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{expense.title}</strong> — {formatCLP(expense.amount, expense.currency)}
            </p>
            <div className="space-y-2 mb-4">
              {[
                { value: 'approved', label: '✅ Aprobar', cls: 'border-green-500 bg-green-50' },
                { value: 'returned', label: '↩️ Devolver para corrección', cls: 'border-yellow-500 bg-yellow-50' },
                { value: 'rejected', label: '❌ Rechazar', cls: 'border-red-500 bg-red-50' },
              ].map(({ value, label, cls }) => (
                <label key={value}
                  className={`flex items-center gap-3 border-2 rounded-xl p-3 cursor-pointer
                    ${action === value ? cls : 'border-gray-200'}`}>
                  <input type="radio" name="action" value={value}
                    checked={action === value as any}
                    onChange={() => setAction(value as any)} />
                  <span className="font-medium text-sm">{label}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="label">Comentario {action !== 'approved' ? '*' : '(opcional)'}</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                className="input resize-none" rows={3} placeholder="Agrega un comentario..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleApprove} disabled={processing || (action !== 'approved' && !comment)}
                className="btn-primary flex-1">
                {processing ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { expensesApi } from '../../../lib/api'
import Link from 'next/link'

interface ExpenseForm {
  expenseType: string; title: string; description: string
  amount: number; currency: string; costCenterId: string
  travelOrigin: string; travelDestination: string
  travelStart: string; travelEnd: string
}

export default function NuevaExpensePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ExpenseForm>({
    defaultValues: { expenseType: 'petty_cash', currency: 'CLP' }
  })

  const expenseType = watch('expenseType')

  const onSubmit = async (data: ExpenseForm) => {
    setLoading(true)
    setError('')
    try {
      const result: any = await expensesApi.create({
        ...data,
        amount: Number(data.amount),
      })
      router.replace(`/expenses/${result.id}`)
    } catch (err: any) {
      setError(err.error || 'Error al crear la solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/expenses" className="text-gray-400 hover:text-gray-600">← Volver</Link>
          <h1 className="font-bold text-gray-900">Nueva Solicitud de Gasto</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Tipo de gasto */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Tipo de solicitud</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'petty_cash', label: '💵 Caja Chica', desc: 'Gastos menores de oficina' },
                { value: 'reimbursement', label: '🔄 Reembolso', desc: 'Gastos ya realizados' },
                { value: 'travel', label: '✈️ Viaje', desc: 'Gastos de viaje y viáticos' },
                { value: 'advance', label: '💰 Anticipo', desc: 'Adelanto de fondos' },
              ].map(({ value, label, desc }) => (
                <label key={value}
                  className={`border-2 rounded-xl p-3 cursor-pointer transition-all
                    ${expenseType === value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" {...register('expenseType')} value={value} className="hidden" />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Datos del gasto */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Detalle del gasto</h2>

            <div>
              <label className="label">Título *</label>
              <input {...register('title', { required: 'Requerido', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
                className="input" placeholder="Ej: Materiales de oficina para reunión cliente" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="label">Descripción / Justificación</label>
              <textarea {...register('description')}
                className="input resize-none" rows={3}
                placeholder="Detalla el motivo del gasto..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monto *</label>
                <input {...register('amount', { required: 'Requerido', min: { value: 1, message: 'Debe ser mayor a 0' } })}
                  type="number" step="1" className="input" placeholder="0" />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="label">Moneda</label>
                <select {...register('currency')} className="input">
                  <option value="CLP">CLP — Peso Chileno</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Datos de viaje (solo si es travel) */}
          {expenseType === 'travel' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Datos del viaje</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Origen</label>
                  <input {...register('travelOrigin')} className="input" placeholder="Santiago" />
                </div>
                <div>
                  <label className="label">Destino</label>
                  <input {...register('travelDestination')} className="input" placeholder="Valparaíso" />
                </div>
                <div>
                  <label className="label">Fecha inicio</label>
                  <input {...register('travelStart')} type="date" className="input" />
                </div>
                <div>
                  <label className="label">Fecha regreso</label>
                  <input {...register('travelEnd')} type="date" className="input" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
          )}

          <div className="flex gap-3">
            <Link href="/expenses" className="btn-secondary flex-1 text-center py-3">Cancelar</Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
              {loading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

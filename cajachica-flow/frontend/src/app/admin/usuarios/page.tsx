'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '../../../store/auth.store'
import { usersApi, authApi } from '../../../lib/api'

const ROLE_LABELS: Record<string, string> = {
  employee: 'Solicitante',
  approver: 'Aprobador (Jefe)',
  finance: 'Finanzas',
  admin: 'Administrador',
  superadmin: 'Super Admin',
}

const ROLE_OPTIONS = ['employee', 'approver', 'finance', 'admin']

interface UserRow {
  id: string
  name?: string
  email?: string
  role?: string
  isActive?: boolean
  preRegistered?: boolean
  [key: string]: any
}

export default function UsuariosPage() {
  const router = useRouter()
  const { user, claims, loading, init } = useAuthStore()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'employee' })
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [generatingLink, setGeneratingLink] = useState<string | null>(null)

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && user && claims && !['admin', 'superadmin'].includes(claims.role || '')) {
      router.replace('/dashboard')
    }
  }, [user, claims, loading, router])

  useEffect(() => {
    if (user && claims?.tenantId && ['admin', 'superadmin'].includes(claims.role || '')) {
      loadUsers()
    }
  }, [user, claims])

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await usersApi.list(claims!.tenantId)
      setUsers(data as UserRow[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleCopyInviteLink = async (userId: string) => {
    setGeneratingLink(userId)
    try {
      const token = await authApi.generateInviteToken(claims!.tenantId, userId)
      const link = `${window.location.origin}/auth/activar?token=${token}`
      await navigator.clipboard.writeText(link)
      setSuccessMsg('Link de invitación copiado al portapapeles. Compártelo con el usuario.')
      setTimeout(() => setSuccessMsg(''), 5000)
      await loadUsers()
    } catch (e) {
      console.error(e)
    } finally {
      setGeneratingLink(null)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await usersApi.updateRole(claims!.tenantId, userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSuccessMsg('Rol actualizado correctamente')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.email || !form.name || !form.role) {
      setFormError('Todos los campos son requeridos')
      return
    }
    setSaving(true)
    try {
      await usersApi.upsert(claims!.tenantId, form)
      setShowModal(false)
      setForm({ email: '', name: '', role: 'employee' })
      setSuccessMsg('Usuario agregado correctamente')
      setTimeout(() => setSuccessMsg(''), 3000)
      await loadUsers()
    } catch (e) {
      setFormError('Error al agregar usuario')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-gray-900">👥 Gestión de Usuarios</span>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            + Agregar usuario
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          {loadingUsers ? (
            <div className="p-8 text-center text-gray-500">Cargando usuarios...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay usuarios registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Rol</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Invitación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role || 'employee'}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="input py-1 text-sm"
                        >
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                          {u.role === 'superadmin' && (
                            <option value="superadmin">Super Admin</option>
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {u.preRegistered ? (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                            Pendiente
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.preRegistered ? (
                          <button
                            onClick={() => handleCopyInviteLink(u.id)}
                            disabled={generatingLink === u.id}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-medium disabled:opacity-50"
                          >
                            {generatingLink === u.id ? 'Generando...' : '🔗 Copiar link'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Agregar usuario</h2>
              <button onClick={() => { setShowModal(false); setFormError('') }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="usuario@empresa.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Nombre completo</label>
                <input type="text" className="input" placeholder="Juan Pérez"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Rol</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFormError('') }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Agregar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp, setDoc
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from './firebase'

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  registerTenant: async (data: {
    companyName: string
    adminName: string
    adminEmail: string
    adminPassword: string
    plan: string
  }) => {
    // 1. Crear usuario en Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, data.adminEmail, data.adminPassword)
    const uid = cred.user.uid

    // 2. Crear tenant en Firestore
    const tenantRef = doc(collection(db, 'tenants'))
    const tenantId = tenantRef.id

    await setDoc(tenantRef, {
      name: data.companyName,
      plan: data.plan || 'free',
      isActive: true,
      createdAt: serverTimestamp(),
      settings: {
        currency: 'CLP',
        timezone: 'America/Santiago',
        maxExpenseAmount: 5000000,
      },
    })

    // 3. Crear usuario dentro del tenant
    await setDoc(doc(db, `tenants/${tenantId}/users`, uid), {
      name: data.adminName,
      email: data.adminEmail,
      role: 'admin',
      tenantId,
      isActive: true,
      createdAt: serverTimestamp(),
    })

    // 4. Crear workflow por defecto
    await addDoc(collection(db, `tenants/${tenantId}/workflows`), {
      name: 'Flujo Estándar',
      isActive: true,
      expenseTypes: ['all'],
      stages: [
        { stageOrder: 1, name: 'Jefe Directo', approverRole: 'approver', slaHours: 48 },
        { stageOrder: 2, name: 'Finanzas', approverRole: 'finance', slaHours: 72 },
      ],
      createdAt: serverTimestamp(),
    })

    // 5. Centro de costo por defecto
    await addDoc(collection(db, `tenants/${tenantId}/costCenters`), {
      code: 'CC-001', name: 'General', isActive: true,
      createdAt: serverTimestamp(),
    })

    return { tenantId, userId: uid }
  },

  // Obtener datos del usuario (tenantId y rol) desde Firestore
  getUserData: async (uid: string, email: string) => {
    // Buscar en qué tenant está el usuario
    const tenantsSnap = await getDocs(collection(db, 'tenants'))
    for (const tenantDoc of tenantsSnap.docs) {
      const userDoc = await getDoc(doc(db, `tenants/${tenantDoc.id}/users`, uid))
      if (userDoc.exists()) {
        return { tenantId: tenantDoc.id, ...userDoc.data() }
      }
    }
    return null
  },
}

// ── Expenses ──────────────────────────────────────────────────
export const expensesApi = {
  create: async (data: any, tenantId: string, user: any) => {
    const year = new Date().getFullYear()
    const seq = Date.now().toString().slice(-6)
    const code = `CF-${year}-${seq}`

    const expenseRef = await addDoc(collection(db, `tenants/${tenantId}/expenses`), {
      code,
      requesterId: user.uid,
      requesterName: user.displayName || user.name || 'Usuario',
      requesterEmail: user.email,
      expenseType: data.expenseType,
      title: data.title,
      description: data.description || null,
      amount: Number(data.amount),
      currency: data.currency || 'CLP',
      travelOrigin: data.travelOrigin || null,
      travelDestination: data.travelDestination || null,
      travelStart: data.travelStart || null,
      travelEnd: data.travelEnd || null,
      status: 'pending',
      currentStage: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return { id: expenseRef.id, code }
  },

  list: async (tenantId: string, uid: string, role: string, filters: any = {}) => {
    const isAdmin = ['admin', 'approver', 'finance', 'superadmin'].includes(role)
    let q = query(
      collection(db, `tenants/${tenantId}/expenses`),
      orderBy('createdAt', 'desc'),
      limit(50)
    )

    if (!isAdmin) {
      q = query(
        collection(db, `tenants/${tenantId}/expenses`),
        where('requesterId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    }

    if (filters.status) {
      q = query(
        collection(db, `tenants/${tenantId}/expenses`),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    }

    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },

  get: async (tenantId: string, expenseId: string) => {
    const expenseDoc = await getDoc(doc(db, `tenants/${tenantId}/expenses`, expenseId))
    if (!expenseDoc.exists()) throw new Error('No encontrado')

    const stepsSnap = await getDocs(
      query(collection(db, `tenants/${tenantId}/expenses/${expenseId}/approvalSteps`),
        orderBy('stageOrder'))
    )

    return {
      ...expenseDoc.data(),
      id: expenseDoc.id,
      approvalSteps: stepsSnap.docs.map(d => d.data()),
    }
  },

  approve: async (tenantId: string, expenseId: string, data: { action: string; comment: string }, approver: any) => {
    const expenseRef = doc(db, `tenants/${tenantId}/expenses`, expenseId)
    const expenseDoc = await getDoc(expenseRef)
    const expense = expenseDoc.data()!

    // Registrar el paso de aprobación
    await addDoc(collection(db, `tenants/${tenantId}/expenses/${expenseId}/approvalSteps`), {
      stageOrder: expense.currentStage,
      stageName: data.action === 'approved' ? 'Aprobado' : data.action === 'rejected' ? 'Rechazado' : 'Devuelto',
      action: data.action,
      approverId: approver.uid,
      approverName: approver.name,
      comment: data.comment || null,
      actedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })

    let newStatus = data.action === 'rejected' ? 'rejected'
      : data.action === 'returned' ? 'draft'
      : expense.currentStage >= 2 ? 'approved' : 'in_review'

    await updateDoc(expenseRef, {
      status: newStatus,
      currentStage: data.action === 'approved' ? expense.currentStage + 1 : expense.currentStage,
      updatedAt: serverTimestamp(),
    })

    return { newStatus }
  },
}

// ── Reports ───────────────────────────────────────────────────
export const reportsApi = {
  summary: async (tenantId: string) => {
    const snap = await getDocs(collection(db, `tenants/${tenantId}/expenses`))
    const expenses = snap.docs.map(d => d.data())

    return {
      total: expenses.length,
      pending: expenses.filter(e => e.status === 'pending').length,
      approved: expenses.filter(e => e.status === 'approved').length,
      rejected: expenses.filter(e => e.status === 'rejected').length,
      totalAmount: expenses.reduce((s, e) => s + (e.amount || 0), 0),
      approvedAmount: expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0),
    }
  },
}

import { Router } from 'express'
import * as admin from 'firebase-admin'
import { z } from 'zod'

export const authRouter = Router()
const db = admin.firestore()

// ── Registro de nuevo tenant ──────────────────────────────────
authRouter.post('/register-tenant', async (req, res) => {
  try {
    const schema = z.object({
      companyName: z.string().min(2),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
      adminName: z.string().min(2),
      plan: z.enum(['free', 'starter', 'pro']).default('free'),
    })
    const data = schema.parse(req.body)

    // 1. Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      displayName: data.adminName,
    })

    // 2. Crear tenant en Firestore
    const tenantRef = db.collection('tenants').doc()
    const tenantId = tenantRef.id

    await tenantRef.set({
      name: data.companyName,
      plan: data.plan,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        currency: 'CLP',
        timezone: 'America/Santiago',
        maxExpenseAmount: 5000000,
      },
    })

    // 3. Crear usuario en subcolección del tenant
    await db.collection(`tenants/${tenantId}/users`).doc(userRecord.uid).set({
      name: data.adminName,
      email: data.adminEmail,
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 4. Crear workflow por defecto
    await db.collection(`tenants/${tenantId}/workflows`).add({
      name: 'Flujo Estándar',
      isActive: true,
      expenseTypes: ['all'],
      stages: [
        { stageOrder: 1, name: 'Jefe Directo', approverRole: 'approver', slaHours: 48 },
        { stageOrder: 2, name: 'Finanzas', approverRole: 'finance', slaHours: 72 },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 5. Crear centros de costo por defecto
    await db.collection(`tenants/${tenantId}/costCenters`).add({
      code: 'CC-001', name: 'General', isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 6. Asignar custom claims (tenantId + role)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      tenantId,
      role: 'admin',
    })

    return res.status(201).json({
      message: 'Tenant creado exitosamente',
      tenantId,
      userId: userRecord.uid,
    })
  } catch (error: any) {
    console.error('register-tenant error:', error)
    return res.status(400).json({ error: error.message })
  }
})

// ── Asignar claims al hacer login (se llama tras login exitoso) ─
authRouter.post('/set-claims', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1]
    if (!token) return res.status(401).json({ error: 'No autorizado' })

    const decoded = await admin.auth().verifyIdToken(token)

    // Buscar en qué tenant está este usuario
    const tenantsSnap = await db.collectionGroup('users')
      .where('email', '==', decoded.email)
      .limit(1)
      .get()

    if (tenantsSnap.empty) return res.status(404).json({ error: 'Usuario no encontrado en ningún tenant' })

    const userDoc = tenantsSnap.docs[0]
    const userData = userDoc.data()
    const tenantId = userDoc.ref.parent.parent!.id

    await admin.auth().setCustomUserClaims(decoded.uid, {
      tenantId,
      role: userData.role,
    })

    return res.json({ tenantId, role: userData.role })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// ── Invitar usuario al tenant ─────────────────────────────────
authRouter.post('/invite', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ error: 'Sin permisos' })
    }

    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
      role: z.enum(['employee', 'approver', 'finance', 'admin']),
    })
    const data = schema.parse(req.body)
    const tenantId = user.tenantId

    // Crear usuario Firebase
    let userRecord
    try {
      userRecord = await admin.auth().createUser({
        email: data.email,
        displayName: data.name,
        password: Math.random().toString(36).slice(-10) + 'A1!',
      })
    } catch {
      userRecord = await admin.auth().getUserByEmail(data.email)
    }

    // Agregar al tenant
    await db.collection(`tenants/${tenantId}/users`).doc(userRecord.uid).set({
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: true,
      invitedBy: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    await admin.auth().setCustomUserClaims(userRecord.uid, { tenantId, role: data.role })

    // Enviar link de reset password (actúa como invitación)
    const link = await admin.auth().generatePasswordResetLink(data.email)
    console.log(`Invitation link for ${data.email}: ${link}`)

    return res.json({ message: 'Usuario invitado', userId: userRecord.uid })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

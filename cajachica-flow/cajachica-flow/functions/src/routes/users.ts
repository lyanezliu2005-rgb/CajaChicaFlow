import { Router } from 'express'
import * as admin from 'firebase-admin'

export const usersRouter = Router()
const db = admin.firestore()

usersRouter.get('/', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    const snap = await db.collection(`tenants/${user.tenantId}/users`).get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

usersRouter.get('/me', async (req, res) => {
  try {
    const user = (req as any).user
    const doc = await db.doc(`tenants/${user.tenantId}/users/${user.uid}`).get()
    return res.json({ id: doc.id, ...doc.data() })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

usersRouter.put('/:userId/role', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    const { role } = req.body
    await db.doc(`tenants/${user.tenantId}/users/${req.params.userId}`).update({ role })
    await admin.auth().setCustomUserClaims(req.params.userId, {
      tenantId: user.tenantId, role,
    })
    return res.json({ success: true })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

import { Router } from 'express'
import * as admin from 'firebase-admin'

export const workflowsRouter = Router()
const db = admin.firestore()

workflowsRouter.get('/', async (req, res) => {
  try {
    const user = (req as any).user
    const snap = await db.collection(`tenants/${user.tenantId}/workflows`).get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

workflowsRouter.post('/', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    const ref = db.collection(`tenants/${user.tenantId}/workflows`).doc()
    await ref.set({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    return res.status(201).json({ id: ref.id })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

workflowsRouter.put('/:workflowId', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    await db.doc(`tenants/${user.tenantId}/workflows/${req.params.workflowId}`).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.json({ success: true })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

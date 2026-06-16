import { Router } from 'express'
import * as admin from 'firebase-admin'
import { z } from 'zod'

export const tenantsRouter = Router()
const db = admin.firestore()

tenantsRouter.get('/me', async (req, res) => {
  try {
    const user = (req as any).user
    if (!user.tenantId) return res.status(404).json({ error: 'Sin tenant' })
    const tenantDoc = await db.doc(`tenants/${user.tenantId}`).get()
    if (!tenantDoc.exists) return res.status(404).json({ error: 'Tenant no encontrado' })
    return res.json({ id: tenantDoc.id, ...tenantDoc.data() })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

tenantsRouter.put('/me/settings', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    await db.doc(`tenants/${user.tenantId}`).update({
      settings: req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.json({ success: true })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// Cost Centers
tenantsRouter.get('/cost-centers', async (req, res) => {
  try {
    const user = (req as any).user
    const snap = await db.collection(`tenants/${user.tenantId}/costCenters`).get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

tenantsRouter.post('/cost-centers', async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Sin permisos' })
    const ref = db.collection(`tenants/${user.tenantId}/costCenters`).doc()
    await ref.set({ ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    return res.status(201).json({ id: ref.id })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

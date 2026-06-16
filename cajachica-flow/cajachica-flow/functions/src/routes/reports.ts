import { Router } from 'express'
import * as admin from 'firebase-admin'

export const reportsRouter = Router()
const db = admin.firestore()

reportsRouter.get('/summary', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId

    const expensesSnap = await db.collection(`tenants/${tenantId}/expenses`).get()
    const expenses = expensesSnap.docs.map(d => d.data())

    const summary = {
      total: expenses.length,
      pending: expenses.filter(e => e.status === 'pending').length,
      approved: expenses.filter(e => e.status === 'approved').length,
      rejected: expenses.filter(e => e.status === 'rejected').length,
      totalAmount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
      approvedAmount: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0),
      byType: {
        travel: expenses.filter(e => e.expenseType === 'travel').length,
        petty_cash: expenses.filter(e => e.expenseType === 'petty_cash').length,
        reimbursement: expenses.filter(e => e.expenseType === 'reimbursement').length,
        advance: expenses.filter(e => e.expenseType === 'advance').length,
      }
    }

    return res.json(summary)
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

reportsRouter.get('/my-expenses', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId

    const snap = await db.collection(`tenants/${tenantId}/expenses`)
      .where('requesterId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

reportsRouter.get('/pending-approvals', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId

    if (!['admin', 'approver', 'finance', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ error: 'Sin permisos' })
    }

    const snap = await db.collection(`tenants/${tenantId}/expenses`)
      .where('status', 'in', ['pending', 'in_review'])
      .orderBy('createdAt', 'asc')
      .get()

    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

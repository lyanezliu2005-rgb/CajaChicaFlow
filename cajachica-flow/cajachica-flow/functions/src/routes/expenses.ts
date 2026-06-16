import { Router } from 'express'
import * as admin from 'firebase-admin'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export const expensesRouter = Router()
const db = admin.firestore()

// ── Crear solicitud de gasto ──────────────────────────────────
expensesRouter.post('/', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId

    const schema = z.object({
      expenseType: z.enum(['travel', 'petty_cash', 'reimbursement', 'advance']),
      title: z.string().min(3).max(200),
      description: z.string().optional(),
      amount: z.number().positive(),
      currency: z.string().default('CLP'),
      costCenterId: z.string().optional(),
      departmentId: z.string().optional(),
      travelOrigin: z.string().optional(),
      travelDestination: z.string().optional(),
      travelStart: z.string().optional(),
      travelEnd: z.string().optional(),
      items: z.array(z.object({
        category: z.string(),
        description: z.string(),
        amount: z.number().positive(),
        expenseDate: z.string().optional(),
        vendor: z.string().optional(),
      })).optional(),
    })

    const data = schema.parse(req.body)

    // Generar código único
    const year = new Date().getFullYear()
    const seq = Date.now().toString().slice(-6)
    const code = `CF-${year}-${seq}`

    // Obtener nombre del solicitante
    const userDoc = await db.doc(`tenants/${tenantId}/users/${user.uid}`).get()
    const userData = userDoc.data()

    const expenseRef = db.collection(`tenants/${tenantId}/expenses`).doc()

    await expenseRef.set({
      id: expenseRef.id,
      code,
      requesterId: user.uid,
      requesterName: userData?.name || user.name || 'Usuario',
      requesterEmail: user.email,
      expenseType: data.expenseType,
      title: data.title,
      description: data.description || null,
      amount: data.amount,
      currency: data.currency,
      costCenterId: data.costCenterId || null,
      departmentId: data.departmentId || null,
      travelOrigin: data.travelOrigin || null,
      travelDestination: data.travelDestination || null,
      travelStart: data.travelStart || null,
      travelEnd: data.travelEnd || null,
      status: 'pending',
      currentStage: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Guardar items
    if (data.items?.length) {
      const batch = db.batch()
      for (const item of data.items) {
        const itemRef = expenseRef.collection('items').doc()
        batch.set(itemRef, {
          ...item,
          id: itemRef.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
      await batch.commit()
    }

    // Audit log
    await db.collection(`tenants/${tenantId}/auditLogs`).add({
      userId: user.uid,
      action: 'EXPENSE_CREATED',
      resource: 'expense',
      resourceId: expenseRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return res.status(201).json({ id: expenseRef.id, code })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// ── Listar gastos ─────────────────────────────────────────────
expensesRouter.get('/', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId
    const isAdmin = ['admin', 'approver', 'finance', 'superadmin'].includes(user.role)

    let query: admin.firestore.Query = db.collection(`tenants/${tenantId}/expenses`)

    if (!isAdmin) {
      query = query.where('requesterId', '==', user.uid)
    }

    if (req.query.status) {
      query = query.where('status', '==', req.query.status)
    }

    if (req.query.type) {
      query = query.where('expenseType', '==', req.query.type)
    }

    query = query.orderBy('createdAt', 'desc').limit(50)

    const snap = await query.get()
    const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    return res.json({ expenses, total: expenses.length })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// ── Obtener gasto por ID ──────────────────────────────────────
expensesRouter.get('/:expenseId', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId
    const { expenseId } = req.params

    const expenseDoc = await db.doc(`tenants/${tenantId}/expenses/${expenseId}`).get()
    if (!expenseDoc.exists) return res.status(404).json({ error: 'No encontrado' })

    const expense = expenseDoc.data()!
    const isAdmin = ['admin', 'approver', 'finance', 'superadmin'].includes(user.role)

    if (!isAdmin && expense.requesterId !== user.uid) {
      return res.status(403).json({ error: 'Sin acceso' })
    }

    // Obtener items y steps
    const [itemsSnap, stepsSnap, attachmentsSnap] = await Promise.all([
      expenseDoc.ref.collection('items').get(),
      expenseDoc.ref.collection('approvalSteps').orderBy('stageOrder').get(),
      expenseDoc.ref.collection('attachments').get(),
    ])

    return res.json({
      ...expense,
      id: expenseDoc.id,
      items: itemsSnap.docs.map(d => d.data()),
      approvalSteps: stepsSnap.docs.map(d => d.data()),
      attachments: attachmentsSnap.docs.map(d => d.data()),
    })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// ── Aprobar / Rechazar ────────────────────────────────────────
expensesRouter.post('/:expenseId/approve', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId
    const { expenseId } = req.params

    const isApprover = ['admin', 'approver', 'finance', 'superadmin'].includes(user.role)
    if (!isApprover) return res.status(403).json({ error: 'Sin permisos para aprobar' })

    const schema = z.object({
      action: z.enum(['approved', 'rejected', 'returned']),
      comment: z.string().optional(),
    })
    const { action, comment } = schema.parse(req.body)

    const expenseRef = db.doc(`tenants/${tenantId}/expenses/${expenseId}`)
    const expenseDoc = await expenseRef.get()
    if (!expenseDoc.exists) return res.status(404).json({ error: 'No encontrado' })

    const expense = expenseDoc.data()!
    if (!['pending', 'in_review'].includes(expense.status)) {
      return res.status(400).json({ error: 'La solicitud no está en estado de aprobación' })
    }

    // Actualizar el step actual
    const stepsSnap = await expenseRef.collection('approvalSteps')
      .where('action', '==', 'pending')
      .orderBy('stageOrder')
      .limit(1)
      .get()

    if (!stepsSnap.empty) {
      await stepsSnap.docs[0].ref.update({
        action,
        approverId: user.uid,
        approverName: user.name,
        comment: comment || null,
        actedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // Determinar nuevo estado
    let newStatus: string
    if (action === 'rejected') {
      newStatus = 'rejected'
    } else if (action === 'returned') {
      newStatus = 'draft'
    } else {
      // Verificar si hay más etapas
      const workflowSnap = await db.collection(`tenants/${tenantId}/workflows`)
        .where('isActive', '==', true).limit(1).get()

      if (!workflowSnap.empty) {
        const workflow = workflowSnap.docs[0].data()
        const nextStage = workflow.stages?.find((s: any) => s.stageOrder === expense.currentStage + 1)
        if (nextStage) {
          newStatus = 'in_review'
          const dueAt = new Date(Date.now() + (nextStage.slaHours || 48) * 3600000)
          await expenseRef.collection('approvalSteps').add({
            stageOrder: nextStage.stageOrder,
            stageName: nextStage.name,
            approverRole: nextStage.approverRole,
            action: 'pending',
            dueAt: admin.firestore.Timestamp.fromDate(dueAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        } else {
          newStatus = 'approved'
        }
      } else {
        newStatus = 'approved'
      }
    }

    await expenseRef.update({
      status: newStatus,
      currentStage: action === 'approved' ? expense.currentStage + 1 : expense.currentStage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(newStatus === 'approved' || newStatus === 'rejected' ? {
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      } : {}),
    })

    return res.json({ success: true, newStatus })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

// ── Subir adjunto ─────────────────────────────────────────────
expensesRouter.post('/:expenseId/attachments', async (req, res) => {
  try {
    const user = (req as any).user
    const tenantId = user.tenantId
    const { expenseId } = req.params

    const { fileName, mimeType, storageUrl } = req.body

    const attachmentRef = db
      .collection(`tenants/${tenantId}/expenses/${expenseId}/attachments`)
      .doc()

    await attachmentRef.set({
      id: attachmentRef.id,
      fileName,
      mimeType,
      storageUrl,
      uploaderId: user.uid,
      uploaderName: user.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return res.status(201).json({ id: attachmentRef.id })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
})

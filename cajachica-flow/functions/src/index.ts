import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import express from 'express'
import cors from 'cors'

admin.initializeApp()

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

// ── Middleware auth ───────────────────────────────────────────
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'No autorizado' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    ;(req as any).user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

function requireTenant(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user
  if (!user?.tenantId) return res.status(403).json({ error: 'Sin tenant asignado' })
  next()
}

// ── Rutas Auth ────────────────────────────────────────────────
import { authRouter } from './routes/auth'
import { expensesRouter } from './routes/expenses'
import { tenantsRouter } from './routes/tenants'
import { workflowsRouter } from './routes/workflows'
import { usersRouter } from './routes/users'
import { reportsRouter } from './routes/reports'

app.use('/auth', authRouter)
app.use('/expenses', requireAuth, requireTenant, expensesRouter)
app.use('/tenants', requireAuth, tenantsRouter)
app.use('/workflows', requireAuth, requireTenant, workflowsRouter)
app.use('/users', requireAuth, requireTenant, usersRouter)
app.use('/reports', requireAuth, requireTenant, reportsRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))

export const api = functions.https.onRequest(app)

// ── Triggers Firestore ────────────────────────────────────────
export const onExpenseCreated = functions.firestore
  .document('tenants/{tenantId}/expenses/{expenseId}')
  .onCreate(async (snap, context) => {
    const expense = snap.data()
    const { tenantId, expenseId } = context.params
    const db = admin.firestore()

    // Obtener workflow del tenant
    const workflowSnap = await db
      .collection(`tenants/${tenantId}/workflows`)
      .where('isActive', '==', true)
      .where('expenseTypes', 'array-contains-any', [expense.expenseType, 'all'])
      .limit(1)
      .get()

    if (workflowSnap.empty) return null

    const workflow = workflowSnap.docs[0].data()
    const firstStage = workflow.stages?.[0]

    if (firstStage) {
      const dueAt = new Date(Date.now() + (firstStage.slaHours || 48) * 3600000)
      await snap.ref.collection('approvalSteps').add({
        stageOrder: 1,
        stageName: firstStage.name,
        approverRole: firstStage.approverRole,
        action: 'pending',
        dueAt: admin.firestore.Timestamp.fromDate(dueAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Notificar aprobadores
      const approversSnap = await db
        .collection(`tenants/${tenantId}/users`)
        .where('role', '==', firstStage.approverRole)
        .get()

      const notifications = approversSnap.docs.map(doc =>
        db.collection(`tenants/${tenantId}/notifications`).add({
          userId: doc.id,
          type: 'expense_pending_approval',
          title: 'Solicitud pendiente de aprobación',
          body: `${expense.requesterName} solicita aprobación: ${expense.title}`,
          expenseId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      )
      await Promise.all(notifications)
    }
    return null
  })

export const onExpenseUpdated = functions.firestore
  .document('tenants/{tenantId}/expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const { tenantId, expenseId } = context.params

    if (before.status === after.status) return null

    const db = admin.firestore()

    // Notificar al solicitante si cambió el estado
    if (['approved', 'rejected', 'returned'].includes(after.status)) {
      await db.collection(`tenants/${tenantId}/notifications`).add({
        userId: after.requesterId,
        type: `expense_${after.status}`,
        title: `Solicitud ${after.status === 'approved' ? 'aprobada' : after.status === 'rejected' ? 'rechazada' : 'devuelta'}`,
        body: `Tu solicitud "${after.title}" fue ${after.status === 'approved' ? 'aprobada' : after.status === 'rejected' ? 'rechazada' : 'devuelta para correcciones'}`,
        expenseId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // Audit log
    await db.collection(`tenants/${tenantId}/auditLogs`).add({
      action: `EXPENSE_STATUS_${after.status.toUpperCase()}`,
      resource: 'expense',
      resourceId: expenseId,
      before: { status: before.status },
      after: { status: after.status },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return null
  })

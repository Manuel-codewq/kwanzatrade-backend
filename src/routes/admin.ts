import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  getStats,
  getClients,
  getClientById,
  getKYCPending,
  approveKYC,
  rejectKYC,
  getKYCDocuments,
  getAllPositions,
  forceClosePosition,
  getAllTransactions,
  confirmTransaction,
  rejectTransaction,
  getSettings,
  updateSettings,
  suspendClient,
  blockClient,
  activateClient,
  deleteClient,
} from '../controllers/adminController'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/stats',                     getStats)
router.get('/clients',                   getClients)
router.get('/clients/:id',               getClientById)
router.get('/kyc/pending',               getKYCPending)
router.post('/kyc/:id/approve',          approveKYC)
router.post('/kyc/:id/reject',           rejectKYC)
router.get('/kyc/:id/documents',         getKYCDocuments)
router.get('/positions',                 getAllPositions)
router.post('/positions/:id/close',      forceClosePosition)
router.get('/transactions',              getAllTransactions)
router.post('/transactions/:id/confirm', confirmTransaction)
router.post('/transactions/:id/reject',  rejectTransaction)
router.get('/settings',                  getSettings)
router.post('/settings',                 updateSettings)
router.post('/clients/:id/suspend',      suspendClient)
router.post('/clients/:id/block',        blockClient)
router.post('/clients/:id/activate',     activateClient)
router.delete('/clients/:id',            deleteClient)

export default router

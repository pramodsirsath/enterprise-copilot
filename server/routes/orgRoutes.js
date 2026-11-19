import express from 'express';
import {
  createOrganization,
  joinOrganization,
  regenerateInviteCode,
  listMembers,
  listDocuments,
  uploadDocument,
  markDocumentUploaded,
  retryDocument,
  deleteDocument,
  chatMessage,
} from '../controllers/orgController.js';
import { verifyToken, requireOrg, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// Onboarding
router.post('/create', createOrganization);
router.post('/join', joinOrganization);

// Workspace (any member)
router.get('/members', requireOrg, listMembers);
router.get('/documents', requireOrg, listDocuments);
router.post('/chat', requireOrg, chatMessage);

// Admin only
router.post('/invite-code', requireOrg, requireAdmin, regenerateInviteCode);
router.post('/upload', requireOrg, requireAdmin, uploadDocument);
router.post('/uploaded', requireOrg, requireAdmin, markDocumentUploaded);
router.post('/documents/:id/retry', requireOrg, requireAdmin, retryDocument);
router.delete('/documents/:id', requireOrg, requireAdmin, deleteDocument);

export default router;

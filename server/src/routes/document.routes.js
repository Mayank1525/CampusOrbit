import { Router } from 'express';
import * as ctrl from '../controllers/document.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listDocuments);
router.post('/upload', upload.single('file'), ctrl.uploadDocument);
router.post('/link', validate(ctrl.linkSchema), ctrl.addLink);
router.get('/proof-of-work', ctrl.proofOfWork);
router.get('/checklist/:opportunityId', ctrl.checklistForOpportunity);
router.get('/:id/download', ctrl.downloadDocument);
router.delete('/:id', ctrl.deleteDocument);

export default router;

import { Router } from 'express';
import Lead from '../controllers/leads'
import auth from '../middlewares/auth'

const router = Router();

router.get('/list', auth, Lead.index)
router.post('/add', auth, Lead.add)
router.post('/update/:id', auth, Lead.update)
router.get('/view/:id', auth, Lead.view)
router.post('/delete/:id', auth, Lead.deleteItem)
// router.post('/deletemany', auth, Lead.deleteMany)

//recordsview Excecutive 
router.post('/recordsview', auth, Lead.recordsview)

// Get status and substatus
router.get('/status', auth, Lead.getStatus)
router.get('/substatus/:statusId', auth, Lead.getSubstatus)

// Update insurdata status and substatus
router.post('/update-insurdata-status/:id', auth, Lead.updateInsurDataStatus)

// Upload documents
router.post('/upload-documents', auth, Lead.uploadDocuments)

export default router


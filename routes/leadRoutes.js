import { Router } from 'express';
import Lead from '../controllers/leads'
import auth from '../middlewares/auth'
import { upload } from '../utils/upload'

const router = Router();

router.get('/list', auth, Lead.index)
router.post('/add', auth, Lead.add)
router.post('/update/:id', auth, Lead.update)
router.get('/view/:id', auth, Lead.view)
router.post('/delete/:id', auth, Lead.deleteItem)
// router.post('/deletemany', auth, Lead.deleteMany)


export default router


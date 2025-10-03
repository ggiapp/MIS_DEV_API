import { Router } from 'express';
import Quote from '../controllers/quotes'
import auth from '../middlewares/auth'
import { upload } from '../utils/upload'

const router = Router();

router.get('/list', auth, Quote.index)
router.post('/add', auth, Quote.add)
router.post('/update/:id', auth, Quote.update)
router.get('/view/:id', auth, Quote.view)
router.post('/delete/:id', auth, Quote.deleteItem)
// router.post('/deletemany', auth, Lead.deleteMany)


export default router
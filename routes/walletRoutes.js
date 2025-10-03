import { Router } from 'express';
import Wallet from '../controllers/wallets'
import auth from '../middlewares/auth'
import { upload } from '../utils/upload'

const router = Router();

router.get('/list', auth, Wallet.index)
router.get('/admin', auth, Wallet.adminWallet)
router.post('/add', auth, Wallet.add)
router.post('/adminwallet', auth, Wallet.addAdminWallet)

router.post('/update', auth, Wallet.walletUpate)
router.post('/update/:id', auth, Wallet.walletUpate)
router.get('/view/:id', auth, Wallet.view)
// router.post('/delete/:id', auth, Wallet.deleteItem)
// router.post('/deletemany', auth, Lead.deleteMany)


export default router
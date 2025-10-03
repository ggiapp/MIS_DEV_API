import { Router } from 'express';
import Users from '../controllers/users';
import auth from '../middlewares/auth';
const router = Router();

router.get('/dashboard',auth, Users.dashBoard)
router.get('/list',auth, Users.index)
router.post('/doc/:docId',auth, Users.docRemover)
router.get('/view/:id',auth, Users.view)
router.get('/view/profile',auth, Users.view)
router.post('/edit/:id',auth, Users.edit)

router.post('/pwd-update',auth, Users.passUpdate)
router.get('/verify-status',auth, Users.verifyStatus)
router.post('/forgot', Users.forgotUser)
router.post('/register', Users.register)
router.post('/login', Users.login)

// Admin Routes
router.post('/user-login', Users.employeeLogin);
router.post('/create-user', Users.createUser);
router.post('/update/:id', Users.updateUser);
router.post('/delete/:id', Users.deleteUser);

router.post('/:action/:id', Users.userActions);

router.get('/docs/:id', Users.getDocs);
// router.post('/delete/:id', Users.deleteUser);

router.get('/get-unique-names', Users.getUniqueUserList);

router.get('/get-live-user',auth, Users.getLiveUsers);

router.get('/get-live-contacts',auth, Users.getLiveContacts);

router.get('/get-top-user',auth, Users.getTopUser);





export default router
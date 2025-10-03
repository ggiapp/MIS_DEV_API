import { Router } from 'express';
import dashBoardController from '../controllers/dashboard';
import auth from '../middlewares/auth';
const router = Router();

// # MIS _CRM_ MIGRATION
router.get('/form-options',auth, dashBoardController.getFormOptions)
router.post('/leads/import', auth,dashBoardController.leadsImport);
router.get('/leads/fetch', auth,dashBoardController.fetchLeadsData);
router.get('/user_location', auth,dashBoardController.getLocationByUsers);
router.get('/teamlead_by_location', auth,dashBoardController.getTeamLeadByUsers);
router.post('/leads/assign', auth,dashBoardController.LeadAssigmentModule);

// # MIS _CRM_ MIGRATION


router.get('/view',auth, dashBoardController.dashBoard)
router.get('/users',auth, dashBoardController.userRecords)
router.get('/user/:user_id',auth, dashBoardController.viewUser)
router.get('/leads',auth, dashBoardController.leadRecords)
router.get('/quotes',auth, dashBoardController.quoteRecords)
router.post('/status/:module', auth,dashBoardController.statusUpdate)

router.get('/settings',auth, dashBoardController.webSettings)
router.post('/update-settings',auth, dashBoardController.updateSettings)

// Institutions REST


router.get('/institutions',auth, dashBoardController.getInstitutions)
router.get('/institution/view/:id',auth, dashBoardController.viewInstitution)
router.post('/institution/add',auth, dashBoardController.createInstitution)
router.post('/institution/edit/:id',auth, dashBoardController.updateInstitution)
router.post('/institution/delete/:id',auth, dashBoardController.deleteInstitution)

// Institutions REST


router.get('/list',auth, dashBoardController.index)
router.get('/view/:id',auth, dashBoardController.view)
router.get('/view/profile',auth, dashBoardController.view)
router.post('/edit/:id',auth, dashBoardController.edit)
router.post('/delete/:id',auth, dashBoardController.deleteData)
router.post('/register', dashBoardController.register)
router.post('/login', dashBoardController.login)

export default router
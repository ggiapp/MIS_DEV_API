import { Router } from 'express';
import commonController from '../controllers/common';
import auth from '../middlewares/auth';
const router = Router();



// MIS REST


router.post('/mis/tl-list',auth,commonController.getMisTLEntires);


router.post('/mis/list',commonController.getMisRecords);
router.post('/mis/create-new',commonController.createMis);

// router.post('/mis/create',commonController.createMis);


router.post('/mis/delete',commonController.deleteMisRecords);

router.get('/mis/:id/view',commonController.getMisOneRecord);

router.post('/mis/reports',auth,commonController.getMisForMatchIds);


router.get('/mis/make-model',commonController.getMisMakeModel);

router.get('/mis/dashboard',auth,commonController.getMisDashboard);
router.get('/mis/dashboard-filter',commonController.getMisDashboardFilter);

// MIS REST

router.get('/mis-check/:key/:value',commonController.checkMisValidation);

// MIS SYNC

router.post('/mis/sync',commonController.misSync);

// MIS IMPORT
router.post('/mis/qc-import', commonController.qcCheckImport);

export default router
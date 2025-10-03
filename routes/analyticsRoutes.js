import { Router } from 'express';
import analyticsController from './../controllers/analytics';
import auth from '../middlewares/auth';
const router = Router();



 // router.get('/settings',auth, analyticsController.index)
 // router.post('/update-settings',auth, analyticsController.update)

  router.get('/data',auth, analyticsController.getData);

  router.get('/tl-data',auth, analyticsController.getTlData);

  router.get('/bis-data',auth, analyticsController.bisData);

  router.get('/bis-reports',auth, analyticsController.bisReports);

  router.post('/qc-check', analyticsController.qcCheckReports);


export default router
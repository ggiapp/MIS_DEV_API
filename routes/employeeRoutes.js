import { Router } from 'express';
import auth from '../middlewares/auth'
import EmployeeDetails from '../controllers/employeeDetails'
const router = Router();

router.get('/list',EmployeeDetails.fetchEmployeeNames)

export default router
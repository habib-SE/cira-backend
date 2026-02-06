import express from 'express';
import employeeController from '../controllers/employeeController.js';
import { requireAuth } from '../middlewares/auth.js';
const router = express.Router();

// Employee Routes (for company role)
router.post('/create-employee',requireAuth, employeeController.createEmployee);
router.get('/get-all-employees', requireAuth,employeeController.getEmployees);
router.get('/get-employee/:id',requireAuth, employeeController.getEmployeeById);
router.put('/update-employee/:id', requireAuth,employeeController.updateEmployee);
router.delete('/delete-employee/:id',requireAuth, employeeController.deleteEmployee);

export default router;

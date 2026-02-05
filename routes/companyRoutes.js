import express from 'express';
import employeeController from '../controllers/employeeController.js';

const router = express.Router();

// Employee Routes (for company role)
router.post('/create-employee', employeeController.createEmployee);
router.get('/employees', employeeController.getEmployees);
router.get('/employees/:id', employeeController.getEmployeeById);
router.put('/employees/:id', employeeController.updateEmployee);
router.delete('/employees/:id', employeeController.deleteEmployee);

export default router;

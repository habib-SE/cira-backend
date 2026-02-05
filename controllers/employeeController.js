import db from '../config/db.js';

const TABLE_NAME = 'employees';

const createEmployee = async (req, res) => {
    try {
        const b = req.body || {};

        const company_id = b.company_id ? Number(b.company_id) : null;
        const user_id = b.user_id ? Number(b.user_id) : null;
        const employee_name = b.employee_name || b.name || null;
        const email = b.email || null;
        const image_url = b.image_url || b.avatar || null;
        const status = b.status || 'Active';

        if (!company_id || !employee_name || !email) {
            return res.status(400).json({ message: 'Company ID, Employee Name, and Email are required.' });
        }

        const row = {
            company_id,
            user_id,
            employee_name,
            email,
            image_url,
            status
        };

        const [id] = await db(TABLE_NAME).insert(row);
        const created = await db(TABLE_NAME).where({ id }).first();

        res.status(201).json({ message: 'Employee created successfully', data: created });
    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ message: 'Failed to create employee', error: error.message });
    }
};

const getEmployees = async (req, res) => {
    try {
        const { company_id } = req.query;
        let query = db(TABLE_NAME).select('*');

        if (company_id) {
            query = query.where({ company_id });
        }

        const employees = await query;
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
    }
};

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await db(TABLE_NAME).where({ id }).first();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch employee', error: error.message });
    }
};

const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body || {};

        const employee = await db(TABLE_NAME).where({ id }).first();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const updates = {};
        if (b.company_id) updates.company_id = Number(b.company_id);
        if (b.user_id) updates.user_id = Number(b.user_id);
        if (b.employee_name || b.name) updates.employee_name = b.employee_name || b.name;
        if (b.email) updates.email = b.email;
        if (b.image_url || b.avatar) updates.image_url = b.image_url || b.avatar;
        if (b.status) updates.status = b.status;

        await db(TABLE_NAME).where({ id }).update(updates);
        const updated = await db(TABLE_NAME).where({ id }).first();

        res.json({ message: 'Employee updated successfully', data: updated });
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ message: 'Failed to update employee', error: error.message });
    }
};

const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        const employee = await db(TABLE_NAME).where({ id }).first();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        await db(TABLE_NAME).where({ id }).delete();
        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ message: 'Failed to delete employee', error: error.message });
    }
};

export default {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
};

const express = require('express');
const { authenticateToken } = require('../auth/jwt');
const router = express.Router();

// Helper function to get database from req.db (set in middleware)
const getDb = (req) => req.app.locals.db || req.db;

// Debug endpoint
router.get('/debug', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        const [testResult] = await db.query('SELECT 1 as test');
        res.json({
            message: 'Debug endpoint working (MySQL)',
            db_connected: !!db,
            user: req.user,
            test_query: testResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard Stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [[projects]] = await db.query('SELECT COUNT(*) as total FROM projects');
        const [[activeProjects]] = await db.query('SELECT COUNT(*) as total FROM projects WHERE status = ?', ['Active']);
        const [[weeklyTasks]] = await db.query('SELECT COUNT(*) as total FROM weekly_tasks');
        // Get current week number and year
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const pastDays = (now - startOfYear) / 86400000;
        const currentWeek = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();
        const [[weeklyTasksThisWeek]] = await db.query(
            'SELECT COUNT(*) as total FROM weekly_tasks WHERE week_number = ? AND year = ?', 
            [currentWeek, currentYear]
        );
        const [vulnerabilities] = await db.query('SELECT id, status, due_date FROM vulnerabilities');
        const [[risks]] = await db.query('SELECT COUNT(*) as total FROM risk_register WHERE is_archived = 0');
        const [[criticalTasks]] = await db.query('SELECT COUNT(*) as total FROM critical_tasks WHERE is_archived = 0');
        const [severityData] = await db.query('SELECT severity, COUNT(*) as count FROM vulnerabilities GROUP BY severity');

        // Use the stored status directly - no dynamic calculation
        // Status is calculated and stored in DB by the frontend during import/recalculation
        const vulnStats = vulnerabilities.reduce((acc, vuln) => {
            const status = vuln.status || 'Open';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {
            total: 0,
            open: 0,
            inProgress: 0,
            due: 0,
            breached: 0,
            resolved: 0
        });

        // Calculate total vulnerabilities
        vulnStats.total = vulnerabilities.length;

        // Format bySeverity - map 'Moderate' to 'Medium' for chart compatibility
        const bySeverity = [
            { severity: 'Low', count: 0 },
            { severity: 'Medium', count: 0 },
            { severity: 'High', count: 0 },
            { severity: 'Critical', count: 0 }
        ];
        
        severityData.forEach(row => {
            // Map database severity values to chart labels
            let severityLabel = row.severity;
            if (severityLabel === 'Moderate') {
                severityLabel = 'Medium';
            }
            
            const item = bySeverity.find(s => s.severity === severityLabel);
            if (item) {
                item.count = parseInt(row.count);
            }
        });

        res.json({
            projects: { 
                total: parseInt(projects.total) || 0,
                active: parseInt(activeProjects.total) || 0
            },
            weekly_tasks: { 
                total: parseInt(weeklyTasks.total) || 0,
                thisWeek: parseInt(weeklyTasksThisWeek.total) || 0
            },
            vulnerabilities: {
                total: vulnStats.total,
                open: vulnStats.Open || 0,
                inProgress: vulnStats['In Progress'] || 0,
                due: vulnStats.Due || 0,
                breached: vulnStats.Breached || 0,
                resolved: vulnStats.Resolved || 0,
                bySeverity: bySeverity
            },
            risks: { total: parseInt(risks.total) || 0 },
            critical_tasks: { total: parseInt(criticalTasks.total) || 0 }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to load dashboard statistics' });
    }
});

// Projects
router.get('/projects', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [rows] = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Projects error:', error);
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

router.post('/projects', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { title, description, targetEndDate, assignedTeam, status, completionPercentage } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING, then select the inserted record
        await db.query(
            'INSERT INTO projects (title, description, target_end_date, assigned_team, status, completion_percentage, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description, targetEndDate, assignedTeam, status, completionPercentage || 0, userId]
        );
        
        // Get the inserted record using LAST_INSERT_ID()
        const [rows] = await db.query('SELECT * FROM projects WHERE id = LAST_INSERT_ID()');
    res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// PUT: Update a project by id
router.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const data = req.body || {};
    const fields = [];
    const values = [];
    if (data.title) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    // Handle targetEndDate: convert empty string to NULL, otherwise use the value
    if (data.targetEndDate !== undefined && data.targetEndDate !== null) {
        if (data.targetEndDate === '') {
            fields.push('target_end_date = NULL');
        } else {
            fields.push('target_end_date = ?');
            values.push(data.targetEndDate);
        }
    }
    if (data.assignedTeam !== undefined) { fields.push('assigned_team = ?'); values.push(data.assignedTeam); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (data.completionPercentage !== undefined && data.completionPercentage !== null && data.completionPercentage !== '') { fields.push('completion_percentage = ?'); values.push(parseInt(data.completionPercentage, 10)); }
    console.log('Project update fields:', fields);
    console.log('Project update values:', values);
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    console.log('Project update SQL:', sql);
    const [updateResult] = await db.query(sql, values);
    if (updateResult.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
    const [[row]] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('Update project error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Failed to update project: ' + error.message });
  }
});

// DELETE: Delete a project by id
router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const [delResult] = await db.query('DELETE FROM projects WHERE id = ?', [id]);
    if (delResult.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

router.get('/weekly-tasks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [rows] = await db.query('SELECT * FROM weekly_tasks ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Weekly tasks error:', error);
        res.status(500).json({ error: 'Failed to load weekly tasks' });
    }
});

router.post('/weekly-tasks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { title, assignedTeam, checklist, weekNumber, year } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING
        await db.query(
            'INSERT INTO weekly_tasks (title, assigned_team, checklist, week_number, year, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, assignedTeam, JSON.stringify(checklist), weekNumber, year, userId]
        );
        
        // Get the inserted record
        const [rows] = await db.query('SELECT * FROM weekly_tasks WHERE id = LAST_INSERT_ID()');
    res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create weekly task error:', error);
        res.status(500).json({ error: 'Failed to create weekly task' });
    }
});

// PUT: Update a weekly task by id
router.put('/weekly-tasks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const data = req.body || {};
    const fields = [];
    const values = [];
    if (data.title) { fields.push('title = ?'); values.push(data.title); }
    if (data.assignedTeam) { fields.push('assigned_team = ?'); values.push(data.assignedTeam); }
    if (data.checklist) { fields.push('checklist = ?'); values.push(JSON.stringify(data.checklist)); }
    if (data.weekNumber) { fields.push('week_number = ?'); values.push(data.weekNumber); }
    if (data.year) { fields.push('year = ?'); values.push(data.year); }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE weekly_tasks SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    const [updateResult] = await db.query(sql, values);
    if (updateResult.affectedRows === 0) return res.status(404).json({ error: 'Weekly task not found' });
    const [[row]] = await db.query('SELECT * FROM weekly_tasks WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('Update weekly task error:', error);
    res.status(500).json({ error: 'Failed to update weekly task' });
  }
});

// DELETE: Delete a weekly task by id
router.delete('/weekly-tasks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const [delResult] = await db.query('DELETE FROM weekly_tasks WHERE id = ?', [id]);
    if (delResult.affectedRows === 0) return res.status(404).json({ error: 'Weekly task not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete weekly task error:', error);
    res.status(500).json({ error: 'Failed to delete weekly task' });
  }
});

// Vulnerabilities
router.get('/vulnerabilities', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [rows] = await db.query('SELECT * FROM vulnerabilities ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Vulnerabilities error:', error);
        res.status(500).json({ error: 'Failed to load vulnerabilities' });
    }
});

router.post('/vulnerabilities', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { title, severity, description, status, dueDate, assignmentGroup, created_by, discovered_date, resolved_date } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING
        await db.query(
            'INSERT INTO vulnerabilities (title, severity, description, status, due_date, assignment_group, created_by, discovered_date, resolved_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, severity, description, status, dueDate, assignmentGroup, created_by || userId, discovered_date, resolved_date]
        );
        
        // Get the inserted record
        const [rows] = await db.query('SELECT * FROM vulnerabilities WHERE id = LAST_INSERT_ID()');
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create vulnerability error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Vulnerability with this title already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create vulnerability' });
        }
    }
});

router.put('/vulnerabilities/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { id } = req.params;
        const updateData = req.body;
        
        // First check if vulnerability exists
        const [existingCheck] = await db.query('SELECT id FROM vulnerabilities WHERE id = ?', [id]);
        if (existingCheck.length === 0) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }

        // Map camelCase to snake_case for database
        const fieldMapping = {
            dueDate: 'due_date',
            assignmentGroup: 'assignment_group',
            discoveredDate: 'discovered_date',
            resolvedDate: 'resolved_date',
            createdBy: 'created_by'
        };

        const updateFields = [];
        const updateValues = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                // Convert camelCase to snake_case
                const dbField = fieldMapping[key] || key;
                updateFields.push(`${dbField} = ?`);
                updateValues.push(updateData[key]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = ?`);
        updateValues.push(new Date().toISOString());
        
        // Add id for WHERE clause
        updateValues.push(id);

        // MySQL: Build dynamic UPDATE with ? placeholders
        const updateQuery = `
            UPDATE vulnerabilities 
            SET ${updateFields.join(', ')} 
            WHERE id = ?
        `;

        await db.query(updateQuery, updateValues);
        
        // Get the updated record (MySQL doesn't support RETURNING)
        const [rows] = await db.query('SELECT * FROM vulnerabilities WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Update vulnerability error:', error);
        res.status(500).json({ error: 'Failed to update vulnerability' });
    }
});

router.delete('/vulnerabilities/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        await db.query('DELETE FROM vulnerabilities WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete vulnerability error:', error);
        res.status(500).json({ error: 'Failed to delete vulnerability' });
    }
});

router.post('/vulnerabilities/import', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { vulnerabilities } = req.body;
        if (!vulnerabilities || !Array.isArray(vulnerabilities)) {
            return res.status(400).json({ error: 'Invalid vulnerabilities data' });
        }

        let imported = 0;
        let updated = 0;
        let removed = 0;

        const userId = req.user.id;
        for (const vuln of vulnerabilities) {
            try {
                // MySQL: Insert without RETURNING
                await db.query(
                    'INSERT INTO vulnerabilities (title, severity, description, status, due_date, assignment_group, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [vuln.title, vuln.severity, vuln.description, vuln.status, vuln.due_date, vuln.assignment_group, userId]
                );
                imported++;
            } catch (error) {
                console.error('Error importing vulnerability:', vuln.title, error);
            }
        }

        res.json({
            success: true,
            imported,
            updated,
            removed,
            details: { imported, updated, removed }
        });
    } catch (error) {
        console.error('Import vulnerabilities error:', error);
        res.status(500).json({ error: 'Failed to import vulnerabilities' });
    }
});

// Risks
router.get('/risks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Support archived query parameter
        const showArchived = req.query.archived === 'true' || req.query.archived === '1';
        let sql = 'SELECT * FROM risk_register';
        let params = [];
        
        if (!showArchived) {
            sql += ' WHERE is_archived = 0';
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Risks error:', error);
        res.status(500).json({ error: 'Failed to load risks' });
    }
});

router.post('/risks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { riskName, impact, owner, status, mitigation } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!riskName) {
            return res.status(400).json({ error: 'Risk name is required' });
        }

        // MySQL: Insert with backward compatibility - populate both new and old fields
        await db.query(
            'INSERT INTO risk_register (risk_name, risk_description, impact, owner, status, mitigation, required_action, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [riskName, riskName, impact || 'Medium', owner, status || 'Open', mitigation, mitigation, userId]
        );
        
        // Get the inserted record
        const [rows] = await db.query('SELECT * FROM risk_register WHERE id = LAST_INSERT_ID()');
        
        if (!rows || rows.length === 0) {
            return res.status(500).json({ error: 'Failed to retrieve created risk' });
        }
        
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create risk error:', error);
        res.status(500).json({ error: 'Failed to create risk: ' + error.message });
    }
});

// Critical Tasks
router.get('/critical-tasks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Support archived query parameter
        const showArchived = req.query.archived === 'true' || req.query.archived === '1';
        let sql = 'SELECT * FROM critical_tasks';
        let params = [];
        
        if (!showArchived) {
            sql += ' WHERE is_archived = 0';
        }
        
        sql += ` ORDER BY CASE 
            WHEN priority = 'Critical' THEN 1
            WHEN priority = 'High' THEN 2
            WHEN priority = 'Medium' THEN 3
            WHEN priority = 'Low' THEN 4
            ELSE 5
        END, created_at DESC`;
        
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Critical tasks error:', error);
        res.status(500).json({ error: 'Failed to load critical tasks' });
    }
});

router.post('/critical-tasks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const { title, priority, description, assignedTeam, status } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING
        await db.query(
            'INSERT INTO critical_tasks (title, priority, description, assigned_team, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, priority, description, assignedTeam, status, userId]
        );
        
        // Get the inserted record
        const [rows] = await db.query('SELECT * FROM critical_tasks WHERE id = LAST_INSERT_ID()');
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create critical task error:', error);
        res.status(500).json({ error: 'Failed to create critical task' });
    }
});

// Bulk Delete Endpoints for Clear Data functionality
router.delete('/clear-all-data', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const tables = [
            'projects',
            'weekly_tasks', 
            'vulnerabilities',
            'risk_register',
            'critical_tasks'
        ];

        let deletedCounts = {};

        for (const table of tables) {
            try {
                // MySQL: Get row count before delete
                const [[countResult]] = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
                const rowCount = countResult.count;
                
                // Delete all rows
                await db.query(`DELETE FROM ${table}`);
                
                // MySQL uses affectedRows instead of rowCount
                deletedCounts[table] = rowCount;
                console.log(`Cleared ${rowCount} records from ${table}`);
            } catch (error) {
                console.error(`Error clearing ${table}:`, error);
                deletedCounts[table] = 0;
            }
        }

        res.json({ 
            success: true, 
            message: 'All data cleared successfully',
            deletedCounts
        });
    } catch (error) {
        console.error('Clear all data error:', error);
        res.status(500).json({ error: 'Failed to clear all data' });
    }
});

// Individual table clear endpoints
router.delete('/projects/clear', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Get count before delete
        const [[countResult]] = await db.query('SELECT COUNT(*) as count FROM projects');
        await db.query('DELETE FROM projects');
        
        res.json({ success: true, deleted: countResult.count || 0 });
    } catch (error) {
        console.error('Clear projects error:', error);
        res.status(500).json({ error: 'Failed to clear projects' });
    }
});

router.delete('/weekly-tasks/clear', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [[countResult]] = await db.query('SELECT COUNT(*) as count FROM weekly_tasks');
        await db.query('DELETE FROM weekly_tasks');
        
        res.json({ success: true, deleted: countResult.count || 0 });
    } catch (error) {
        console.error('Clear weekly tasks error:', error);
        res.status(500).json({ error: 'Failed to clear weekly tasks' });
    }
});

router.delete('/vulnerabilities/clear', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [[countResult]] = await db.query('SELECT COUNT(*) as count FROM vulnerabilities');
        await db.query('DELETE FROM vulnerabilities');
        
        res.json({ success: true, deleted: countResult.count || 0 });
    } catch (error) {
        console.error('Clear vulnerabilities error:', error);
        res.status(500).json({ error: 'Failed to clear vulnerabilities' });
    }
});

router.delete('/risks/clear', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [[countResult]] = await db.query('SELECT COUNT(*) as count FROM risk_register');
        await db.query('DELETE FROM risk_register');
        
        res.json({ success: true, deleted: countResult.count || 0 });
    } catch (error) {
        console.error('Clear risks error:', error);
        res.status(500).json({ error: 'Failed to clear risks' });
    }
});

router.delete('/critical-tasks/clear', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [[countResult]] = await db.query('SELECT COUNT(*) as count FROM critical_tasks');
        await db.query('DELETE FROM critical_tasks');
        
        res.json({ success: true, deleted: countResult.count || 0 });
    } catch (error) {
        console.error('Clear critical tasks error:', error);
        res.status(500).json({ error: 'Failed to clear critical tasks' });
    }
});

// Risks: PUT and DELETE endpoints
router.put('/risks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const data = req.body || {};
    const fields = [];
    const values = [];
    // Update both new and legacy fields for backward compatibility
    if (data.riskName) { 
      fields.push('risk_name = ?'); values.push(data.riskName);
      fields.push('risk_description = ?'); values.push(data.riskName);
    }
    if (data.impact) { fields.push('impact = ?'); values.push(data.impact); }
    if (typeof data.owner !== 'undefined') { fields.push('owner = ?'); values.push(data.owner); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (typeof data.mitigation !== 'undefined') { 
      fields.push('mitigation = ?'); values.push(data.mitigation);
      fields.push('required_action = ?'); values.push(data.mitigation);
    }
    if (typeof data.isArchived !== 'undefined') { fields.push('is_archived = ?'); values.push(data.isArchived); }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE risk_register SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    const [updateResult] = await db.query(sql, values);
    if (updateResult.affectedRows === 0) return res.status(404).json({ error: 'Risk not found' });
    const [[row]] = await db.query('SELECT * FROM risk_register WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error('Update risk error:', err);
    res.status(500).json({ error: 'Failed to update risk' });
  }
});

router.delete('/risks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const [delResult] = await db.query('DELETE FROM risk_register WHERE id = ?', [id]);
    if (delResult.affectedRows === 0) return res.status(404).json({ error: 'Risk not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete risk error:', err);
    res.status(500).json({ error: 'Failed to delete risk' });
  }
});

// Critical Tasks: PUT and DELETE endpoints
router.put('/critical-tasks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const data = req.body || {};
    const fields = [];
    const values = [];
    if (data.title) { fields.push('title = ?'); values.push(data.title); }
    if (data.priority) { fields.push('priority = ?'); values.push(data.priority); }
    if (typeof data.description !== 'undefined') { fields.push('description = ?'); values.push(data.description); }
    if (data.assignedTeam) { fields.push('assigned_team = ?'); values.push(data.assignedTeam); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (typeof data.isArchived !== 'undefined') { fields.push('is_archived = ?'); values.push(data.isArchived); }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE critical_tasks SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    const [updateResult] = await db.query(sql, values);
    if (updateResult.affectedRows === 0) return res.status(404).json({ error: 'Critical task not found' });
    const [[row]] = await db.query('SELECT * FROM critical_tasks WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error('Update critical task error:', err);
    res.status(500).json({ error: 'Failed to update critical task' });
  }
});

router.delete('/critical-tasks/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database connection not available' });
    const id = req.params.id;
    const [delResult] = await db.query('DELETE FROM critical_tasks WHERE id = ?', [id]);
    if (delResult.affectedRows === 0) return res.status(404).json({ error: 'Critical task not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete critical task error:', err);
    res.status(500).json({ error: 'Failed to delete critical task' });
  }
});

module.exports = router;

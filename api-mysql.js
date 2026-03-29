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
        const [vulnerabilities] = await db.query('SELECT status, COUNT(*) as count FROM vulnerabilities GROUP BY status');
        const [[risks]] = await db.query('SELECT COUNT(*) as total FROM risk_register WHERE is_archived = 0');
        const [[criticalTasks]] = await db.query('SELECT COUNT(*) as total FROM critical_tasks WHERE is_archived = 0');
        const [severityData] = await db.query('SELECT severity, COUNT(*) as count FROM vulnerabilities GROUP BY severity');

        // Process vulnerability status counts safely
        const vulnStats = vulnerabilities.reduce((acc, row) => {
            const status = row.status || 'Unknown';
            acc[status] = (acc[status] || 0) + parseInt(row.count);
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
        vulnStats.total = vulnerabilities.reduce((sum, row) => sum + parseInt(row.count), 0);

        // Format bySeverity
        const bySeverity = [
            { severity: 'Low', count: 0 },
            { severity: 'Medium', count: 0 },
            { severity: 'High', count: 0 },
            { severity: 'Critical', count: 0 }
        ];
        
        severityData.forEach(row => {
            const item = bySeverity.find(s => s.severity === row.severity);
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
                thisWeek: parseInt(weeklyTasks.total) || 0
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

        const { title, description, targetEndDate, assignedTeam, status } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING, then select the inserted record
        await db.query(
            'INSERT INTO projects (title, description, target_end_date, assigned_team, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, targetEndDate, assignedTeam, status, userId]
        );
        
        // Get the inserted record using LAST_INSERT_ID()
        const [rows] = await db.query('SELECT * FROM projects WHERE id = LAST_INSERT_ID()');
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
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
                // Convert camelCase to snake_case and escape with backticks
                const dbField = fieldMapping[key] || key;
                updateFields.push(`\`${dbField}\` = ?`);
                updateValues.push(updateData[key]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Add updated_at timestamp (date only)
        updateFields.push('`updated_at` = ?');
        updateValues.push(new Date().toISOString().split('T')[0]);
        
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

        const [rows] = await db.query('SELECT * FROM risk_register WHERE is_archived = 0 ORDER BY created_at DESC');
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

        const { riskDescription, status, requiredAction } = req.body;
        const userId = req.user.id;

        // MySQL: Insert without RETURNING
        await db.query(
            'INSERT INTO risk_register (risk_description, status, required_action, created_by) VALUES (?, ?, ?, ?)',
            [riskDescription, status, requiredAction, userId]
        );
        
        // Get the inserted record
        const [rows] = await db.query('SELECT * FROM risk_register WHERE id = LAST_INSERT_ID()');
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Create risk error:', error);
        res.status(500).json({ error: 'Failed to create risk' });
    }
});

// Critical Tasks
router.get('/critical-tasks', authenticateToken, async (req, res) => {
    try {
        const db = getDb(req);
        if (!db) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const [rows] = await db.query('SELECT * FROM critical_tasks WHERE is_archived = 0 ORDER BY created_at DESC');
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

module.exports = router;

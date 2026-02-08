// Critical Tasks Management Module
class CriticalTasksManager {
    constructor(database) {
        this.db = database;
        this.currentPriorityFilter = '';
        this.currentStatusFilter = '';
        this.showArchived = false;
    }

    async init() {
        this.attachEventListeners();
        await this.loadCriticalTasks();
        this.initialized = true;
        console.log('Critical Tasks manager initialized');
    }

    attachEventListeners() {
        console.log('Attaching critical tasks event listeners...');
        
        // Add critical task button
        const addBtn = document.getElementById('addCriticalTaskBtn');
        if (addBtn) {
            console.log('Attaching Add Critical Task button');
            addBtn.addEventListener('click', () => {
                console.log('Add Critical Task button clicked');
                this.showCriticalTaskModal();
            });
        } else {
            console.warn('Add Critical Task button not found');
        }

        // Priority filter
        const priorityFilter = document.getElementById('criticalPriorityFilter');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', async (e) => {
                this.currentPriorityFilter = e.target.value;
                await this.loadCriticalTasks();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('criticalStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                this.currentStatusFilter = e.target.value;
                await this.loadCriticalTasks();
            });
        }

        // Show archived toggle
        const showArchivedBtn = document.getElementById('showArchivedCritical');
        if (showArchivedBtn) {
            showArchivedBtn.addEventListener('click', async () => {
                this.showArchived = !this.showArchived;
                showArchivedBtn.innerHTML = this.showArchived ? 
                    '<i class="fas fa-eye"></i> Hide Archived' : 
                    '<i class="fas fa-archive"></i> Show Archived';
                showArchivedBtn.classList.toggle('btn-warning', this.showArchived);
                showArchivedBtn.classList.toggle('btn-secondary', !this.showArchived);
                await this.loadCriticalTasks();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportCriticalTasksBtn');
        if (exportBtn) {
            console.log('Attaching Export Critical Tasks button');
            exportBtn.addEventListener('click', async () => {
                console.log('Export Critical Tasks button clicked');
                await this.exportCriticalTasks();
            });
        } else {
            console.warn('Export Critical Tasks button not found');
        }
    }

    async exportCriticalTasks() {
        try {
            let where = [];
            let params = [];

            if (!this.showArchived) {
                where.push('is_archived = 0');
            }

            if (this.currentPriorityFilter) {
                where.push('priority = ?');
                params.push(this.currentPriorityFilter);
            }

            if (this.currentStatusFilter) {
                where.push('status = ?');
                params.push(this.currentStatusFilter);
            }

            const whereClause = where.length > 0 ? where.join(' AND ') : '';
            const tasks = await this.db.select('critical_tasks', whereClause, params, 'created_at DESC');

            if (tasks.length === 0) {
                this.showError('No critical tasks to export');
                return;
            }

            let csv = 'CRITICAL TASKS EXPORT\n';
            csv += 'Title,Priority,Description,Assigned Team,Status,Created Date\n';

            for (const task of tasks) {
                csv += `"${this.escapeCsv(task.title)}",${task.priority || 'Medium'},"${this.escapeCsv(task.description)}","${this.escapeCsv(task.assigned_team)}",${task.status || 'Open'},${task.created_at || ''}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `critical-tasks-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Critical tasks exported successfully');
        } catch (error) {
            console.error('Error exporting critical tasks:', error);
            this.showError('Failed to export critical tasks');
        }
    }

    async loadCriticalTasks() {
        try {
            // Use API directly to support archived parameter
            let tasks = [];
            
            if (window.isOfflineMode) {
                tasks = await window.offlineApi.getCriticalTasks(this.showArchived);
            } else {
                tasks = await window.api.getCriticalTasks(this.showArchived);
            }
            
            // Apply filters client-side
            if (this.currentPriorityFilter) {
                tasks = tasks.filter(t => t.priority === this.currentPriorityFilter);
            }
            if (this.currentStatusFilter) {
                tasks = tasks.filter(t => t.status === this.currentStatusFilter);
            }
            
            this.renderCriticalTasks(tasks);
        } catch (error) {
            console.error('Error loading critical tasks:', error);
            this.showError('Failed to load critical tasks');
        }
    }

            if (this.currentPriorityFilter) {
                where.push('priority = ?');
                params.push(this.currentPriorityFilter);
            }

            if (this.currentStatusFilter) {
                where.push('status = ?');
                params.push(this.currentStatusFilter);
            }

            const whereClause = where.length > 0 ? where.join(' AND ') : '';
            
            const tasks = await this.db.select('critical_tasks', whereClause, params, 
                `CASE 
                    WHEN priority = 'Critical' THEN 1
                    WHEN priority = 'High' THEN 2
                    WHEN priority = 'Medium' THEN 3
                    WHEN priority = 'Low' THEN 4
                    ELSE 5
                END, created_at DESC`
            );
            this.renderCriticalTasks(tasks);
        } catch (error) {
            console.error('Error loading critical tasks:', error);
            this.showError('Failed to load critical tasks');
        }
    }

    renderCriticalTasks(tasks) {
        const tbody = document.getElementById('criticalTasksTableBody');
        
        if (tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div>
                            <i class="fas fa-fire"></i>
                            <h3>${this.showArchived ? 'No critical tasks found' : 'No active critical tasks found'}</h3>
                            <p>${this.showArchived ? 
                                'No critical tasks (active or archived) match the current filters' : 
                                'Start by adding your first critical task'}</p>
                            <button class="btn btn-primary" onclick="criticalTasksManager.showCriticalTaskModal()">
                                <i class="fas fa-plus"></i> Add Critical Task
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = tasks.map(task => `
            <tr class="${task.is_archived ? 'archived-row' : ''}">
                <td>
                    <div class="task-title-container">
                        <strong>${this.escapeHtml(task.title)}</strong>
                        ${task.is_archived ? '<br><small class="text-muted"><i class="fas fa-archive"></i> Archived</small>' : ''}
                    </div>
                </td>
                <td>
                    <span class="badge badge-${this.getPriorityClass(task.priority)}">
                        ${task.priority || 'Medium'}
                    </span>
                </td>
                <td>${this.escapeHtml(task.description || '-')}</td>
                <td>${this.escapeHtml(task.assigned_team || '-')}</td>
                <td>
                    <span class="badge badge-${this.getStatusClass(task.status)}">
                        ${task.status || 'Open'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn critical-task-edit-btn" data-id="${task.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="archive-btn critical-task-archive-btn" data-id="${task.id}" data-archived="${task.is_archived}" 
                                title="${task.is_archived ? 'Unarchive' : 'Archive'}">
                            <i class="fas fa-${task.is_archived ? 'undo' : 'archive'}"></i>
                        </button>
                        <button class="delete-btn critical-task-delete-btn" data-id="${task.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Attach event listeners to action buttons
        setTimeout(() => {
            document.querySelectorAll('.critical-task-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.editCriticalTask(id);
                });
            });
            
            document.querySelectorAll('.critical-task-archive-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const isArchived = e.currentTarget.dataset.archived === '1';
                    this.toggleArchive(id, isArchived);
                });
            });
            
            document.querySelectorAll('.critical-task-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.deleteCriticalTask(id);
                });
            });
        }, 0);
    }

    showCriticalTaskModal(task = null) {
        const modalHtml = `
            <div class="modal" id="criticalTaskModal">
                <div class="modal-header">
                    <h3 class="modal-title">${task ? 'Edit Critical Task' : 'Add New Critical Task'}</h3>
                    <button class="modal-close" id="criticalTaskModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="criticalTaskForm">
                        <div class="form-group">
                            <label for="criticalTaskTitle">Task Title *</label>
                            <input type="text" id="criticalTaskTitle" class="form-control" required 
                                   value="${this.escapeHtml(task?.title || '')}" placeholder="Enter task title">
                        </div>
                        
                        <div class="form-group">
                            <label for="criticalTaskPriority">Priority *</label>
                            <select id="criticalTaskPriority" class="form-control" required>
                                <option value="">Select Priority</option>
                                <option value="Low" ${task?.priority === 'Low' ? 'selected' : ''}>Low</option>
                                <option value="Medium" ${task?.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="High" ${task?.priority === 'High' ? 'selected' : ''}>High</option>
                                <option value="Critical" ${task?.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="criticalTaskDescription">Description</label>
                            <textarea id="criticalTaskDescription" class="form-control" rows="4" 
                                      placeholder="Enter detailed description of the critical task">${this.escapeHtml(task?.description || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="criticalTaskTeam">Assigned Team</label>
                            <input type="text" id="criticalTaskTeam" class="form-control" 
                                   value="${this.escapeHtml(task?.assigned_team || '')}" 
                                   placeholder="Enter team name or assignee">
                        </div>
                        
                        <div class="form-group">
                            <label for="criticalTaskStatus">Status</label>
                            <select id="criticalTaskStatus" class="form-control">
                                <option value="Open" ${task?.status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="In Progress" ${task?.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${task?.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <div class="form-check">
                                <input type="checkbox" id="criticalTaskArchived" class="form-check-input" 
                                       ${task?.is_archived ? 'checked' : ''}>
                                <label for="criticalTaskArchived" class="form-check-label">
                                    Archive this task (completed tasks can be archived)
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="criticalTaskModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="criticalTaskModalSave">
                        ${task ? 'Update Task' : 'Add Task'}
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.add('active');

        // Attach event listeners
        const taskId = task?.id || null;
        
        document.getElementById('criticalTaskModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('criticalTaskModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('criticalTaskModalSave').addEventListener('click', () => this.saveCriticalTask(taskId));

        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('criticalTaskTitle');
            if (titleInput) titleInput.focus();
        }, 100);

        // Auto-archive when status changes to completed
        const statusSelect = document.getElementById('criticalTaskStatus');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                const archivedCheckbox = document.getElementById('criticalTaskArchived');
                if (e.target.value === 'Completed') {
                    archivedCheckbox.checked = true;
                    archivedCheckbox.disabled = false;
                } else if (e.target.value !== 'Completed') {
                    archivedCheckbox.checked = false;
                    archivedCheckbox.disabled = false;
                }
            });
        }
    }

    async saveCriticalTask(taskId) {
        try {
            const formData = {
                title: document.getElementById('criticalTaskTitle').value.trim(),
                priority: document.getElementById('criticalTaskPriority').value,
                description: document.getElementById('criticalTaskDescription').value.trim(),
                assigned_team: document.getElementById('criticalTaskTeam').value.trim(),
                status: document.getElementById('criticalTaskStatus').value,
                is_archived: document.getElementById('criticalTaskArchived').checked ? 1 : 0
            };

            // Validation
            if (!formData.title) {
                this.showError('Task title is required');
                return;
            }

            if (!formData.priority) {
                this.showError('Priority is required');
                return;
            }

            // Auto-archive completed tasks
            if (formData.status === 'Completed') {
                formData.is_archived = 1;
            }

            if (taskId) {
                // Update existing task
                await this.db.update('critical_tasks', taskId, formData);
                this.showSuccess('Critical task updated successfully');
            } else {
                // Insert new task
                await this.db.insert('critical_tasks', formData);
                this.showSuccess('Critical task added successfully');
            }

            this.closeModal();
            await this.loadCriticalTasks();

            // Update dashboard if it's active (don't let dashboard errors break the save)
            try {
                if (window.dashboardManager && window.dashboardManager.updateDashboard) {
                    window.dashboardManager.updateDashboard();
                }
            } catch (dashboardError) {
                console.warn('Dashboard update failed (non-critical):', dashboardError);
            }

        } catch (error) {
            console.error('Error saving critical task:', error);
            this.showError('Failed to save critical task: ' + (error.message || 'Unknown error'));
        }
    }

    async editCriticalTask(taskId) {
        try {
            const tasks = await this.db.select('critical_tasks', 'id = ?', [taskId]);
            if (tasks.length > 0) {
                this.showCriticalTaskModal(tasks[0]);
            } else {
                this.showError('Critical task not found');
            }
        } catch (error) {
            console.error('Error loading critical task for edit:', error);
            this.showError('Failed to load critical task');
        }
    }

    async toggleArchive(taskId, currentlyArchived) {
        const action = currentlyArchived ? 'unarchive' : 'archive';
        const confirmMessage = currentlyArchived ? 
            'Are you sure you want to unarchive this task? It will appear in the active task list.' :
            'Are you sure you want to archive this task? It will no longer appear in the active task list.';
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await this.db.update('critical_tasks', taskId, { is_archived: currentlyArchived ? 0 : 1 });
            this.showSuccess(`Task ${action}d successfully`);
            await this.loadCriticalTasks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error(`Error ${action}ing critical task:`, error);
            this.showError(`Failed to ${action} critical task`);
        }
    }

    async deleteCriticalTask(taskId) {
        if (!confirm('Are you sure you want to delete this critical task? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.delete('critical_tasks', taskId);
            this.showSuccess('Critical task deleted successfully');
            await this.loadCriticalTasks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error('Error deleting critical task:', error);
            this.showError('Failed to delete critical task');
        }
    }

    getPriorityClass(priority) {
        switch (priority) {
            case 'Critical': return 'danger';
            case 'High': return 'warning';
            case 'Medium': return 'info';
            case 'Low': return 'success';
            default: return 'secondary';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'Open': return 'danger';
            case 'In Progress': return 'warning';
            case 'Completed': return 'success';
            default: return 'secondary';
        }
    }

    closeModal() {
        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = '';
        modalContainer.classList.remove('active');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to toast container
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        toastContainer.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Public methods for dashboard integration
    async getCriticalTasksStats() {
        try {
            const stats = await this.db.getDashboardStats();
            return stats.critical_tasks;
        } catch (error) {
            console.error('Error getting critical tasks stats:', error);
            return {
                total: 0,
                open: 0,
                inProgress: 0,
                byPriority: []
            };
        }
    }

    async getCriticalTasksChartData() {
        try {
            const result = await this.db.query(`
                SELECT priority, COUNT(*) as count 
                FROM critical_tasks 
                WHERE is_archived = 0
                GROUP BY priority
            `);
            return await this.db.formatQueryResult(result);
        } catch (error) {
            console.error('Error getting critical tasks chart data:', error);
            return [];
        }
    }

    // Method to get urgent tasks (high/critical priority and open status)
    async getUrgentTasks() {
        try {
            const tasks = await this.db.select(
                'critical_tasks', 
                'is_archived = 0 AND status IN ("Open", "In Progress") AND priority IN ("High", "Critical")',
                [],
                `CASE 
                    WHEN priority = 'Critical' THEN 1
                    WHEN priority = 'High' THEN 2
                    ELSE 3
                END, created_at DESC`
            );
            return tasks.slice(0, 5); // Return top 5 urgent tasks
        } catch (error) {
            console.error('Error getting urgent tasks:', error);
            return [];
        }
    }
}

// Add styles for task title container and archived rows
const criticalTasksStyles = document.createElement('style');
criticalTasksStyles.textContent = `
    .task-title-container {
        max-width: 250px;
    }
    
    .archived-row {
        opacity: 0.6;
        background-color: var(--bg-tertiary);
    }
    
    .archived-row td {
        color: var(--text-tertiary);
    }
    
    .form-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    
    .form-check-input {
        width: 18px;
        height: 18px;
        cursor: pointer;
    }
    
    .form-check-label {
        cursor: pointer;
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }
`;
document.head.appendChild(criticalTasksStyles);

// Initialize critical tasks manager when database is ready
async function initCriticalTasksManager() {
    console.log('=== initCriticalTasksManager() START ===');
    
    try {
        // Wait for database to be ready
        if (window.dbManager && window.dbManager.ready) {
            console.log('Waiting for database...');
            await window.dbManager.ready;
            console.log('Database ready!');
        } else {
            console.log('WARNING: window.dbManager not available');
            return;
        }
        
        if (window.dbManager) {
            console.log('Creating CriticalTasksManager...');
            window.criticalTasksManager = new CriticalTasksManager(window.dbManager);
            console.log('Critical tasks manager CREATED and assigned to window.criticalTasksManager');
            
            // Initialize the manager fully
            console.log('Initializing CriticalTasksManager...');
            await window.criticalTasksManager.init();
            console.log('CriticalTasksManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initCriticalTasksManager:', error);
    }
    
    console.log('=== initCriticalTasksManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initCriticalTasksManager');
    initCriticalTasksManager();
});
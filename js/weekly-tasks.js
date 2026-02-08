// Weekly Tasks Management Module
class WeeklyTasksManager {
    constructor(database) {
        this.db = database;
        this.currentWeek = null;
        this.currentYear = null;
    }

    async init() {
        this.attachEventListeners();
        this.setCurrentWeek();
        await this.loadWeeklyTasks();
        this.initialized = true;
        console.log('Weekly Tasks manager initialized');
    }

    attachEventListeners() {
        console.log('Attaching weekly tasks event listeners...');
        
        // Add weekly task button
        const addBtn = document.getElementById('addWeeklyTaskBtn');
        if (addBtn) {
            console.log('Attaching Add Weekly Task button');
            addBtn.addEventListener('click', () => {
                console.log('Add Weekly Task button clicked');
                this.showWeeklyTaskModal();
            });
        } else {
            console.warn('Add Weekly Task button not found');
        }

        // Export button
        const exportBtn = document.getElementById('exportWeeklyTasksBtn');
        if (exportBtn) {
            console.log('Attaching Export Weekly Tasks button');
            exportBtn.addEventListener('click', async () => {
                console.log('Export Weekly Tasks button clicked');
                await this.exportWeeklyTasks();
            });
        } else {
            console.warn('Export Weekly Tasks button not found');
        }
    }

    async exportWeeklyTasks() {
        try {
            const tasks = await this.db.select(
                'weekly_tasks',
                'week_number = ? AND year = ?',
                [this.currentWeek, this.currentYear],
                'created_at ASC'
            );

            if (tasks.length === 0) {
                this.showError('No weekly tasks to export');
                return;
            }

            let csv = 'WEEKLY TASKS EXPORT\n';
            csv += 'Title,Assigned Team,Progress,Week Number,Year,Created Date\n';

            tasks.forEach(task => {
                const checklist = this.parseChecklist(task.checklist);
                const completedItems = checklist.filter(item => item.completed).length;
                const totalItems = checklist.length;
                const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                csv += `"${this.escapeCsv(task.title)}","${this.escapeCsv(task.assigned_team)}",${progressPercentage}%,${task.week_number || ''},${task.year || ''},${task.created_at || ''}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `weekly-tasks-week${this.currentWeek}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Weekly tasks exported successfully');
        } catch (error) {
            console.error('Error exporting weekly tasks:', error);
            this.showError('Failed to export weekly tasks');
        }
    }

    setCurrentWeek() {
        const now = new Date();
        this.currentWeek = this.getWeekNumber(now);
        this.currentYear = now.getFullYear();
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    async loadWeeklyTasks() {
        try {
            const tasks = await this.db.select(
                'weekly_tasks', 
                'week_number = ? AND year = ?', 
                [this.currentWeek, this.currentYear],
                'created_at ASC'
            );
            this.renderWeeklyTasks(tasks);
        } catch (error) {
            console.error('Error loading weekly tasks:', error);
            this.showError('Failed to load weekly tasks');
        }
    }

    renderWeeklyTasks(tasks) {
        const tbody = document.getElementById('weeklyTasksTableBody');
        
        if (tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div>
                            <i class="fas fa-calendar-week"></i>
                            <h3>No weekly tasks found</h3>
                            <p>Create tasks for week ${this.currentWeek} of ${this.currentYear}</p>
                            <button class="btn btn-primary" onclick="weeklyTasksManager.showWeeklyTaskModal()">
                                <i class="fas fa-plus"></i> Add Weekly Task
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = tasks.map(task => {
            const checklist = this.parseChecklist(task.checklist);
            const completedItems = checklist.filter(item => item.completed).length;
            const totalItems = checklist.length;
            const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return `
                <tr>
                    <td><strong>${this.escapeHtml(task.title)}</strong></td>
                    <td>${this.escapeHtml(task.assigned_team || '-')}</td>
                    <td>
                        <div class="checklist-preview">
                            ${this.renderMiniChecklist(checklist, task.id)}
                        </div>
                    </td>
                    <td>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${progressPercentage}%"></div>
                        </div>
                        <small>${completedItems}/${totalItems} completed (${progressPercentage}%)</small>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="(async () => { await weeklyTasksManager.editWeeklyTask(${task.id}); })()" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn" onclick="(async () => { await weeklyTasksManager.deleteWeeklyTask(${task.id}); })()" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderMiniChecklist(checklist, taskId) {
        if (checklist.length === 0) {
            return '<small class="text-muted">No checklist items</small>';
        }

        return `
            <div class="mini-checklist">
                ${checklist.slice(0, 3).map(item => `
                    <div class="mini-checklist-item">
                        <i class="fas fa-${item.completed ? 'check-square' : 'square'}"></i>
                        <span>${this.escapeHtml(item.text)}</span>
                    </div>
                `).join('')}
                ${checklist.length > 3 ? `<small class="text-muted">+${checklist.length - 3} more...</small>` : ''}
            </div>
        `;
    }

    showWeeklyTaskModal(task = null) {
        const checklist = task ? this.parseChecklist(task.checklist) : [];
        
        const modalHtml = `
            <div class="modal" id="weeklyTaskModal">
                <div class="modal-header">
                    <h3 class="modal-title">${task ? 'Edit Weekly Task' : 'Add New Weekly Task'}</h3>
                    <button class="modal-close" id="weeklyTaskModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="weeklyTaskForm">
                        <div class="form-group">
                            <label for="weeklyTaskTitle">Task Title *</label>
                            <input type="text" id="weeklyTaskTitle" class="form-control" required 
                                   value="${this.escapeHtml(task?.title || '')}" placeholder="Enter task title">
                        </div>
                        
                        <div class="form-group">
                            <label for="weeklyTaskTeam">Assigned Team</label>
                            <input type="text" id="weeklyTaskTeam" class="form-control" 
                                   value="${this.escapeHtml(task?.assigned_team || '')}" 
                                   placeholder="Enter team name or assignee">
                        </div>
                        
                        <div class="form-group">
                            <label>Checklist Items</label>
                            <div id="checklistContainer">
                                ${checklist.map((item, index) => `
                                    <div class="checklist-item-row" data-index="${index}">
                                        <input type="checkbox" id="checkItem_${index}" ${item.completed ? 'checked' : ''}>
                                        <input type="text" class="form-control checklist-item-input" 
                                               value="${this.escapeHtml(item.text)}" placeholder="Checklist item">
                                        <button type="button" class="btn btn-danger btn-sm checklist-remove-btn" data-index="${index}">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" id="addChecklistItemBtn">
                                <i class="fas fa-plus"></i> Add Checklist Item
                            </button>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="weeklyTaskModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="weeklyTaskModalSave">
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
        
        document.getElementById('weeklyTaskModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('weeklyTaskModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('weeklyTaskModalSave').addEventListener('click', () => this.saveWeeklyTask(taskId));
        
        // Checklist item add button
        document.getElementById('addChecklistItemBtn').addEventListener('click', () => this.addChecklistItem());

        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('weeklyTaskTitle');
            if (titleInput) titleInput.focus();
        }, 100);

        // If no checklist items, add one empty item by default
        if (checklist.length === 0) {
            setTimeout(() => {
                this.addChecklistItem();
            }, 100);
        }
        
        // Attach remove listeners to existing items
        this.attachChecklistRemoveListeners();
    }

    addChecklistItem() {
        const container = document.getElementById('checklistContainer');
        const index = container.children.length;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'checklist-item-row';
        itemRow.dataset.index = index;
        itemRow.innerHTML = `
            <input type="checkbox" id="checkItem_${index}">
            <input type="text" class="form-control checklist-item-input" placeholder="Checklist item">
            <button type="button" class="btn btn-danger btn-sm checklist-remove-btn" data-index="${index}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(itemRow);
        
        // Attach remove listener to the new button
        const removeBtn = itemRow.querySelector('.checklist-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeChecklistItem(index));
        }
    }

    attachChecklistRemoveListeners() {
        const container = document.getElementById('checklistContainer');
        if (!container) return;
        
        container.querySelectorAll('.checklist-remove-btn').forEach(btn => {
            const index = parseInt(btn.dataset.index);
            btn.addEventListener('click', () => this.removeChecklistItem(index));
        });
    }

    removeChecklistItem(index) {
        const container = document.getElementById('checklistContainer');
        const itemRow = container.querySelector(`[data-index="${index}"]`);
        if (itemRow) {
            itemRow.remove();
            // Re-index remaining items
            Array.from(container.children).forEach((child, newIndex) => {
                child.dataset.index = newIndex;
                const checkbox = child.querySelector('input[type="checkbox"]');
                const input = child.querySelector('input[type="text"]');
                const button = child.querySelector('button');
                
                checkbox.id = `checkItem_${newIndex}`;
                button.dataset.index = newIndex;
                // Remove old listener and add new one
                const newBtn = button.cloneNode(true);
                button.parentNode.replaceChild(newBtn, button);
                newBtn.addEventListener('click', () => this.removeChecklistItem(newIndex));
            });
        }
    }

    collectChecklistData() {
        const container = document.getElementById('checklistContainer');
        const checklistItems = [];
        
        Array.from(container.children).forEach((child) => {
            const checkbox = child.querySelector('input[type="checkbox"]');
            const input = child.querySelector('input[type="text"]');
            
            if (input && input.value.trim()) {
                checklistItems.push({
                    text: input.value.trim(),
                    completed: checkbox.checked
                });
            }
        });
        
        return checklistItems;
    }

    async saveWeeklyTask(taskId) {
        try {
            const checklist = this.collectChecklistData();
            
            const formData = {
                title: document.getElementById('weeklyTaskTitle').value.trim(),
                assigned_team: document.getElementById('weeklyTaskTeam').value.trim(),
                checklist: JSON.stringify(checklist),
                week_number: this.currentWeek,
                year: this.currentYear
            };

            // Validation
            if (!formData.title) {
                this.showError('Task title is required');
                return;
            }

            if (checklist.length === 0) {
                this.showError('At least one checklist item is required');
                return;
            }

            if (taskId) {
                // Update existing task
                await this.db.update('weekly_tasks', taskId, formData);
                this.showSuccess('Weekly task updated successfully');
            } else {
                // Insert new task
                await this.db.insert('weekly_tasks', formData);
                this.showSuccess('Weekly task added successfully');
            }

            this.closeModal();
            await this.loadWeeklyTasks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }

        } catch (error) {
            console.error('Error saving weekly task:', error);
            this.showError('Failed to save weekly task');
        }
    }

    async editWeeklyTask(taskId) {
        try {
            const tasks = await this.db.select('weekly_tasks', 'id = ?', [taskId]);
            if (tasks.length > 0) {
                this.showWeeklyTaskModal(tasks[0]);
            } else {
                this.showError('Weekly task not found');
            }
        } catch (error) {
            console.error('Error loading weekly task for edit:', error);
            this.showError('Failed to load weekly task');
        }
    }

    async deleteWeeklyTask(taskId) {
        if (!confirm('Are you sure you want to delete this weekly task? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.delete('weekly_tasks', taskId);
            this.showSuccess('Weekly task deleted successfully');
            await this.loadWeeklyTasks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error('Error deleting weekly task:', error);
            this.showError('Failed to delete weekly task');
        }
    }

    parseChecklist(checklistString) {
        try {
            return checklistString ? JSON.parse(checklistString) : [];
        } catch (error) {
            console.error('Error parsing checklist:', error);
            return [];
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
    async getWeeklyTasksStats() {
        try {
            const stats = await this.db.getDashboardStats();
            return stats.weekly_tasks;
        } catch (error) {
            console.error('Error getting weekly tasks stats:', error);
            return {
                total: 0,
                thisWeek: 0
            };
        }
    }

    // Method to create recurring tasks for new week
    createRecurringTasksForNewWeek() {
        // This can be enhanced to copy tasks from previous week
        console.log('Creating recurring tasks for new week');
    }
}

// Add styles for checklist items
const checklistStyles = document.createElement('style');
checklistStyles.textContent = `
    .checklist-preview {
        max-width: 300px;
    }
    
    .mini-checklist {
        font-size: 0.8rem;
    }
    
    .mini-checklist-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .mini-checklist-item i {
        color: var(--success-color);
        flex-shrink: 0;
    }
    
    .checklist-item-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }
    
    .checklist-item-row input[type="checkbox"] {
        flex-shrink: 0;
    }
    
    .checklist-item-row .form-control {
        flex: 1;
    }
    
    .checklist-item-row .btn-sm {
        flex-shrink: 0;
    }
`;
document.head.appendChild(checklistStyles);

// Initialize weekly tasks manager when database is ready
async function initWeeklyTasksManager() {
    console.log('=== initWeeklyTasksManager() START ===');
    
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
            console.log('Creating WeeklyTasksManager...');
            window.weeklyTasksManager = new WeeklyTasksManager(window.dbManager);
            console.log('Weekly tasks manager CREATED and assigned to window.weeklyTasksManager');
            
            // Initialize the manager fully
            console.log('Initializing WeeklyTasksManager...');
            await window.weeklyTasksManager.init();
            console.log('WeeklyTasksManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initWeeklyTasksManager:', error);
    }
    
    console.log('=== initWeeklyTasksManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initWeeklyTasksManager');
    initWeeklyTasksManager();
});
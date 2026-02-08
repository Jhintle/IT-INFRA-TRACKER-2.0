// Projects Management Module
class ProjectsManager {
    constructor(database) {
        this.db = database;
        this.currentFilter = '';
        this.currentStatus = '';
    }

    async init() {
        this.attachEventListeners();
        await this.loadProjects();
        this.initialized = true;
        console.log('Projects manager initialized');
    }

    attachEventListeners() {
        console.log('Attaching projects event listeners...');
        
        // Add project button
        const addBtn = document.getElementById('addProjectBtn');
        if (addBtn) {
            console.log('Attaching Add Project button');
            addBtn.addEventListener('click', () => {
                console.log('Add Project button clicked');
                this.showProjectModal();
            });
        } else {
            console.warn('Add Project button not found');
        }

        // Export button
        const exportBtn = document.getElementById('exportProjectsBtn');
        if (exportBtn) {
            console.log('Attaching Export Projects button');
            exportBtn.addEventListener('click', () => {
                console.log('Export Projects button clicked');
                this.exportProjects();
            });
        } else {
            console.warn('Export Projects button not found');
        }

        // Status filter
        const statusFilter = document.getElementById('projectStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentStatus = e.target.value;
                this.loadProjects();
            });
        }

        // Modal close handlers will be set up in showProjectModal
    }

    async exportProjects() {
        try {
            let where = '';
            let params = [];

            if (this.currentStatus) {
                where = 'status = ?';
                params = [this.currentStatus];
            }

            const projects = await this.db.select('projects', where, params, 'created_at DESC');
            
            if (projects.length === 0) {
                this.showError('No projects to export');
                return;
            }

            let csv = 'PROJECTS EXPORT\n';
            csv += 'Title,Description,Target End Date,Completion %,Assigned Team,Status,Created Date\n';
            
            projects.forEach(project => {
                csv += `"${this.escapeCsv(project.title)}","${this.escapeCsv(project.description)}",${project.target_end_date || ''},${project.completion_percentage || 0}%,"${this.escapeCsv(project.assigned_team)}",${project.status || 'Active'},${project.created_at || ''}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `projects-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Projects exported successfully');
        } catch (error) {
            console.error('Error exporting projects:', error);
            this.showError('Failed to export projects');
        }
    }

    escapeCsv(text) {
        if (!text) return '';
        return String(text).replace(/"/g, '""');
    }

    async loadProjects() {
        try {
            let where = '';
            let params = [];

            if (this.currentStatus) {
                where = 'status = ?';
                params = [this.currentStatus];
            }

            const projects = await this.db.select('projects', where, params, 'created_at DESC');
            this.renderProjects(projects);
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showError('Failed to load projects');
        }
    }

    renderProjects(projects) {
        const tbody = document.getElementById('projectsTableBody');
        
        // Use requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
            if (projects.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <div>
                                <i class="fas fa-project-diagram"></i>
                                <h3>No projects found</h3>
                                <p>Start by adding your first project</p>
                                <button class="btn btn-primary" onclick="projectsManager.showProjectModal()">
                                    <i class="fas fa-plus"></i> Add Project
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            // Build HTML string first, then update DOM once
            const html = projects.map(project => `
                <tr>
                    <td><strong>${this.escapeHtml(project.title)}</strong></td>
                    <td>${this.escapeHtml(project.description || '-')}</td>
                    <td>${this.formatDate(project.target_end_date)}</td>
                    <td>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${project.completion_percentage || 0}%"></div>
                        </div>
                        <small>${project.completion_percentage || 0}%</small>
                    </td>
                    <td>${this.escapeHtml(project.assigned_team || '-')}</td>
                    <td>
                        <span class="badge badge-${this.getStatusClass(project.status)}">
                            ${project.status || 'Active'}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="edit-btn project-edit-btn" data-id="${project.id}" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn project-delete-btn" data-id="${project.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
            
            tbody.innerHTML = html;
            
            // Attach event listeners to edit and delete buttons
            setTimeout(() => {
                tbody.querySelectorAll('.project-edit-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        this.editProject(id);
                    });
                });
                
                tbody.querySelectorAll('.project-delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        this.deleteProject(id);
                    });
                });
            }, 0);
        });
    }

    showProjectModal(project = null) {
        const modalHtml = `
            <div class="modal" id="projectModal">
                <div class="modal-header">
                    <h3 class="modal-title">${project ? 'Edit Project' : 'Add New Project'}</h3>
                    <button class="modal-close" id="projectModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="projectForm">
                        <div class="form-group">
                            <label for="projectTitle">Project Title *</label>
                            <input type="text" id="projectTitle" class="form-control" required 
                                   value="${this.escapeHtml(project?.title || '')}" placeholder="Enter project title">
                        </div>
                        
                        <div class="form-group">
                            <label for="projectDescription">Description</label>
                            <textarea id="projectDescription" class="form-control" rows="3" 
                                      placeholder="Enter project description">${this.escapeHtml(project?.description || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="projectEndDate">Target End Date</label>
                            <input type="date" id="projectEndDate" class="form-control" 
                                   value="${project?.target_end_date || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="projectCompletion">Completion Percentage</label>
                            <input type="range" id="projectCompletion" class="form-control" 
                                   min="0" max="100" value="${project?.completion_percentage || 0}">
                            <small>Current: <span id="completionValue">${project?.completion_percentage || 0}%</span></small>
                        </div>
                        
                        <div class="form-group">
                            <label for="projectTeam">Assigned Team</label>
                            <input type="text" id="projectTeam" class="form-control" 
                                   value="${this.escapeHtml(project?.assigned_team || '')}" 
                                   placeholder="Enter team name or assignee">
                        </div>
                        
                        <div class="form-group">
                            <label for="projectStatus">Status</label>
                            <select id="projectStatus" class="form-control">
                                <option value="Active" ${project?.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="On Hold" ${project?.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                <option value="Completed" ${project?.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="projectModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="projectModalSave">
                        ${project ? 'Update Project' : 'Add Project'}
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.add('active');

        // Attach event listeners
        const projectId = project?.id || null;
        
        document.getElementById('projectModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('projectModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('projectModalSave').addEventListener('click', () => this.saveProject(projectId));
        
        // Range input listener
        document.getElementById('projectCompletion').addEventListener('input', (e) => {
            document.getElementById('completionValue').textContent = e.target.value + '%';
        });

        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('projectTitle');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    async saveProject(projectId) {
        try {
            const formData = {
                title: document.getElementById('projectTitle').value.trim(),
                description: document.getElementById('projectDescription').value.trim(),
                target_end_date: document.getElementById('projectEndDate').value,
                completion_percentage: parseInt(document.getElementById('projectCompletion').value),
                assigned_team: document.getElementById('projectTeam').value.trim(),
                status: document.getElementById('projectStatus').value
            };

            // Validation
            if (!formData.title) {
                this.showError('Project title is required');
                return;
            }

            if (projectId) {
                // Update existing project
                await this.db.update('projects', projectId, formData);
                this.showSuccess('Project updated successfully');
            } else {
                // Insert new project
                await this.db.insert('projects', formData);
                this.showSuccess('Project added successfully');
            }

            this.closeModal();
            await this.loadProjects();

            // Update dashboard if it's active (don't let dashboard errors break the save)
            try {
                if (window.dashboardManager && window.dashboardManager.updateDashboard) {
                    window.dashboardManager.updateDashboard();
                }
            } catch (dashboardError) {
                console.warn('Dashboard update failed (non-critical):', dashboardError);
            }

        } catch (error) {
            console.error('Error saving project:', error);
            this.showError('Failed to save project: ' + (error.message || 'Unknown error'));
        }
    }

    async editProject(projectId) {
        try {
            const projects = await this.db.select('projects', 'id = ?', [projectId]);
            if (projects.length > 0) {
                this.showProjectModal(projects[0]);
            } else {
                this.showError('Project not found');
            }
        } catch (error) {
            console.error('Error loading project for edit:', error);
            this.showError('Failed to load project');
        }
    }

    async deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.delete('projects', projectId);
            this.showSuccess('Project deleted successfully');
            await this.loadProjects();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Failed to delete project');
        }
    }

    closeModal() {
        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = '';
        modalContainer.classList.remove('active');
    }

    getStatusClass(status) {
        switch (status) {
            case 'Active': return 'success';
            case 'On Hold': return 'warning';
            case 'Completed': return 'info';
            default: return 'secondary';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
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
    async getProjectStats() {
        try {
            const stats = await this.db.getDashboardStats();
            return stats.projects;
        } catch (error) {
            console.error('Error getting project stats:', error);
            return {
                total: 0,
                active: 0,
                completed: 0,
                onHold: 0
            };
        }
    }

    async getProjectChartData() {
        try {
            const result = await this.db.query(`
                SELECT status, COUNT(*) as count 
                FROM projects 
                GROUP BY status
            `);
            return this.db.formatQueryResult(result);
        } catch (error) {
            console.error('Error getting project chart data:', error);
            return [];
        }
    }
}

// Add slide out animation for toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

// Initialize projects manager when database is ready
async function initProjectsManager() {
    console.log('=== initProjectsManager() START ===');
    
    try {
        // Wait for database to be ready
        if (window.dbManager && window.dbManager.ready) {
            console.log('Waiting for database...');
            await window.dbManager.ready;
            console.log('Database ready!');
        } else {
            console.log('WARNING: window.dbManager or window.dbManager.ready not available');
            console.log('window.dbManager:', window.dbManager);
            return;
        }
        
        if (window.dbManager) {
            console.log('Creating ProjectsManager...');
            window.projectsManager = new ProjectsManager(window.dbManager);
            console.log('Projects manager CREATED and assigned to window.projectsManager');
            
            // Initialize the manager fully
            console.log('Initializing ProjectsManager...');
            await window.projectsManager.init();
            console.log('ProjectsManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initProjectsManager:', error);
    }
    
    console.log('=== initProjectsManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initProjectsManager');
    initProjectsManager();
});
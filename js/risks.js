// Risk Register Management Module
class RisksManager {
    constructor(database) {
        this.db = database;
        this.currentStatusFilter = '';
        this.showArchived = false;
    }

    async init() {
        this.attachEventListeners();
        await this.loadRisks();
        this.initialized = true;
        console.log('Risks manager initialized');
    }

    attachEventListeners() {
        console.log('Attaching risks event listeners...');
        
        // Add risk button
        const addBtn = document.getElementById('addRiskBtn');
        if (addBtn) {
            console.log('Attaching Add Risk button');
            addBtn.addEventListener('click', () => {
                console.log('Add Risk button clicked');
                this.showRiskModal();
            });
        } else {
            console.warn('Add Risk button not found');
        }

        // Status filter
        const statusFilter = document.getElementById('riskStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                this.currentStatusFilter = e.target.value;
                await this.loadRisks();
            });
        }

        // Show archived toggle
        const showArchivedBtn = document.getElementById('showArchivedRisks');
        if (showArchivedBtn) {
            showArchivedBtn.addEventListener('click', async () => {
                this.showArchived = !this.showArchived;
                showArchivedBtn.innerHTML = this.showArchived ? 
                    '<i class="fas fa-eye"></i> Hide Archived' : 
                    '<i class="fas fa-archive"></i> Show Archived';
                showArchivedBtn.classList.toggle('btn-warning', this.showArchived);
                showArchivedBtn.classList.toggle('btn-secondary', !this.showArchived);
                await this.loadRisks();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportRisksBtn');
        if (exportBtn) {
            console.log('Attaching Export Risks button');
            exportBtn.addEventListener('click', async () => {
                console.log('Export Risks button clicked');
                await this.exportRisks();
            });
        } else {
            console.warn('Export Risks button not found');
        }
    }

    async exportRisks() {
        try {
            let where = [];
            let params = [];

            if (!this.showArchived) {
                where.push('is_archived = 0');
            }

            if (this.currentStatusFilter) {
                where.push('status = ?');
                params.push(this.currentStatusFilter);
            }

            const whereClause = where.length > 0 ? where.join(' AND ') : '';
            const risks = await this.db.select('risk_register', whereClause, params, 'created_at DESC');

            if (risks.length === 0) {
                this.showError('No risks to export');
                return;
            }

            let csv = 'RISK REGISTER EXPORT\n';
            csv += 'Risk Description,Status,Required Action,Created Date\n';

            for (const risk of risks) {
                csv += `"${this.escapeCsv(risk.risk_description)}",${risk.status || 'Active'},"${this.escapeCsv(risk.required_action)}",${risk.created_at || ''}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `risk-register-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Risks exported successfully');
        } catch (error) {
            console.error('Error exporting risks:', error);
            this.showError('Failed to export risks');
        }
    }

    async loadRisks() {
        try {
            // Use API directly to support archived parameter
            let risks = [];
            
            if (window.isOfflineMode) {
                risks = await window.offlineApi.getRisks(this.showArchived);
            } else {
                risks = await window.api.getRisks(this.showArchived);
            }
            
            // Apply status filter client-side if needed
            if (this.currentStatusFilter) {
                risks = risks.filter(r => r.status === this.currentStatusFilter);
            }
            
            this.renderRisks(risks);
        } catch (error) {
            console.error('Error loading risks:', error);
            this.showError('Failed to load risks');
        }
    }

    renderRisks(risks) {
        const tbody = document.getElementById('risksTableBody');
        
        if (risks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <div>
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>${this.showArchived ? 'No risks found' : 'No active risks found'}</h3>
                            <p>${this.showArchived ? 
                                'No risks (active or archived) match the current filters' : 
                                'Start by adding your first risk to the register'}</p>
                            <button class="btn btn-primary" onclick="risksManager.showRiskModal()">
                                <i class="fas fa-plus"></i> Add Risk
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = risks.map(risk => `
            <tr class="${risk.is_archived ? 'archived-row' : ''}">
                <td>
                    <div>
                        <strong>${this.escapeHtml(risk.risk_description)}</strong>
                        ${risk.is_archived ? '<br><small class="text-muted"><i class="fas fa-archive"></i> Archived</small>' : ''}
                    </div>
                </td>
                <td>
                    <span class="badge badge-${this.getStatusClass(risk.status)}">
                        ${risk.status || 'Active'}
                    </span>
                </td>
                <td>${this.escapeHtml(risk.required_action || '-')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn risk-edit-btn" data-id="${risk.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="archive-btn risk-archive-btn" data-id="${risk.id}" data-archived="${risk.is_archived}" 
                                title="${risk.is_archived ? 'Unarchive' : 'Archive'}">
                            <i class="fas fa-${risk.is_archived ? 'undo' : 'archive'}"></i>
                        </button>
                        <button class="delete-btn risk-delete-btn" data-id="${risk.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Attach event listeners to action buttons
        setTimeout(() => {
            document.querySelectorAll('.risk-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.editRisk(id);
                });
            });
            
            document.querySelectorAll('.risk-archive-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const isArchived = e.currentTarget.dataset.archived === '1';
                    this.toggleArchive(id, isArchived);
                });
            });
            
            document.querySelectorAll('.risk-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.deleteRisk(id);
                });
            });
        }, 0);
    }

    showRiskModal(risk = null) {
        const modalHtml = `
            <div class="modal" id="riskModal">
                <div class="modal-header">
                    <h3 class="modal-title">${risk ? 'Edit Risk' : 'Add New Risk'}</h3>
                    <button class="modal-close" id="riskModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="riskForm">
                        <div class="form-group">
                            <label for="riskDescription">Risk Description *</label>
                            <textarea id="riskDescription" class="form-control" rows="3" required 
                                      placeholder="Describe the risk in detail">${this.escapeHtml(risk?.risk_description || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="riskStatus">Status</label>
                            <select id="riskStatus" class="form-control">
                                <option value="Active" ${risk?.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="Monitoring" ${risk?.status === 'Monitoring' ? 'selected' : ''}>Monitoring</option>
                                <option value="Resolved" ${risk?.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="riskAction">Required Action</label>
                            <textarea id="riskAction" class="form-control" rows="3" 
                                      placeholder="Describe the required actions to mitigate or address this risk">${this.escapeHtml(risk?.required_action || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <div class="form-check">
                                <input type="checkbox" id="riskArchived" class="form-check-input" 
                                       ${risk?.is_archived ? 'checked' : ''}>
                                <label for="riskArchived" class="form-check-label">
                                    Archive this risk (no longer actively tracked)
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="riskModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="riskModalSave">
                        ${risk ? 'Update Risk' : 'Add Risk'}
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.add('active');

        // Attach event listeners
        const riskId = risk?.id || null;
        
        document.getElementById('riskModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('riskModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('riskModalSave').addEventListener('click', () => this.saveRisk(riskId));

        // Focus on description input
        setTimeout(() => {
            const descInput = document.getElementById('riskDescription');
            if (descInput) descInput.focus();
        }, 100);
    }

    async saveRisk(riskId) {
        try {
            const formData = {
                risk_description: document.getElementById('riskDescription').value.trim(),
                status: document.getElementById('riskStatus').value,
                required_action: document.getElementById('riskAction').value.trim(),
                is_archived: document.getElementById('riskArchived').checked ? 1 : 0
            };

            // Validation
            if (!formData.risk_description) {
                this.showError('Risk description is required');
                return;
            }

            if (riskId) {
                // Update existing risk
                await this.db.update('risk_register', riskId, formData);
                this.showSuccess('Risk updated successfully');
            } else {
                // Insert new risk
                await this.db.insert('risk_register', formData);
                this.showSuccess('Risk added successfully');
            }

            this.closeModal();
            await this.loadRisks();
            
            // Update dashboard if it's active (don't let dashboard errors break the save)
            try {
                if (window.dashboardManager && window.dashboardManager.updateDashboard) {
                    window.dashboardManager.updateDashboard();
                }
            } catch (dashboardError) {
                console.warn('Dashboard update failed (non-critical):', dashboardError);
            }

        } catch (error) {
            console.error('Error saving risk:', error);
            this.showError('Failed to save risk: ' + (error.message || 'Unknown error'));
        }
    }

    async editRisk(riskId) {
        try {
            const risks = await this.db.select('risk_register', 'id = ?', [riskId]);
            if (risks.length > 0) {
                this.showRiskModal(risks[0]);
            } else {
                this.showError('Risk not found');
            }
        } catch (error) {
            console.error('Error loading risk for edit:', error);
            this.showError('Failed to load risk');
        }
    }

    async toggleArchive(riskId, currentlyArchived) {
        const action = currentlyArchived ? 'unarchive' : 'archive';
        const confirmMessage = currentlyArchived ? 
            'Are you sure you want to unarchive this risk? It will appear in the active risk list.' :
            'Are you sure you want to archive this risk? It will no longer appear in the active risk list.';
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            await this.db.update('risk_register', riskId, { is_archived: currentlyArchived ? 0 : 1 });
            this.showSuccess(`Risk ${action}d successfully`);
            await this.loadRisks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error(`Error ${action}ing risk:`, error);
            this.showError(`Failed to ${action} risk`);
        }
    }

    async deleteRisk(riskId) {
        if (!confirm('Are you sure you want to delete this risk? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.delete('risk_register', riskId);
            this.showSuccess('Risk deleted successfully');
            await this.loadRisks();
            
            // Update dashboard if it's active
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error('Error deleting risk:', error);
            this.showError('Failed to delete risk');
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'Active': return 'danger';
            case 'Monitoring': return 'warning';
            case 'Resolved': return 'success';
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
    async getRiskStats() {
        try {
            const stats = await this.db.getDashboardStats();
            return stats.risks;
        } catch (error) {
            console.error('Error getting risk stats:', error);
            return {
                total: 0,
                active: 0,
                monitoring: 0
            };
        }
    }

    async getRiskChartData() {
        try {
            const result = await this.db.query(`
                SELECT status, COUNT(*) as count 
                FROM risk_register 
                WHERE is_archived = 0
                GROUP BY status
            `);
            return this.db.formatQueryResult(result);
        } catch (error) {
            console.error('Error getting risk chart data:', error);
            return [];
        }
    }

    // Method to get high-priority risks
    async getHighPriorityRisks() {
        try {
            const risks = await this.db.select(
                'risk_register', 
                'is_archived = 0 AND (status = "Active" OR status = "Monitoring")',
                [],
                'created_at DESC'
            );
            
            // For now, return all active risks. In a real implementation, 
            // you might want to add a priority field to the risk table
            return risks.slice(0, 5); // Return top 5 recent risks
        } catch (error) {
            console.error('Error getting high priority risks:', error);
            return [];
        }
    }
}

// Add styles for archived rows
const archivedStyles = document.createElement('style');
archivedStyles.textContent = `
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
document.head.appendChild(archivedStyles);

// Initialize risks manager when database is ready
async function initRisksManager() {
    console.log('=== initRisksManager() START ===');
    
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
            console.log('Creating RisksManager...');
            window.risksManager = new RisksManager(window.dbManager);
            console.log('Risks manager CREATED and assigned to window.risksManager');
            
            // Initialize the manager fully
            console.log('Initializing RisksManager...');
            await window.risksManager.init();
            console.log('RisksManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initRisksManager:', error);
    }
    
    console.log('=== initRisksManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initRisksManager');
    initRisksManager();
});

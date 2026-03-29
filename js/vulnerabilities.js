// Vulnerability Reports Management Module
class VulnerabilitiesManager {
    constructor(database) {
        this.db = database;
        this.initialized = false;
    }

    async init() {
        console.log('VulnerabilitiesManager: init called, db:', this.db);
        this.attachEventListeners();
        await this.loadVulnerabilities();
        this.initialized = true;
        console.log('VulnerabilitiesManager: initialized');
    }

    attachEventListeners() {
        const addBtn = document.getElementById('addVulnerabilityBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showVulnerabilityModal());
        }
        
        const importBtn = document.getElementById('importXlsxBtn');
        const fileInput = document.getElementById('xlsxImportInput');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleXlsxImport(e));
        }
        
        const exportBtn = document.getElementById('exportVulnerabilitiesBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportVulnerabilities());
        }
        
        // Attach edit/delete listeners after render
        this.attachRowListeners();
    }
    
    attachRowListeners() {
        setTimeout(() => {
            document.querySelectorAll('.vulnerability-edit-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.editVulnerability(id);
                };
            });
            document.querySelectorAll('.vulnerability-delete-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.deleteVulnerability(id);
                };
            });
        }, 100);
    }

    async loadVulnerabilities() {
        try {
            console.log('Loading vulnerabilities... db:', this.db);
            const vulnerabilities = await this.db.select('vulnerabilities');
            console.log('Loaded vulnerabilities count:', vulnerabilities.length);
            this.renderVulnerabilities(vulnerabilities);
            this.attachRowListeners();
        } catch (error) {
            console.error('Error loading vulnerabilities:', error);
        }
    }

    renderVulnerabilities(vulnerabilities) {
        const tbody = document.getElementById('vulnerabilitiesTableBody');
        if (!tbody) return;
        
        if (vulnerabilities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No vulnerabilities found</td></tr>';
            return;
        }
        
        tbody.innerHTML = vulnerabilities.map(v => {
            const dueDate = v.due_date || '';
            const dueDateObj = dueDate ? new Date(dueDate) : null;
            const today = new Date();
            today.setHours(0,0,0,0);
            const isOverdue = dueDateObj && dueDateObj < today;
            const status = isOverdue ? 'Breached' : (v.status || 'Open');
            
            const formattedDate = dueDateObj ? dueDateObj.toLocaleDateString() : '-';
            
            return `<tr data-vulnerability-id="${v.id}">
                <td><strong>${v.title || ''}</strong></td>
                <td><span class="badge badge-${this.getSeverityClass(v.severity)}">${v.severity || 'Unknown'}</span></td>
                <td title="${v.description || ''}">${(v.description || '').substring(0, 100)}${(v.description || '').length > 100 ? '...' : ''}</td>
                <td>${v.assignment_group || '-'}</td>
                <td>${formattedDate}${isOverdue ? ' <span style="color:#ef4444;font-weight:bold;">⚠️ OVERDUE</span>' : ''}</td>
                <td><span class="badge badge-${this.getStatusClass(status)}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-btn vulnerability-edit-btn" data-id="${v.id}" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn vulnerability-delete-btn" data-id="${v.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    getSeverityClass(severity) {
        const map = { 'Critical': 'danger', 'High': 'warning', 'Medium': 'info', 'Low': 'success' };
        return map[severity] || 'secondary';
    }

    getStatusClass(status) {
        const map = { 'Open': 'success', 'Due': 'warning', 'Breached': 'danger', 'Resolved': 'secondary' };
        return map[status] || 'secondary';
    }

    async saveVulnerability() {
        const vulnId = document.getElementById('vulnId')?.value;
        const vuln = {
            title: document.getElementById('vulnTitle').value,
            severity: document.getElementById('vulnSeverity').value,
            due_date: document.getElementById('vulnDueDate').value,
            assignment_group: document.getElementById('vulnAssignment').value,
            description: document.getElementById('vulnDescription').value,
            status: document.getElementById('vulnStatus')?.value || 'Open'
        };
        
        if (!vuln.title) {
            alert('Title is required');
            return;
        }
        
        if (vulnId) {
            await this.db.update('vulnerabilities', vulnId, vuln);
        } else {
            await this.db.insert('vulnerabilities', vuln);
        }
        
        this.closeModal();
        await this.loadVulnerabilities();
    }

    async editVulnerability(id) {
        const vulns = await this.db.select('vulnerabilities');
        const vuln = vulns.find(v => v.id === id);
        if (!vuln) return;
        
        this.showVulnerabilityModal(vuln);
    }

    async deleteVulnerability(id) {
        if (!confirm('Are you sure you want to delete this vulnerability?')) return;
        await this.db.delete('vulnerabilities', id);
        await this.loadVulnerabilities();
    }

    showVulnerabilityModal(vuln = null) {
        const isEdit = !!vuln;
        const modalHtml = `<div class="modal active">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit' : 'Add'} Vulnerability</h3>
                <button class="modal-close" onclick="window.vulnerabilitiesManager.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${isEdit ? `<input type="hidden" id="vulnId" value="${vuln.id}">` : ''}
                <div class="form-group">
                    <label>Request Item *</label>
                    <input type="text" id="vulnTitle" value="${vuln?.title || ''}" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Severity</label>
                    <select id="vulnSeverity" class="form-control">
                        <option value="Low" ${vuln?.severity === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Medium" ${vuln?.severity === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="High" ${vuln?.severity === 'High' ? 'selected' : ''}>High</option>
                        <option value="Critical" ${vuln?.severity === 'Critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" id="vulnDueDate" value="${vuln?.due_date || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Assignment Group</label>
                    <input type="text" id="vulnAssignment" value="${vuln?.assignment_group || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="vulnStatus" class="form-control">
                        <option value="Open" ${vuln?.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${vuln?.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Due" ${vuln?.status === 'Due' ? 'selected' : ''}>Due</option>
                        <option value="Breached" ${vuln?.status === 'Breached' ? 'selected' : ''}>Breached</option>
                        <option value="Resolved" ${vuln?.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="vulnDescription" class="form-control" rows="4">${vuln?.description || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="window.vulnerabilitiesManager.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="window.vulnerabilitiesManager.saveVulnerability()">Save</button>
            </div>
        </div>`;
        document.getElementById('modalContainer').innerHTML = modalHtml;
    }

    closeModal() {
        document.getElementById('modalContainer').innerHTML = '';
    }

    async saveVulnerability() {
        const vuln = {
            title: document.getElementById('vulnTitle').value,
            severity: document.getElementById('vulnSeverity').value,
            due_date: document.getElementById('vulnDueDate').value,
            assignment_group: document.getElementById('vulnAssignment').value,
            description: document.getElementById('vulnDescription').value,
            status: 'Open'
        };
        
        await this.db.insert('vulnerabilities', vuln);
        this.closeModal();
        await this.loadVulnerabilities();
    }

    async handleXlsxImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // If multiple sheets, show selector
                if (workbook.SheetNames.length > 1) {
                    this.showSheetSelector(workbook);
                } else {
                    this.processSheet(workbook, workbook.SheetNames[0]);
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    showSheetSelector(workbook) {
        const options = workbook.SheetNames.map((name, i) => 
            `<option value="${i}">${i + 1}. ${name}</option>`
        ).join('');
        
        const modalHtml = `<div class="modal active">
            <div class="modal-header">
                <h3>Select Sheet to Import</h3>
                <button class="modal-close" onclick="window.vulnerabilitiesManager.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>This workbook has multiple sheets. Select which one to import:</p>
                <select id="sheetSelect" class="form-control">${options}</select>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="window.vulnerabilitiesManager.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="window.vulnerabilitiesManager.importSelectedSheet()">Import</button>
            </div>
        </div>`;
        
        document.getElementById('modalContainer').innerHTML = modalHtml;
        this.currentWorkbook = workbook;
    }

    importSelectedSheet() {
        const sheetIndex = parseInt(document.getElementById('sheetSelect').value);
        const sheetName = this.currentWorkbook.SheetNames[sheetIndex];
        this.closeModal();
        this.processSheet(this.currentWorkbook, sheetName);
        this.currentWorkbook = null;
    }

    processSheet(workbook, sheetName) {
        try {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            let imported = 0;
            for (const row of json) {
                const title = row['Request Item'] || row['request_item'] || row['Request'] || '';
                if (!title) continue;
                
                const vuln = {
                    title: String(title),
                    severity: this.mapPriorityToSeverity(row['Priority'] || row['priority'] || ''),
                    description: row['Description'] || row['description'] || '',
                    assignment_group: row['Assignment Group'] || row['assignment_group'] || '',
                    due_date: this.parseExcelDate(row['Due Date'] || row['due_date']),
                    status: 'Open'
                };
                
                await this.db.insert('vulnerabilities', vuln);
                imported++;
            }
            
            this.loadVulnerabilities();
            alert(`Import complete! ${imported} items imported.`);
        } catch (err) {
            console.error('Import error:', err);
            alert('Import failed: ' + err.message);
        }
    }

    mapPriorityToSeverity(priority) {
        const p = String(priority).toLowerCase();
        if (p.includes('critical') || p.includes('1')) return 'Critical';
        if (p.includes('high') || p === '2') return 'High';
        if (p.includes('medium') || p === '3' || p.includes('moderate')) return 'Medium';
        return 'Low';
    }

    parseExcelDate(dateValue) {
        if (!dateValue) return '';
        if (dateValue instanceof Date) return dateValue.toISOString().split('T')[0];
        if (typeof dateValue === 'string') return dateValue.substring(0, 10);
        return String(dateValue);
    }

    async exportVulnerabilities() {
        const vulns = await this.db.select('vulnerabilities');
        const csv = 'Request Item,Severity,Description,Assignment Group,Due Date,Status\n' + 
            vulns.map(v => `"${v.title}",${v.severity},"${v.description || ''}","${v.assignment_group || ''}",${v.due_date || ''},${v.status || 'Open'}`).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vulnerabilities.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
}

async function initVulnerabilitiesManager() {
    console.log('initVulnerabilitiesManager: starting');
    try {
        if (window.dbManager && window.dbManager.ready) {
            console.log('initVulnerabilitiesManager: waiting for db');
            await window.dbManager.ready;
            console.log('initVulnerabilitiesManager: db ready');
        }
        
        console.log('initVulnerabilitiesManager: creating manager');
        window.vulnerabilitiesManager = new VulnerabilitiesManager(window.dbManager);
        await window.vulnerabilitiesManager.init();
        console.log('initVulnerabilitiesManager: complete');
    } catch (error) {
        console.error('initVulnerabilitiesManager error:', error);
        window.vulnerabilitiesManager = new VulnerabilitiesManager(null);
        window.vulnerabilitiesManager.initialized = true;
    }
}

document.addEventListener('DOMContentLoaded', initVulnerabilitiesManager);

// Vulnerability Reports Management Module
class VulnerabilitiesManager {
    constructor(database) {
        this.db = database;
        this.initialized = false;
    }

    async init() {
        console.log('VulnerabilitiesManager: init called');
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
    }

    async loadVulnerabilities() {
        try {
            const vulnerabilities = await this.db.select('vulnerabilities');
            this.renderVulnerabilities(vulnerabilities);
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
            const isOverdue = dueDate && new Date(dueDate) < new Date();
            const status = isOverdue ? 'Breached' : (v.status || 'Open');
            
            return `<tr data-vulnerability-id="${v.id}">
                <td>${v.title || ''}</td>
                <td><span class="badge badge-${this.getSeverityClass(v.severity)}">${v.severity || 'Unknown'}</span></td>
                <td>${(v.description || '').substring(0, 100)}</td>
                <td>${v.assignment_group || '-'}</td>
                <td>${dueDate} ${isOverdue ? '<span style="color:red">OVERDUE</span>' : ''}</td>
                <td><span class="badge badge-${this.getStatusClass(status)}">${status}</span></td>
                <td>
                    <button class="edit-btn" data-id="${v.id}">Edit</button>
                    <button class="delete-btn" data-id="${v.id}">Delete</button>
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

    showVulnerabilityModal() {
        console.log('showVulnerabilityModal called');
        const modalHtml = `<div class="modal active">
            <div class="modal-header"><h3>Add Vulnerability</h3></div>
            <div class="modal-body">
                <input type="text" id="vulnTitle" placeholder="Request Item" class="form-control" style="margin-bottom:10px">
                <select id="vulnSeverity" class="form-control" style="margin-bottom:10px">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                </select>
                <input type="date" id="vulnDueDate" class="form-control" style="margin-bottom:10px">
                <input type="text" id="vulnAssignment" placeholder="Assignment Group" class="form-control" style="margin-bottom:10px">
                <textarea id="vulnDescription" placeholder="Description" class="form-control"></textarea>
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
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);
                
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
                }
                
                await this.loadVulnerabilities();
                alert('Import complete');
            } catch (err) {
                console.error('Import error:', err);
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    mapPriorityToSeverity(priority) {
        const p = String(priority).toLowerCase();
        if (p.includes('critical') || p.includes('1') || p.includes('high')) return 'Critical';
        if (p.includes('high') || p.includes('2')) return 'High';
        if (p.includes('medium') || p.includes('3') || p.includes('moderate')) return 'Medium';
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
            await window.dbManager.ready;
        }
        
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

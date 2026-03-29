// Vulnerability Reports Management Module
class VulnerabilitiesManager {
    constructor(database) {
        this.db = database;
        this.initialized = false;
        this.currentWorkbook = null;
    }

    async init() {
        console.log('[VULN] init called');
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        this.attachEventListeners();
        await this.loadVulnerabilities();
        this.initialized = true;
        console.log('[VULN] init complete');
    }

    attachEventListeners() {
        console.log('[VULN] attachEventListeners running');
        
        const addBtn = document.getElementById('addVulnerabilityBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showVulnerabilityModal());
            console.log('[VULN] addVulnerabilityBtn listener attached');
        } else {
            console.log('[VULN] addVulnerabilityBtn not found');
        }
        
        const importBtn = document.getElementById('importXlsxBtn');
        const fileInput = document.getElementById('xlsxImportInput');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => {
                console.log('[VULN] Import button clicked');
                fileInput.click();
            });
            fileInput.addEventListener('change', (e) => {
                console.log('[VULN] File input changed', e.target.files);
                this.handleXlsxImport(e);
            });
            console.log('[VULN] Import listeners attached');
        } else {
            console.log('[VULN] importXlsxBtn or xlsxImportInput not found');
        }
        
        const exportBtn = document.getElementById('exportVulnerabilitiesBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportVulnerabilities());
            console.log('[VULN] exportVulnerabilitiesBtn listener attached');
        }
    }

    async loadVulnerabilities() {
        try {
            const vulns = await this.db.select('vulnerabilities');
            this.renderVulnerabilities(vulns);
        } catch (e) {
            console.error('Load error:', e);
        }
    }

    renderVulnerabilities(vulnerabilities) {
        const tbody = document.getElementById('vulnerabilitiesTableBody');
        if (!tbody) return;
        
        if (!vulnerabilities || vulnerabilities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No vulnerabilities found</td></tr>';
            return;
        }
        
        tbody.innerHTML = vulnerabilities.map(v => {
            const due = v.due_date || '';
            const dueDate = due ? new Date(due) : null;
            const today = new Date();
            today.setHours(0,0,0,0);
            const isOverdue = dueDate && dueDate < today;
            const status = isOverdue ? 'Breached' : (v.status || 'Open');
            const dateStr = dueDate ? dueDate.toLocaleDateString() : '-';
            
            return `<tr data-vulnerability-id="${v.id}">
                <td><strong>${v.title || ''}</strong></td>
                <td><span class="badge badge-${this.getSeverityClass(v.severity)}">${v.severity || 'Unknown'}</span></td>
                <td>${(v.description || '').substring(0, 80)}${(v.description || '').length > 80 ? '...' : ''}</td>
                <td>${v.assignment_group || '-'}</td>
                <td>${dateStr}${isOverdue ? ' <span style="color:#ef4444;font-weight:bold;">⚠️</span>' : ''}</td>
                <td><span class="badge badge-${this.getStatusClass(status)}">${status}</span></td>
                <td>
                    <button class="btn btn-sm" onclick="window.vulnerabilitiesManager.editVulnerability(${v.id})">✏️</button>
                    <button class="btn btn-sm" onclick="window.vulnerabilitiesManager.deleteVulnerability(${v.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }

    getSeverityClass(s) {
        const m = {'Critical':'danger','High':'warning','Medium':'info','Low':'success'};
        return m[s] || 'secondary';
    }

    getStatusClass(s) {
        const m = {'Open':'success','Due':'warning','Breached':'danger','Resolved':'secondary'};
        return m[s] || 'secondary';
    }

    showVulnerabilityModal(vuln = null) {
        const isEdit = !!vuln;
        const html = `<div class="modal active">
            <div class="modal-header"><h3>${isEdit ? 'Edit' : 'Add'} Vulnerability</h3><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
            <div class="modal-body">
                ${isEdit ? `<input type="hidden" id="vulnId" value="${vuln.id}">` : ''}
                <div class="form-group"><label>Request Item *</label><input type="text" id="vulnTitle" value="${vuln?.title || ''}" class="form-control"></div>
                <div class="form-group"><label>Severity</label><select id="vulnSeverity" class="form-control">
                    <option value="Low" ${vuln?.severity==='Low'?'selected':''}>Low</option>
                    <option value="Medium" ${vuln?.severity==='Medium'?'selected':''}>Medium</option>
                    <option value="High" ${vuln?.severity==='High'?'selected':''}>High</option>
                    <option value="Critical" ${vuln?.severity==='Critical'?'selected':''}>Critical</option>
                </select></div>
                <div class="form-group"><label>Due Date</label><input type="date" id="vulnDueDate" value="${vuln?.due_date || ''}" class="form-control"></div>
                <div class="form-group"><label>Assignment Group</label><input type="text" id="vulnAssignment" value="${vuln?.assignment_group || ''}" class="form-control"></div>
                <div class="form-group"><label>Status</label><select id="vulnStatus" class="form-control">
                    <option value="Open" ${vuln?.status==='Open'?'selected':''}>Open</option>
                    <option value="In Progress" ${vuln?.status==='In Progress'?'selected':''}>In Progress</option>
                    <option value="Due" ${vuln?.status==='Due'?'selected':''}>Due</option>
                    <option value="Breached" ${vuln?.status==='Breached'?'selected':''}>Breached</option>
                    <option value="Resolved" ${vuln?.status==='Resolved'?'selected':''}>Resolved</option>
                </select></div>
                <div class="form-group"><label>Description</label><textarea id="vulnDescription" class="form-control" rows="3">${vuln?.description || ''}</textarea></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="window.vulnerabilitiesManager.saveVulnerability()">Save</button>
            </div>
        </div>`;
        document.getElementById('modalContainer').innerHTML = html;
    }

    async saveVulnerability() {
        const id = document.getElementById('vulnId')?.value;
        const vuln = {
            title: document.getElementById('vulnTitle').value,
            severity: document.getElementById('vulnSeverity').value,
            due_date: document.getElementById('vulnDueDate').value,
            assignment_group: document.getElementById('vulnAssignment').value,
            status: document.getElementById('vulnStatus').value,
            description: document.getElementById('vulnDescription').value
        };
        
        if (!vuln.title) { alert('Title required'); return; }
        
        if (id) {
            await this.db.update('vulnerabilities', id, vuln);
        } else {
            await this.db.insert('vulnerabilities', vuln);
        }
        
        document.getElementById('modalContainer').innerHTML = '';
        await this.loadVulnerabilities();
    }

    async editVulnerability(id) {
        const vulns = await this.db.select('vulnerabilities');
        const vuln = vulns.find(v => v.id == id);
        if (vuln) this.showVulnerabilityModal(vuln);
    }

    async deleteVulnerability(id) {
        if (confirm('Delete this vulnerability?')) {
            await this.db.delete('vulnerabilities', id);
            await this.loadVulnerabilities();
        }
    }

    async handleXlsxImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (typeof XLSX === 'undefined') { 
            alert('Excel library not loaded. Please refresh the page.'); 
            return; 
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, {type:'array'});
                
                // Store workbook for later use
                this.currentWorkbook = wb;
                
                // Show sheet selector
                this.showSheetSelector(wb);
            } catch(err) { 
                console.error('Parse error:', err);
                alert('Error reading file: ' + err.message); 
            }
        };
        reader.onerror = () => { alert('Failed to read file'); };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    showSheetSelector(workbook) {
        const opts = workbook.SheetNames.map((n,i) => `<option value="${i}">${i+1}. ${n}</option>`).join('');
        
        // Get preview data from first sheet
        let previewHtml = '';
        try {
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet, {header:1});
            if (data.length > 0) {
                const headers = data[0].slice(0, 5).join(' | ');
                previewHtml = `<p style="font-size:12px;color:#666;">Headers: ${headers}</p>`;
                previewHtml += `<p style="font-size:12px;color:#666;">Total rows: ${data.length - 1}</p>`;
            }
        } catch(e) {}
        
        const html = `<div class="modal active" id="sheetSelectorModal">
            <div class="modal-header">
                <h3>Select Excel Sheet to Import</h3>
                <button class="modal-close" onclick="document.getElementById('sheetSelectorModal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p><strong>Available Sheets:</strong></p>
                <select id="sheetSelect" class="form-control" style="margin-bottom:15px;">${opts}</select>
                ${previewHtml}
                <div style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:12px;">
                    <strong>Instructions:</strong> Select the sheet containing your vulnerability data, then click "Import" to continue.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('sheetSelectorModal').remove()">Cancel</button>
                <button class="btn btn-primary" id="importSheetBtn">Import Selected Sheet</button>
            </div>
        </div>`;
        
        document.getElementById('modalContainer').innerHTML = html;
        
        // Attach event listener
        document.getElementById('importSheetBtn').onclick = () => {
            const idx = parseInt(document.getElementById('sheetSelect').value);
            this.processSheet(workbook, workbook.SheetNames[idx]);
            document.getElementById('sheetSelectorModal').remove();
        };
    }

    processSheet(workbook, sheetName) {
        try {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            let count = 0;
            
            for (const row of json) {
                const title = row['Request Item'] || row['request_item'] || row['Request'] || row['Item'] || '';
                if (!title) continue;
                
                const vuln = {
                    title: String(title),
                    severity: this.mapPriority(row['Priority'] || row['priority'] || ''),
                    description: row['Description'] || row['description'] || '',
                    assignment_group: row['Assignment Group'] || row['assignment_group'] || '',
                    due_date: this.parseDate(row['Due Date'] || row['due_date']),
                    status: 'Open'
                };
                
                this.db.insert('vulnerabilities', vuln);
                count++;
            }
            
            this.loadVulnerabilities();
            alert(`Import complete! ${count} items imported.`);
        } catch(e) { 
            console.error('Import error:', e);
            alert('Import error: ' + e.message); 
        }
    }

    mapPriority(p) {
        const s = String(p).toLowerCase();
        if (s.includes('critical') || s === '1') return 'Critical';
        if (s.includes('high') || s === '2') return 'High';
        if (s.includes('medium') || s.includes('moderate') || s === '3') return 'Medium';
        return 'Low';
    }

    parseDate(v) {
        if (!v) return '';
        if (v instanceof Date) return v.toISOString().split('T')[0];
        if (typeof v === 'string') return v.substring(0,10);
        return String(v);
    }

    async exportVulnerabilities() {
        const vulns = await this.db.select('vulnerabilities');
        const csv = 'Request Item,Severity,Description,Assignment Group,Due Date,Status\n' + 
            vulns.map(v => `"${v.title}",${v.severity},"${v.description||''}","${v.assignment_group||''}",${v.due_date||''},${v.status||'Open'}`).join('\n');
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
        a.download = 'vulnerabilities.csv';
        a.click();
    }
}

async function initVulnerabilitiesManager() {
    console.log('[VULN] init start');
    try {
        await window.dbManager.ready;
        window.vulnerabilitiesManager = new VulnerabilitiesManager(window.dbManager);
        await window.vulnerabilitiesManager.init();
        console.log('[VULN] init complete - manager ready');
    } catch(e) {
        console.error('[VULN] init error:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVulnerabilitiesManager);
} else {
    initVulnerabilitiesManager();
}

window.handleXlsxImportSafe = function(e) {
    console.log('[VULN] handleXlsxImportSafe called', e);
    if (!window.vulnerabilitiesManager) {
        alert('Vulnerabilities manager not initialized. Please refresh the page.');
        return;
    }
    window.vulnerabilitiesManager.handleXlsxImport(e);
};

window.showVulnerabilityModalSafe = function() {
    console.log('[VULN] showVulnerabilityModalSafe called');
    if (!window.vulnerabilitiesManager) {
        alert('Vulnerabilities manager not initialized. Please refresh the page.');
        return;
    }
    window.vulnerabilitiesManager.showVulnerabilityModal();
};

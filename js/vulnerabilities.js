// Vulnerability Reports Management Module
class VulnerabilitiesManager {
    constructor(database) {
        this.db = database;
        this.initialized = false;
    }

    async init() {
        console.log('[VULN] init called');
        this.attachEventListeners();
        await this.loadVulnerabilities();
        this.initialized = true;
        console.log('[VULN] initialized');
    }

    attachEventListeners() {
        console.log('[VULN] attachEventListeners');
        
        const addBtn = document.getElementById('addVulnerabilityBtn');
        if (addBtn) {
            addBtn.onclick = () => this.showVulnerabilityModal();
        }
        
        const importBtn = document.getElementById('importXlsxBtn');
        const fileInput = document.getElementById('xlsxImportInput');
        if (importBtn && fileInput) {
            importBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => this.handleXlsxImport(e);
        }
        
        const exportBtn = document.getElementById('exportVulnerabilitiesBtn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportVulnerabilities();
        }
    }

    async loadVulnerabilities() {
        console.log('[VULN] loadVulnerabilities');
        try {
            const vulns = await this.db.select('vulnerabilities');
            console.log('[VULN] loaded:', vulns.length);
            this.renderVulnerabilities(vulns);
        } catch (e) {
            console.error('[VULN] load error:', e);
        }
    }

    renderVulnerabilities(vulnerabilities) {
        const tbody = document.getElementById('vulnerabilitiesTableBody');
        if (!tbody) {
            console.log('[VULN] tbody not found');
            return;
        }
        
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
        console.log('[VULN] File selected:', file?.name, 'XLSX available:', typeof XLSX !== 'undefined');
        alert('Import triggered! File: ' + file?.name + ', XLSX: ' + typeof XLSX);
        
        if (!file) return;
        if (typeof XLSX === 'undefined') { alert('Excel library not loaded'); return; }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('[VULN] File read complete, parsing...');
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, {type:'array'});
                console.log('[VULN] Workbook sheets:', wb.SheetNames, 'count:', wb.SheetNames.length);
                
                // Always show sheet selector so user can choose
                console.log('[VULN] Showing sheet selector');
                this.showSheetSelector(wb);
            } catch(err) { 
                console.error('[VULN] Parse error:', err); 
                alert('Error reading file: ' + err.message); 
            }
        };
        reader.onerror = () => { alert('Failed to read file'); };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    showSheetSelector(workbook) {
        console.log('[VULN] showSheetSelector called, sheets:', workbook.SheetNames);
        alert('Sheet selector called! Sheets: ' + workbook.SheetNames.join(', '));
        const opts = workbook.SheetNames.map((n,i) => `<option value="${i}">${i+1}. ${n}</option>`).join('');
        const html = `<div class="modal active">
            <div class="modal-header"><h3>Select Sheet</h3><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
            <div class="modal-body"><p>Choose sheet to import:</p><select id="sheetIdx" class="form-control">${opts}</select></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="window.vulnerabilitiesManager.doImportSheet()">Import</button>
            </div>
        </div>`;
        document.getElementById('modalContainer').innerHTML = html;
        this.currentWorkbook = workbook;
    }

    doImportSheet() {
        const idx = parseInt(document.getElementById('sheetIdx').value);
        this.processSheet(this.currentWorkbook, this.currentWorkbook.SheetNames[idx]);
        document.getElementById('modalContainer').innerHTML = '';
    }

    processSheet(workbook, sheetName) {
        console.log('[VULN] processSheet called for:', sheetName);
        try {
            const sheet = workbook.Sheets[sheetName];
            console.log('[VULN] Sheet found:', !!sheet);
            
            const json = XLSX.utils.sheet_to_json(sheet);
            console.log('[VULN] Rows parsed:', json.length);
            
            let count = 0;
            
            for (const row of json) {
                const title = row['Request Item'] || row['request_item'] || row['Request'] || row['Item'] || '';
                console.log('[VULN] Row title:', title);
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
            
            console.log('[VULN] Imported count:', count);
            this.loadVulnerabilities();
            alert(`Imported ${count} items`);
        } catch(e) { 
            console.error('[VULN] Import error:', e); 
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
    console.log('[VULN] init start, dbManager:', !!window.dbManager);
    try {
        if (window.dbManager?.ready) {
            console.log('[VULN] waiting db ready');
            await window.dbManager.ready;
        }
        window.vulnerabilitiesManager = new VulnerabilitiesManager(window.dbManager);
        await window.vulnerabilitiesManager.init();
        console.log('[VULN] init complete');
    } catch(e) {
        console.error('[VULN] init error:', e);
        window.vulnerabilitiesManager = {initialized:true};
    }
}

document.addEventListener('DOMContentLoaded', initVulnerabilitiesManager);

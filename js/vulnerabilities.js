// Vulnerability Reports Management Module
class VulnerabilitiesManager {
    constructor(database) {
        this.db = database;
        this.currentSeverityFilter = '';
        this.currentStatusFilter = '';
        this.currentSortBy = 'newest'; // Default sort: newest first
        this.searchTerm = ''; // Search filter
        this.DUE_WARNING_DAYS = 7; // Consider "Due" when within 7 days
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 25,
            totalItems: 0,
            totalPages: 0
        };
    }

    // Calculate status based on due date
    calculateStatus(dueDate, currentStatus) {
        console.log(`[STATUS] calculateStatus called: dueDate=${dueDate}, currentStatus=${currentStatus}`);
        
        if (!dueDate || dueDate === '') {
            console.log(`[STATUS] No due date, returning Open`);
            return 'Open';
        }
        
        // If manually set to Resolved, keep it
        if (currentStatus === 'Resolved') {
            console.log(`[STATUS] Status is Resolved, returning Resolved`);
            return 'Resolved';
        }
        
        // Parse date as local date (YYYY-MM-DD format)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let due;
        try {
            if (typeof dueDate === 'string') {
                // Handle YYYY-MM-DD format
                const parts = dueDate.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const day = parseInt(parts[2]);
                    due = new Date(year, month, day);
                    console.log(`[STATUS] Parsed string date: year=${year}, month=${month}, day=${day}, result=${due.toDateString()}`);
                } else {
                    due = new Date(dueDate);
                }
            } else if (dueDate instanceof Date) {
                due = new Date(dueDate);
            } else {
                console.log(`[STATUS] Unknown date type, returning Open`);
                return 'Open';
            }
        } catch (e) {
            console.log(`[STATUS] Date parse error: ${e.message}, returning Open`);
            return 'Open';
        }
        
        // Check if date is valid
        if (!due || isNaN(due.getTime())) {
            console.log(`[STATUS] Invalid date, returning Open`);
            return 'Open';
        }
        
        due.setHours(0, 0, 0, 0);
        
        // Calculate days difference
        const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
        
        console.log(`[STATUS] Today: ${today.toDateString()}, Due: ${due.toDateString()}, Diff days: ${diffDays}`);
        
        let result;
        if (diffDays < 0) {
            result = 'Breached';
        } else if (diffDays <= this.DUE_WARNING_DAYS) {
            result = 'Due';
        } else {
            result = 'Open';
        }
        
        console.log(`[STATUS] Returning: ${result}`);
        return result;
    }

    async recalculateAllStatuses() {
        try {
            const vulnerabilities = await this.db.select('vulnerabilities');
            console.log(`Recalculating statuses for ${vulnerabilities.length} vulnerabilities`);
            let updatedCount = 0;
            let errorCount = 0;
            
            for (const vuln of vulnerabilities) {
                // Skip resolved vulnerabilities - keep their status as Resolved
                if (vuln.status === 'Resolved') continue;
                
                // Calculate current status based on due date
                const calculatedStatus = this.calculateStatus(vuln.due_date, vuln.status);
                console.log(`Checking: "${vuln.title}" - due_date: "${vuln.due_date}", current status: "${vuln.status}", calculated: "${calculatedStatus}"`);
                
                // Update if status has changed
                if (calculatedStatus !== vuln.status) {
                    try {
                        await this.db.update('vulnerabilities', vuln.id, { status: calculatedStatus });
                        updatedCount++;
                        console.log(`Updated ${vuln.title}: ${vuln.status} → ${calculatedStatus}`);
                    } catch (updateError) {
                        console.error(`Failed to update ${vuln.title}:`, updateError);
                        errorCount++;
                    }
                }
            }
            
            console.log(`Status counts after recalculation:`);
            const counts = { Open: 0, 'In Progress': 0, Due: 0, Breached: 0, Resolved: 0 };
            vulnerabilities.forEach(v => {
                const s = v.status || 'Open';
                counts[s] = (counts[s] || 0) + 1;
            });
            console.log(counts);
            
            if (updatedCount > 0) {
                console.log(`Recalculated ${updatedCount} vulnerability statuses`);
            }
            if (errorCount > 0) {
                console.error(`Failed to update ${errorCount} vulnerabilities`);
            }
        } catch (error) {
            console.error('Error recalculating statuses:', error);
        }
    }

    async init() {
        this.attachEventListeners();
        await this.recalculateAllStatuses(); // Update statuses based on current dates
        await this.loadVulnerabilities();
        this.initialized = true;
        console.log('Vulnerabilities manager initialized');
    }

    attachEventListeners() {
        console.log('Attaching vulnerabilities event listeners...');
        
        // Add vulnerability button
        const addBtn = document.getElementById('addVulnerabilityBtn');
        if (addBtn) {
            console.log('Attaching Add Vulnerability button');
            addBtn.addEventListener('click', () => {
                console.log('Add Vulnerability button clicked');
                this.showVulnerabilityModal();
            });
        } else {
            console.warn('Add Vulnerability button not found');
        }

        // Import XLSX buttons
        const importBtn = document.getElementById('importXlsxBtn');
        const fileInput = document.getElementById('xlsxImportInput');

        if (importBtn && fileInput) {
            console.log('Attaching Import Excel button');
            importBtn.addEventListener('click', () => {
                console.log('Import Excel button clicked');
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                console.log('File selected for import');
                this.handleXlsxImport(e);
            });
        } else {
            console.warn('Import button or file input not found');
        }
        
        // Export button
        const exportBtn = document.getElementById('exportVulnerabilitiesBtn');
        if (exportBtn) {
            console.log('Attaching Export Vulnerabilities button');
            exportBtn.addEventListener('click', async () => {
                console.log('Export Vulnerabilities button clicked');
                await this.exportVulnerabilities();
            });
        } else {
            console.warn('Export Vulnerabilities button not found');
        }

        // Severity filter
        const severityFilter = document.getElementById('vulnerabilitySeverityFilter');
        if (severityFilter) {
            severityFilter.addEventListener('change', async (e) => {
                this.currentSeverityFilter = e.target.value;
                await this.loadVulnerabilities();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('vulnerabilityStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                this.currentStatusFilter = e.target.value;
                await this.loadVulnerabilities();
            });
        }

        // Sort by filter
        const sortBySelect = document.getElementById('vulnerabilitySortBy');
        if (sortBySelect) {
            sortBySelect.addEventListener('change', async (e) => {
                this.currentSortBy = e.target.value;
                await this.loadVulnerabilities();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('vulnerabilitySearchInput');
        const searchBtn = document.getElementById('vulnerabilitySearchBtn');
        
        if (searchInput) {
            console.log('Attaching search input listener');
            searchInput.addEventListener('input', async (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.pagination.currentPage = 1; // Reset to first page on search
                await this.loadVulnerabilities();
            });
            
            // Handle Enter key
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    this.searchTerm = e.target.value.toLowerCase();
                    this.pagination.currentPage = 1;
                    await this.loadVulnerabilities();
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                if (searchInput) {
                    this.searchTerm = searchInput.value.toLowerCase();
                    this.pagination.currentPage = 1;
                    await this.loadVulnerabilities();
                }
            });
        }

        // Pagination controls
        this.attachPaginationListeners();
    }

    attachPaginationListeners() {
        // Items per page selector
        const itemsPerPageSelect = document.getElementById('itemsPerPage');
        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', async (e) => {
                const value = e.target.value;
                this.pagination.itemsPerPage = value === 'all' ? 'all' : parseInt(value);
                this.pagination.currentPage = 1; // Reset to first page
                await this.loadVulnerabilities();
            });
        }

        // Page navigation buttons
        document.getElementById('firstPageBtn')?.addEventListener('click', async () => {
            if (this.pagination.currentPage > 1) {
                this.pagination.currentPage = 1;
                await this.loadVulnerabilities();
            }
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', async () => {
            if (this.pagination.currentPage > 1) {
                this.pagination.currentPage--;
                await this.loadVulnerabilities();
            }
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', async () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.pagination.currentPage++;
                await this.loadVulnerabilities();
            }
        });

        document.getElementById('lastPageBtn')?.addEventListener('click', async () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.pagination.currentPage = this.pagination.totalPages;
                await this.loadVulnerabilities();
            }
        });
    }

    async exportVulnerabilities() {
        try {
            let where = [];
            let params = [];

            if (this.currentSeverityFilter) {
                where.push('severity = ?');
                params.push(this.currentSeverityFilter);
            }

            if (this.currentStatusFilter) {
                where.push('status = ?');
                params.push(this.currentStatusFilter);
            }

            const whereClause = where.length > 0 ? where.join(' AND ') : '';
            const vulnerabilities = await this.db.select('vulnerabilities', whereClause, params, 'created_at DESC');

            if (vulnerabilities.length === 0) {
                this.showError('No vulnerabilities to export');
                return;
            }

            let csv = 'VULNERABILITIES EXPORT\n';
            csv += 'Request Item,Severity,Description,Assignment Group,Due Date,Status,Discovered Date\n';

            vulnerabilities.forEach(vuln => {
                csv += `"${this.escapeCsv(vuln.title)}",${vuln.severity || 'Unknown'},"${this.escapeCsv(vuln.description)}","${this.escapeCsv(vuln.assignment_group)}",${vuln.due_date || ''},${vuln.status || 'Open'},${vuln.discovered_date || ''}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vulnerabilities-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Vulnerabilities exported successfully');
        } catch (error) {
            console.error('Error exporting vulnerabilities:', error);
            this.showError('Failed to export vulnerabilities');
        }
    }

    async loadVulnerabilities() {
        try {
            let where = [];
            let params = [];

            if (this.currentSeverityFilter) {
                where.push('severity = ?');
                params.push(this.currentSeverityFilter);
            }

            if (this.currentStatusFilter) {
                where.push('status = ?');
                params.push(this.currentStatusFilter);
            }

            const whereClause = where.length > 0 ? where.join(' AND ') : '';
            
            // Get vulnerabilities without sorting (we'll sort in memory)
            let vulnerabilities = await this.db.select('vulnerabilities', whereClause, params);
            
            // Apply search filter
            if (this.searchTerm) {
                vulnerabilities = vulnerabilities.filter(vuln => {
                    const searchableText = [
                        vuln.title,
                        vuln.description,
                        vuln.assignment_group,
                        vuln.severity,
                        vuln.status
                    ].join(' ').toLowerCase();
                    return searchableText.includes(this.searchTerm);
                });
            }
            
            // Apply user-selected sorting
            const sortedVulnerabilities = this.sortVulnerabilities(vulnerabilities);
            
            this.renderVulnerabilities(sortedVulnerabilities);
        } catch (error) {
            console.error('Error loading vulnerabilities:', error);
            this.showError('Failed to load vulnerabilities');
        }
    }

    sortVulnerabilities(vulnerabilities) {
        const sorted = [...vulnerabilities]; // Create a copy
        
        switch (this.currentSortBy) {
            case 'newest':
                // Sort by discovered_date descending (newest first)
                sorted.sort((a, b) => {
                    const dateA = new Date(a.discovered_date || a.created_at || 0);
                    const dateB = new Date(b.discovered_date || b.created_at || 0);
                    return dateB - dateA;
                });
                break;
                
            case 'oldest':
                // Sort by discovered_date ascending (oldest first)
                sorted.sort((a, b) => {
                    const dateA = new Date(a.discovered_date || a.created_at || 0);
                    const dateB = new Date(b.discovered_date || b.created_at || 0);
                    return dateA - dateB;
                });
                break;
                
            case 'dueDateAsc':
                // Sort by due_date ascending (earliest due date first)
                sorted.sort((a, b) => {
                    if (!a.due_date && !b.due_date) return 0;
                    if (!a.due_date) return 1; // Items without due date go to end
                    if (!b.due_date) return -1;
                    return new Date(a.due_date) - new Date(b.due_date);
                });
                break;
                
            case 'dueDateDesc':
                // Sort by due_date descending (latest due date first)
                sorted.sort((a, b) => {
                    if (!a.due_date && !b.due_date) return 0;
                    if (!a.due_date) return 1; // Items without due date go to end
                    if (!b.due_date) return -1;
                    return new Date(b.due_date) - new Date(a.due_date);
                });
                break;
                
            default:
                // Default to newest first
                sorted.sort((a, b) => {
                    const dateA = new Date(a.discovered_date || a.created_at || 0);
                    const dateB = new Date(b.discovered_date || b.created_at || 0);
                    return dateB - dateA;
                });
        }
        
        return sorted;
    }

    renderVulnerabilities(vulnerabilities) {
        const tbody = document.getElementById('vulnerabilitiesTableBody');
        
        // Calculate pagination
        const totalItems = vulnerabilities.length;
        const itemsPerPage = this.pagination.itemsPerPage === 'all' ? totalItems : this.pagination.itemsPerPage;
        const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
        
        // Update pagination state
        this.pagination.totalItems = totalItems;
        this.pagination.totalPages = totalPages;
        
        // Ensure current page is valid
        if (this.pagination.currentPage > totalPages) {
            this.pagination.currentPage = totalPages || 1;
        }
        
        // Calculate slice indices
        const startIndex = (this.pagination.currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        
        // Get current page items
        const paginatedVulnerabilities = itemsPerPage === 'all' ? vulnerabilities : vulnerabilities.slice(startIndex, endIndex);
        
        // Update pagination UI
        this.updatePaginationUI(startIndex + 1, endIndex, totalItems);
        
        requestAnimationFrame(() => {
            if (vulnerabilities.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <div>
                                <i class="fas fa-shield-alt"></i>
                                <h3>No vulnerabilities found</h3>
                                <p>Import Wipro Excel file or add your first vulnerability report</p>
                                <button class="btn btn-primary" id="emptyStateImportBtn">
                                    <i class="fas fa-file-import"></i> Import Excel
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                
                // Attach event listener to the import button
                setTimeout(() => {
                    const importBtn = document.getElementById('emptyStateImportBtn');
                    if (importBtn) {
                        importBtn.addEventListener('click', () => {
                            const xlsxBtn = document.getElementById('importXlsxBtn');
                            if (xlsxBtn) xlsxBtn.click();
                        });
                    }
                }, 0);
                return;
            }

            const html = paginatedVulnerabilities.map(vulnerability => {
                const shortDesc = vulnerability.description 
                    ? (vulnerability.description.length > 100 
                        ? vulnerability.description.substring(0, 100) + '...' 
                        : vulnerability.description)
                    : '-';
                
                // Calculate dynamic status based on due date
                const calculatedStatus = this.calculateStatus(vulnerability.due_date, vulnerability.status);
                const isBreached = calculatedStatus === 'Breached';
                const isDue = calculatedStatus === 'Due';
                
                console.log(`[RENDER] "${vulnerability.title}" - due_date="${vulnerability.due_date}", status="${vulnerability.status}", calculated="${calculatedStatus}", isBreached=${isBreached}, isDue=${isDue}`);
                
                // Add visual indicators for breached/due
                let statusBadgeClass = this.getStatusClass(calculatedStatus);
                let rowStyle = '';
                if (isBreached) {
                    rowStyle = 'style="background-color: rgba(239, 68, 68, 0.1);"';
                } else if (isDue) {
                    rowStyle = 'style="background-color: rgba(245, 158, 11, 0.1);"';
                }
                
                return `
                <tr ${rowStyle} data-vulnerability-id="${vulnerability.id}">
                    <td><strong>${this.escapeHtml(vulnerability.title)}</strong></td>
                    <td>
                        <span class="badge badge-${this.getSeverityClass(vulnerability.severity)}">
                             ${vulnerability.severity || 'Unknown'}
                        </span>
                    </td>
                    <td title="${this.escapeHtml(vulnerability.description || '')}">${this.escapeHtml(shortDesc)}</td>
                    <td>${this.escapeHtml(vulnerability.assignment_group || '-')}</td>
                    <td>${this.formatDate(vulnerability.due_date)} <strong style="${isBreached ? 'color: #ef4444; background: #fee2e2; padding: 2px 6px; border-radius: 4px;' : isDue ? 'color: #f59e0b; background: #fef3c7; padding: 2px 6px; border-radius: 4px;' : 'color: #6b7280;'}">${calculatedStatus}</strong></td>
                    <td>
                        <span class="badge badge-${statusBadgeClass}">
                            ${calculatedStatus}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="edit-btn vulnerability-edit-btn" data-id="${vulnerability.id}" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn vulnerability-delete-btn" data-id="${vulnerability.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
            
            tbody.innerHTML = html;
            
            // Attach event listeners to edit and delete buttons
            setTimeout(() => {
                tbody.querySelectorAll('.vulnerability-edit-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        this.editVulnerability(id);
                    });
                });
                
                tbody.querySelectorAll('.vulnerability-delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        this.deleteVulnerability(id);
                    });
                });
            }, 0);
        });
    }

    updatePaginationUI(startItem, endItem, totalItems) {
        // Update info text
        const infoElement = document.getElementById('paginationInfo');
        if (infoElement) {
            if (totalItems === 0) {
                infoElement.textContent = 'No vulnerabilities to display';
            } else if (this.pagination.itemsPerPage === 'all') {
                infoElement.textContent = `Showing all ${totalItems} vulnerabilities`;
            } else {
                infoElement.textContent = `Showing ${startItem}-${endItem} of ${totalItems} vulnerabilities`;
            }
        }

        // Update page indicator
        const pageIndicator = document.getElementById('pageIndicator');
        if (pageIndicator) {
            if (this.pagination.itemsPerPage === 'all' || this.pagination.totalPages <= 1) {
                pageIndicator.textContent = 'Page 1 of 1';
            } else {
                pageIndicator.textContent = `Page ${this.pagination.currentPage} of ${this.pagination.totalPages}`;
            }
        }

        // Update button states
        const firstBtn = document.getElementById('firstPageBtn');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const lastBtn = document.getElementById('lastPageBtn');

        const isAll = this.pagination.itemsPerPage === 'all';
        const isFirstPage = this.pagination.currentPage === 1 || isAll;
        const isLastPage = this.pagination.currentPage === this.pagination.totalPages || isAll || this.pagination.totalPages === 0;

        if (firstBtn) firstBtn.disabled = isFirstPage;
        if (prevBtn) prevBtn.disabled = isFirstPage;
        if (nextBtn) nextBtn.disabled = isLastPage;
        if (lastBtn) lastBtn.disabled = isLastPage;
    }

    handleXlsxImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not loaded!');
            this.showError('Excel processing library not available. Please refresh the page and try again.');
            event.target.value = '';
            return;
        }

        console.log('Importing file:', file.name, 'Type:', file.type, 'Size:', file.size);

        // Check file extension
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (fileExtension === 'xls') {
            this.showError('This file is in the older .xls format. Please open it in Excel and save as .xlsx format before importing.');
            event.target.value = '';
            return;
        }
        if (fileExtension === 'xlsm') {
            this.showError('This file contains macros (.xlsm). Please remove macros and save as .xlsx format before importing.');
            event.target.value = '';
            return;
        }
        if (fileExtension !== 'xlsx') {
            this.showError('Please select a .xlsx file only.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                console.log('Available sheets:', workbook.SheetNames);
                
                // If multiple sheets, show selector
                if (workbook.SheetNames.length > 1) {
                    this.showSheetSelector(workbook, file.name);
                    event.target.value = '';
                    return;
                }
                
                // Process first sheet
                this.processSheet(workbook, workbook.SheetNames[0]);
                event.target.value = '';
                
            } catch (error) {
                console.error('Error parsing XLSX file:', error);
                console.error('Error stack:', error.stack);
                console.error('Error name:', error.name);
                console.error('Error type:', typeof error);
                console.error('File details:', {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: new Date(file.lastModified).toISOString()
                });
                console.error('File extension:', file.name.split('.').pop().toLowerCase());
                console.error('First 100 bytes (hex):', Array.from(data.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                
                // Check if XLSX library is loaded
                console.error('XLSX library loaded:', typeof XLSX !== 'undefined');
                if (typeof XLSX !== 'undefined') {
                    console.error('XLSX version:', XLSX.version);
                }
                
                let errorMessage = 'Failed to parse Excel file';
                if (error.message && error.message.includes('password')) {
                    errorMessage = 'This file appears to be password protected. Please remove the password and try again.';
                } else if (error.message && error.message.includes('corrupted')) {
                    errorMessage = 'This file appears to be corrupted. Please try opening it in Excel and re-saving as .xlsx format.';
                } else if (file.name.toLowerCase().endsWith('.xls')) {
                    errorMessage = 'This appears to be an older .xls format. Please open in Excel and save as .xlsx format before importing.';
                } else if (file.name.toLowerCase().endsWith('.xlsm')) {
                    errorMessage = 'This file contains macros (.xlsm). Please remove macros and save as .xlsx format before importing.';
                } else {
                    errorMessage = 'Failed to parse Excel file: ' + (error.message || 'Unknown error') + '. Please ensure it is a valid .xlsx file (not .xls or .xlsm) and try re-saving it in Excel.';
                }
                
                this.showError(errorMessage);
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            this.showError('Failed to read Excel file');
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    showSheetSelector(workbook, filename) {
        const sheetOptions = workbook.SheetNames.map((name, index) => 
            `<option value="${name}">${index + 1}. ${name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal" id="sheetSelectorModal">
                <div class="modal-header">
                    <h3 class="modal-title">Select Excel Sheet to Import</h3>
                    <button class="modal-close" id="sheetSelectorModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <p>File: <strong>${filename}</strong></p>
                    <p>This Excel file has multiple sheets. Please select which sheet to import:</p>
                    <div class="form-group">
                        <label for="sheetSelect">Select Sheet:</label>
                        <select id="sheetSelect" class="form-control" style="margin-top: 0.5rem;">
                            ${sheetOptions}
                        </select>
                    </div>
                    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius);">
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                            <i class="fas fa-info-circle"></i> 
                            All rows with a Request Item will be imported. Duplicates will be checked by Request Item and Due Date.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="sheetSelectorModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="sheetSelectorModalImport">
                        <i class="fas fa-file-import"></i> Import Selected Sheet
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.add('active');
        
        // Attach event listeners
        document.getElementById('sheetSelectorModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('sheetSelectorModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('sheetSelectorModalImport').addEventListener('click', () => this.importSelectedSheet());
        
        // Store workbook for later use
        this.currentWorkbook = workbook;
    }

    importSelectedSheet() {
        const sheetName = document.getElementById('sheetSelect').value;
        if (!sheetName) {
            this.showError('Please select a sheet');
            return;
        }
        
        this.closeModal();
        this.processSheet(this.currentWorkbook, sheetName);
        this.currentWorkbook = null;
    }

    processSheet(workbook, sheetName) {
        try {
            console.log(`Processing sheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            
            if (!worksheet) {
                this.showError(`Sheet "${sheetName}" not found`);
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log(`Sheet "${sheetName}" has ${jsonData.length} rows`);
            
            if (jsonData.length < 2) {
                this.showError('Selected sheet appears to be empty or has no data rows');
                return;
            }

            // Extract headers (first row)
            const headers = jsonData[0].map(h => String(h || '').toLowerCase().trim());
            console.log('Headers found:', headers);
            
            // Show preview first so user can see what was detected
            this.showExcelPreview(headers, jsonData.slice(1, 6), workbook, sheetName);
            
        } catch (error) {
            console.error('Error processing sheet:', error);
            this.showError('Failed to process Excel sheet. Check console for details.');
        }
    }

    showExcelPreview(headers, sampleRows, workbook, sheetName) {
        // Find column indices for preview
        const requestItemIdx = this.findColumnIndex(headers, ['request', 'item', 'ritm', 'number', 'ticket']);
        const priorityIdx = this.findColumnIndex(headers, ['priority', 'urgency', 'impact']);
        const assignmentGroupIdx = this.findColumnIndex(headers, ['assignment', 'group', 'assigned', 'team', 'owner']);
        
        // Create preview table
        let previewHtml = `
            <div class="modal" id="previewModal">
                <div class="modal-header">
                    <h3 class="modal-title">Excel Import Preview</h3>
                    <button class="modal-close" id="previewModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0;">Detected Columns:</h4>
                        <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.875rem;">
                            <li>Request Item column: ${requestItemIdx >= 0 ? `<strong>${headers[requestItemIdx]}</strong> (index ${requestItemIdx})` : '<span style="color: var(--danger-color);">NOT FOUND</span>'}</li>
                            <li>Priority column: ${priorityIdx >= 0 ? `<strong>${headers[priorityIdx]}</strong> (index ${priorityIdx})` : '<span style="color: var(--danger-color);">NOT FOUND</span>'}</li>
                            <li>Assignment Group column: ${assignmentGroupIdx >= 0 ? `<strong>${headers[assignmentGroupIdx]}</strong> (index ${assignmentGroupIdx})` : '<span style="color: var(--danger-color);">NOT FOUND</span>'}</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0;">First Few Rows:</h4>
                        <div style="max-height: 200px; overflow: auto; border: 1px solid var(--border-color); border-radius: var(--radius);">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                                <thead>
                                    <tr style="background: var(--bg-tertiary);">
                                        ${headers.map(h => `<th style="padding: 0.5rem; border: 1px solid var(--border-color); text-align: left;">${h}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sampleRows.map((row, i) => `
                                        <tr>
                                            ${headers.map((_, idx) => {
                                                const val = row[idx] || '';
                                                const hasRequestItem = requestItemIdx === idx && val.toString().trim() !== '';
                                                return `<td style="padding: 0.5rem; border: 1px solid var(--border-color); ${hasRequestItem ? 'background: rgba(255, 215, 0, 0.2);' : ''}">${val}</td>`;
                                            }).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius); font-size: 0.875rem;">
                        <p style="margin: 0 0 0.5rem 0;"><i class="fas fa-info-circle" style="color: var(--info-color);"></i> 
                        <strong>Import Rules:</strong></p>
                        <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.8rem;">
                            <li>All rows with a Request Item will be imported</li>
                            <li>Existing items: Only updated if Due Date is different</li>
                            <li>Items <strong>not in this import</strong> will be <strong>removed</strong> (assumed resolved)</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="previewModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="previewModalImport">
                        <i class="fas fa-file-import"></i> Proceed with Import
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = previewHtml;
        modalContainer.classList.add('active');
        
        // Attach event listeners
        document.getElementById('previewModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('previewModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('previewModalImport').addEventListener('click', () => this.confirmImport(sheetName));
        
        // Store data for import
        this.previewData = { workbook, sheetName, headers };
    }

    confirmImport(sheetName) {
        this.closeModal();
        if (this.previewData) {
            this.importFromPreview(this.previewData.workbook, sheetName, this.previewData.headers);
            this.previewData = null;
        }
    }

    importFromPreview(workbook, sheetName, headers) {
        try {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('Raw headers from Excel:', headers);
            console.log('Total rows in Excel:', jsonData.length);
            console.log('First data row:', jsonData[1]);
            
            // Find column indices
            const requestItemIdx = this.findColumnIndex(headers, ['request', 'item', 'ritm', 'number', 'ticket']);
            const priorityIdx = this.findColumnIndex(headers, ['priority', 'urgency', 'impact']);
            const descriptionIdx = this.findColumnIndex(headers, ['description']);
            const shortDescIdx = this.findColumnIndex(headers, ['short', 'summary', 'title']);
            const assignmentGroupIdx = this.findColumnIndex(headers, ['assignment', 'group', 'assigned', 'team', 'owner']);
            const dueDateIdx = this.findColumnIndex(headers, ['due', 'date', 'target', 'end']);
            
            console.log('Importing with column indices:', {
                requestItemIdx,
                priorityIdx,
                assignmentGroupIdx,
                dueDateIdx
            });
            
            if (requestItemIdx === -1) {
                console.error('Could not find Request Item column. Headers found:', headers);
                this.showError('Could not find "Request Item" column. Please ensure your Excel file has a column with "Request" or "Item" in the header.');
                return;
            }

            const vulnerabilities = [];
            let skippedCount = 0;

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) {
                    console.log(`Row ${i}: Empty row, skipping`);
                    continue;
                }

                // Get raw value and handle different data types
                let rawValue = row[requestItemIdx];
                let requestItem = '';
                
                // Handle numbers (Excel sometimes stores request numbers as numbers)
                if (typeof rawValue === 'number') {
                    requestItem = String(rawValue);
                } else if (typeof rawValue === 'string') {
                    requestItem = rawValue.trim();
                } else if (rawValue !== undefined && rawValue !== null) {
                    requestItem = String(rawValue).trim();
                }
                
                console.log(`Row ${i}: Raw value type: ${typeof rawValue}, value:`, rawValue);
                console.log(`Row ${i}: Processed Request Item = "${requestItem}"`);
                
                // Skip rows without a request item
                if (!requestItem || requestItem === '') {
                    console.log(`Row ${i}: No request item found, skipping`);
                    skippedCount++;
                    continue;
                }

                const priority = priorityIdx >= 0 ? String(row[priorityIdx] || '') : '';
                const description = descriptionIdx >= 0 ? String(row[descriptionIdx] || '') : '';
                const shortDescription = shortDescIdx >= 0 ? String(row[shortDescIdx] || '') : '';
                const dueDate = dueDateIdx >= 0 ? this.parseExcelDate(row[dueDateIdx]) : '';
                const assignmentGroup = assignmentGroupIdx >= 0 ? String(row[assignmentGroupIdx] || '') : '';

                const severity = this.mapPriorityToSeverity(priority);

                // Combine descriptions
                const fullDescription = shortDescription 
                    ? `${shortDescription}${description ? '\n\n' + description : ''}`
                    : description;

                // Calculate initial status based on due date
                const initialStatus = this.calculateStatus(dueDate, 'Open');

                vulnerabilities.push({
                    title: requestItem,
                    severity: severity,
                    description: fullDescription || shortDescription || 'No description provided',
                    status: initialStatus,
                    discovered_date: new Date().toISOString().split('T')[0],
                    resolved_date: null,
                    assignment_group: assignmentGroup,
                    due_date: dueDate
                });
            }

            console.log(`Import summary: ${vulnerabilities.length} matched, ${skippedCount} skipped`);
            
            // Show all skipped rows for debugging
            const skippedRows = [];
            for (let i = 1; i < jsonData.length && skippedRows.length < 20; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) {
                    skippedRows.push({row: i + 1, reason: 'Empty row'});
                } else {
                    let rawValue = row[requestItemIdx];
                    let requestItem = '';
                    if (typeof rawValue === 'number') {
                        requestItem = String(rawValue);
                    } else if (typeof rawValue === 'string') {
                        requestItem = rawValue.trim();
                    } else if (rawValue !== undefined && rawValue !== null) {
                        requestItem = String(rawValue).trim();
                    }
                    
                    if (!requestItem || requestItem === '') {
                        skippedRows.push({
                            row: i + 1,
                            reason: 'No request item',
                            rawValue: rawValue,
                            rawValueType: typeof rawValue
                        });
                    }
                }
            }
            
            if (skippedRows.length > 0) {
                console.log('Skipped rows:', skippedRows);
            }
            
            // Show first 10 vulnerabilities that will be imported
            console.log('First 10 vulnerabilities to be imported:');
            vulnerabilities.slice(0, 10).forEach((v, i) => {
                console.log(`  ${i + 1}. ${v.title}`);
            });
            if (vulnerabilities.length > 10) {
                console.log(`  ... and ${vulnerabilities.length - 10} more`);
            }

            if (vulnerabilities.length === 0) {
                this.showError(`No vulnerabilities found with Request Items. Processed ${jsonData.length - 1} rows. Check console for details.`);
                return;
            }

            this.importVulnerabilities(vulnerabilities);
            
        } catch (error) {
            console.error('Error processing sheet:', error);
            this.showError('Failed to process Excel sheet. Check console for details.');
        }
    }

    findColumnIndex(headers, keywords) {
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            for (const keyword of keywords) {
                if (header.includes(keyword.toLowerCase())) {
                    return i;
                }
            }
        }
        return -1;
    }

    parseExcelDate(excelDate) {
        if (!excelDate) return '';
        
        if (typeof excelDate === 'string') {
            const date = new Date(excelDate);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            return excelDate;
        }
        
        if (typeof excelDate === 'number') {
            const epoch = new Date(1899, 11, 30);
            const date = new Date(epoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0];
        }
        
        return '';
    }

    mapPriorityToSeverity(priority) {
        if (!priority) return 'Moderate';
        
        const p = priority.toLowerCase();
        
        if (p.includes('critical') || p.includes('1') || p.includes('urgent')) {
            return 'Critical';
        } else if (p.includes('high') || p.includes('2') || p.includes('major')) {
            return 'High';
        } else if (p.includes('moderate') || p.includes('3') || p.includes('medium')) {
            return 'Moderate';
        } else if (p.includes('low') || p.includes('4') || p.includes('minor')) {
            return 'Low';
        }
        
        return 'Moderate';
    }

    async importVulnerabilities(vulnerabilities) {
        let importedCount = 0;
        let updatedCount = 0;
        let unchangedCount = 0;
        let removedCount = 0;
        let errorCount = 0;

        // Track all request items from the import
        const importedRequestItems = new Set(vulnerabilities.map(v => v.title));
        
        console.log(`Starting import of ${vulnerabilities.length} vulnerabilities...`);
        console.log(`Tracking ${importedRequestItems.size} unique request items from import`);

        // First, remove vulnerabilities not in the new import (assumed resolved)
        let removalErrors = 0;
        try {
            const existingVulnerabilities = await this.db.select('vulnerabilities');
            const toRemove = existingVulnerabilities.filter(v => !importedRequestItems.has(v.title));
            
            if (toRemove.length > 0) {
                console.log(`Removing ${toRemove.length} vulnerabilities not in new import (assumed resolved)`);
                for (const vuln of toRemove) {
                    try {
                        await this.db.delete('vulnerabilities', vuln.id);
                        removedCount++;
                        console.log(`Removed (assumed resolved): ${vuln.title}`);
                    } catch (err) {
                        console.error(`Error removing ${vuln.title}:`, err);
                        removalErrors++;
                    }
                }
            }
        } catch (error) {
            console.error('Error during removal phase:', error);
            removalErrors++;
        }

            // Process the import
            for (const vuln of vulnerabilities) {
                try {
                    // Check for existing vulnerability by title (Request Item)
                    const existing = await this.db.select('vulnerabilities', 'title = ?', [vuln.title]);
                    
                    if (existing.length > 0) {
                        const existingVuln = existing[0];
                        
                        // Check if any fields need updating
                        const needsUpdate = (
                            (vuln.due_date && existingVuln.due_date !== vuln.due_date) ||
                            (vuln.assignment_group && existingVuln.assignment_group !== vuln.assignment_group)
                        );
                        
                        if (needsUpdate) {
                            const updateData = {};
                            const updateNotes = [];
                            
                            // Check due date
                            if (vuln.due_date && existingVuln.due_date !== vuln.due_date) {
                                const oldDate = existingVuln.due_date;
                                const newDate = vuln.due_date;
                                updateData.due_date = newDate;
                                updateData.status = this.calculateStatus(newDate, existingVuln.status);
                                updateNotes.push(`Due Date: ${oldDate} → ${newDate}`);
                            }
                            
                            // Check assignment group
                            if (vuln.assignment_group && existingVuln.assignment_group !== vuln.assignment_group) {
                                const oldGroup = existingVuln.assignment_group;
                                const newGroup = vuln.assignment_group;
                                updateData.assignment_group = newGroup;
                                updateNotes.push(`Assignment Group: ${oldGroup} → ${newGroup}`);
                            }
                            
                            try {
                                await this.db.update('vulnerabilities', existingVuln.id, updateData);
                                
                                // Add note about changes to description
                                if (updateNotes.length > 0) {
                                    const note = `\n\n[Updated ${new Date().toLocaleDateString()}]: ${updateNotes.join(', ')}`;
                                    const updatedDescription = (existingVuln.description || '') + note;
                                    await this.db.update('vulnerabilities', existingVuln.id, { description: updatedDescription });
                                }
                                
                                // Removed success log to reduce output for large imports
                                updatedCount++;
                            } catch (updateError) {
                                // Handle 404 - vulnerability might have been deleted
                                if (updateError.message && updateError.message.includes('404')) {
                                    console.warn(`Vulnerability ${existingVuln.id} not found during update, creating new instead`);
                                    // Create as new vulnerability
                                    const newVuln = {
                                        ...vuln,
                                        title: vuln.title
                                    };
                                    await this.db.insert('vulnerabilities', newVuln);
                                    importedCount++;
                                    updatedCount--; // Don't count as update since it's now new
                                    continue;
                                } else {
                                    throw updateError; // Re-throw non-404 errors
                                }
                            }
                        } else {
                            // Same data, ignore
                            unchangedCount++;
                        }
                    } else {
                        // Insert new vulnerability
                        await this.db.insert('vulnerabilities', vuln);
                        importedCount++;
                    }
                } catch (err) {
                    console.error(`Error processing vulnerability ${vuln.title}:`, err);
                    errorCount++;
                }
            }
                            
                            // Check assignment group
                            if (vuln.assignment_group && existingVuln.assignment_group !== vuln.assignment_group) {
                                const oldGroup = existingVuln.assignment_group;
                                const newGroup = vuln.assignment_group;
                                updateData.assignment_group = newGroup;
                                updateNotes.push(`Assignment Group: ${oldGroup} → ${newGroup}`);
                            }
                            
                            try {
                                await this.db.update('vulnerabilities', existingVuln.id, updateData);
                                
                                // Add note about changes to description
                                if (updateNotes.length > 0) {
                                    const note = `\n\n[Updated ${new Date().toLocaleDateString()}]: ${updateNotes.join(', ')}`;
                                    const updatedDescription = (existingVuln.description || '') + note;
                                    await this.db.update('vulnerabilities', existingVuln.id, { description: updatedDescription });
                                }
                                
                                console.log(`Updated vulnerability: ${vuln.title} (${updateNotes.join(', ')})`);
                                updatedCount++;
                            } catch (updateError) {
                                console.error(`Failed to update ${vuln.title}:`, updateError);
                                
                                // Handle 404 - vulnerability might have been deleted
                                if (updateError.message && updateError.message.includes('404')) {
                                    console.warn(`Vulnerability ${existingVuln.id} not found during update, creating new instead`);
                                    // Create as new vulnerability
                                    const newVuln = {
                                        ...vuln,
                                        title: vuln.title
                                    };
                                    await this.db.insert('vulnerabilities', newVuln);
                                    importedCount++;
                                    updatedCount--; // Don't count as update since it's now new
                                    console.log(`Created new vulnerability (404 recovery): ${vuln.title}`);
                                    continue;
                                } else {
                                    throw updateError; // Re-throw non-404 errors
                                }
                            }
                        } else {
                            // Same data, ignore
                            unchangedCount++;
                            console.log(`Ignored duplicate (no changes): ${vuln.title}`);
                        }
                    } else {
                        // Insert new vulnerability
                        try {
                            await this.db.insert('vulnerabilities', vuln);
                            importedCount++;
                            console.log(`Inserted new vulnerability: ${vuln.title}`);
                        } catch (insertError) {
                            console.error(`Failed to insert ${vuln.title}:`, insertError);
                            
                            // Handle duplicate title error during insert
                            if (insertError.message && insertError.message.includes('Duplicate entry')) {
                                console.log(`Duplicate title detected for ${vuln.title}, treating as update instead`);
                                // Try to update existing instead
                                const existing = await this.db.select('vulnerabilities', 'title = ?', [vuln.title]);
                                if (existing.length > 0) {
                                    const updateData = {};
                                    const updateNotes = [];
                                    
                                    // Update all fields
                                    if (vuln.severity && existingVuln.severity !== vuln.severity) {
                                        updateData.severity = vuln.severity;
                                        updateNotes.push(`Severity: ${existingVuln.severity} → ${vuln.severity}`);
                                    }
                                    if (vuln.description && existingVuln.description !== vuln.description) {
                                        updateData.description = vuln.description;
                                        updateNotes.push('Description updated');
                                    }
                                    if (vuln.assignment_group && existingVuln.assignment_group !== vuln.assignment_group) {
                                        updateData.assignment_group = vuln.assignment_group;
                                        updateNotes.push(`Assignment Group: ${existingVuln.assignment_group} → ${vuln.assignment_group}`);
                                    }
                                    if (vuln.due_date && existingVuln.due_date !== vuln.due_date) {
                                        updateData.due_date = vuln.due_date;
                                        updateData.status = this.calculateStatus(vuln.due_date, existingVuln.status);
                                        updateNotes.push(`Due Date: ${existingVuln.due_date} → ${vuln.due_date}`);
                                    }
                                    if (vuln.discovered_date && existingVuln.discovered_date !== vuln.discovered_date) {
                                        updateData.discovered_date = vuln.discovered_date;
                                        updateNotes.push('Discovered Date updated');
                                    }
                                    
                                    if (Object.keys(updateData).length > 0) {
                                        await this.db.update('vulnerabilities', existing[0].id, updateData);
                                        updatedCount++;
                                        console.log(`Updated vulnerability (from duplicate): ${vuln.title} (${updateNotes.join(', ')})`);
                                    }
                                }
                            } else {
                                throw insertError;
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error processing vulnerability ${vuln.title}:`, err);
                    errorCount++;
                }
            }
                        
                        // Check assignment group
                        if (vuln.assignment_group && existingVuln.assignment_group !== vuln.assignment_group) {
                            const oldGroup = existingVuln.assignment_group;
                            const newGroup = vuln.assignment_group;
                            updateData.assignment_group = newGroup;
                            updateNotes.push(`Assignment Group: ${oldGroup} → ${newGroup}`);
                        }
                        
                        try {
                            await this.db.update('vulnerabilities', existingVuln.id, updateData);
                            
                            // Add note about changes to description
                            if (updateNotes.length > 0) {
                                const note = `\n\n[Updated ${new Date().toLocaleDateString()}]: ${updateNotes.join(', ')}`;
                                const updatedDescription = (existingVuln.description || '') + note;
                                await this.db.update('vulnerabilities', existingVuln.id, { description: updatedDescription });
                            }
                        } catch (updateError) {
                            // Handle 404 - vulnerability might have been deleted
                            if (updateError.message && updateError.message.includes('404')) {
                                console.warn(`Vulnerability ${existingVuln.id} not found during update, creating new instead`);
                                // Create as new vulnerability
                                const newVuln = {
                                    ...vuln,
                                    title: vuln.title
                                };
                                await this.db.insert('vulnerabilities', newVuln);
                                importedCount++;
                                updatedCount--; // Don't count as update since it's now new
                                console.log(`Created new vulnerability (404 recovery): ${vuln.title}`);
                                continue;
                            } else {
                                throw updateError; // Re-throw non-404 errors
                            }
                        }
                        
                        console.log(`Updated vulnerability: ${vuln.title} (${updateNotes.join(', ')})`);
                        updatedCount++;
                    } else {
                        // Same data, ignore
                        unchangedCount++;
                        console.log(`Ignored duplicate (no changes): ${vuln.title}`);
                    }
                } else {
                    // Insert new vulnerability
                    console.log(`Inserting: ${vuln.title}`);
                    await this.db.insert('vulnerabilities', vuln);
                    importedCount++;
                }
                
            } catch (error) {
                console.error(`Error importing vulnerability ${vuln.title}:`, error);
                errorCount++;
            }
        }

        console.log(`Import complete: ${importedCount} new, ${updatedCount} updated, ${removedCount} removed, ${unchangedCount} unchanged, ${errorCount} errors`);

        // Force refresh of the display
        // Store import statistics for dashboard display
        const importStats = {
            added: importedCount,
            resolved: removedCount,
            updated: updatedCount,
            timestamp: new Date().toLocaleString()
        };
        localStorage.setItem('lastVulnerabilityImport', JSON.stringify(importStats));
        console.log('Import statistics saved:', importStats);

        setTimeout(async () => {
            console.log('Refreshing vulnerabilities display after import...');
            
            // First recalculate statuses to ensure database is up to date
            console.log('Starting status recalculation...');
            await this.recalculateAllStatuses();
            console.log('Status recalculation complete');
            
            // Then load vulnerabilities  
            console.log('Loading vulnerabilities...');
            await this.loadVulnerabilities();
            console.log('Vulnerabilities loaded');
            
            // Longer delay to ensure database has processed all updates
            console.log('Waiting for database to settle...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update dashboard with fresh data
            if (window.dashboardManager) {
                console.log('Updating dashboard...');
                await window.dashboardManager.updateDashboard();
                console.log('Dashboard updated');
            }
            
            // Verify import by checking count
            const allVulns = await this.db.select('vulnerabilities');
            console.log(`Total vulnerabilities in database: ${allVulns.length}`);
            
            // Show appropriate message
            let message = '';
            const totalProcessed = importedCount + removedCount + updatedCount + unchangedCount;
            const successRate = totalProcessed > 0 ? ((totalProcessed - errorCount) / totalProcessed * 100) : 100;
            
            // Only show error if more than 10% of items failed
            if (errorCount === 0 || successRate >= 90) {
                // Build message focusing on new additions and removals
                const parts = [];
                
                if (importedCount > 0) {
                    parts.push(`${importedCount} new added`);
                }
                
                if (removedCount > 0) {
                    parts.push(`${removedCount} removed (resolved)`);
                }
                
                if (updatedCount > 0) {
                    parts.push(`${updatedCount} updated`);
                }
                
                if (parts.length > 0) {
                    message = `Import complete: ${parts.join(', ')}. Total: ${allVulns.length}`;
                    if (errorCount > 0) {
                        message += ` (${errorCount} skipped)`;
                    }
                } else if (unchangedCount > 0) {
                    message = `No changes needed. ${unchangedCount} vulnerabilities already up-to-date.`;
                } else {
                    message = `Import completed. No new or updated vulnerabilities.`;
                }
                this.showSuccess(message);
            } else {
                this.showError(`Import completed with ${errorCount} errors. ${importedCount} new, ${removedCount} removed, ${updatedCount} updated. Check console.`);
            }
        }, 100);
    }

    showVulnerabilityModal(vulnerability = null) {
        const modalHtml = `
            <div class="modal" id="vulnerabilityModal">
                <div class="modal-header">
                    <h3 class="modal-title">${vulnerability ? 'Edit Vulnerability' : 'Add New Vulnerability'}</h3>
                    <button class="modal-close" id="vulnerabilityModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="vulnerabilityForm">
                        <div class="form-group">
                            <label for="vulnerabilityTitle">Request Item / Title *</label>
                            <input type="text" id="vulnerabilityTitle" class="form-control" required 
                                   value="${this.escapeHtml(vulnerability?.title || '')}" placeholder="Enter request item or title">
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilitySeverity">Severity Level *</label>
                            <select id="vulnerabilitySeverity" class="form-control" required>
                                <option value="">Select Severity</option>
                                <option value="Low" ${vulnerability?.severity === 'Low' ? 'selected' : ''}>Low</option>
                                <option value="Moderate" ${vulnerability?.severity === 'Moderate' ? 'selected' : ''}>Moderate</option>
                                <option value="High" ${vulnerability?.severity === 'High' ? 'selected' : ''}>High</option>
                                <option value="Critical" ${vulnerability?.severity === 'Critical' ? 'selected' : ''}>Critical</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityDescription">Description</label>
                            <textarea id="vulnerabilityDescription" class="form-control" rows="4" 
                                      placeholder="Enter detailed description">${this.escapeHtml(vulnerability?.description || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityAssignmentGroup">Assignment Group</label>
                            <input type="text" id="vulnerabilityAssignmentGroup" class="form-control" 
                                   value="${this.escapeHtml(vulnerability?.assignment_group || '')}" 
                                   placeholder="Enter assignment group">
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityDueDate">Due Date</label>
                            <input type="date" id="vulnerabilityDueDate" class="form-control" 
                                   value="${vulnerability?.due_date || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityStatus">Status</label>
                            <select id="vulnerabilityStatus" class="form-control">
                                <option value="Open" ${vulnerability?.status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="Due" ${vulnerability?.status === 'Due' ? 'selected' : ''}>Due</option>
                                <option value="Breached" ${vulnerability?.status === 'Breached' ? 'selected' : ''}>Breached</option>
                                <option value="Resolved" ${vulnerability?.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityDiscoveredDate">Discovered Date</label>
                            <input type="date" id="vulnerabilityDiscoveredDate" class="form-control" 
                                   value="${vulnerability?.discovered_date || new Date().toISOString().split('T')[0]}">
                        </div>
                        
                        <div class="form-group">
                            <label for="vulnerabilityResolvedDate">Resolved Date</label>
                            <input type="date" id="vulnerabilityResolvedDate" class="form-control" 
                                   value="${vulnerability?.resolved_date || ''}" 
                                   placeholder="Set when vulnerability is resolved">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="vulnerabilityModalCancel">Cancel</button>
                    <button type="button" class="btn btn-primary" id="vulnerabilityModalSave">
                        ${vulnerability ? 'Update Vulnerability' : 'Add Vulnerability'}
                    </button>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHtml;
        modalContainer.classList.add('active');

        // Attach event listeners
        const vulnerabilityId = vulnerability?.id || null;
        
        document.getElementById('vulnerabilityModalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('vulnerabilityModalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('vulnerabilityModalSave').addEventListener('click', () => this.saveVulnerability(vulnerabilityId));

        setTimeout(() => {
            const titleInput = document.getElementById('vulnerabilityTitle');
            if (titleInput) titleInput.focus();
        }, 100);

        const statusSelect = document.getElementById('vulnerabilityStatus');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                const resolvedDateField = document.getElementById('vulnerabilityResolvedDate');
                if (e.target.value === 'Resolved' && !resolvedDateField.value) {
                    resolvedDateField.value = new Date().toISOString().split('T')[0];
                }
            });
        }
    }

    async saveVulnerability(vulnerabilityId) {
        try {
            const formData = {
                title: document.getElementById('vulnerabilityTitle').value.trim(),
                severity: document.getElementById('vulnerabilitySeverity').value,
                description: document.getElementById('vulnerabilityDescription').value.trim(),
                assignment_group: document.getElementById('vulnerabilityAssignmentGroup').value.trim(),
                due_date: document.getElementById('vulnerabilityDueDate').value,
                status: document.getElementById('vulnerabilityStatus').value,
                discovered_date: document.getElementById('vulnerabilityDiscoveredDate').value,
                resolved_date: document.getElementById('vulnerabilityResolvedDate').value
            };

            if (!formData.title) {
                this.showError('Title is required');
                return;
            }

            if (!formData.severity) {
                this.showError('Severity level is required');
                return;
            }

            if (!formData.discovered_date) {
                formData.discovered_date = new Date().toISOString().split('T')[0];
            }

            if (formData.status === 'Resolved' && !formData.resolved_date) {
                formData.resolved_date = new Date().toISOString().split('T')[0];
            }

            if (formData.status !== 'Resolved') {
                formData.resolved_date = null;
            }

            if (vulnerabilityId) {
                await this.db.update('vulnerabilities', vulnerabilityId, formData);
                this.showSuccess('Vulnerability updated successfully');
            } else {
                await this.db.insert('vulnerabilities', formData);
                this.showSuccess('Vulnerability added successfully');
            }

            this.closeModal();
            await this.loadVulnerabilities();
            
            // Recalculate all statuses after manual edit
            await this.recalculateAllStatuses();
            
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }

        } catch (error) {
            console.error('Error saving vulnerability:', error);
            this.showError('Failed to save vulnerability');
        }
    }

    async editVulnerability(vulnerabilityId) {
        try {
            const vulnerabilities = await this.db.select('vulnerabilities', 'id = ?', [vulnerabilityId]);
            if (vulnerabilities.length > 0) {
                this.showVulnerabilityModal(vulnerabilities[0]);
            } else {
                this.showError('Vulnerability not found');
            }
        } catch (error) {
            console.error('Error loading vulnerability for edit:', error);
            this.showError('Failed to load vulnerability');
        }
    }

    async deleteVulnerability(vulnerabilityId) {
        if (!confirm('Are you sure you want to delete this vulnerability? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.delete('vulnerabilities', vulnerabilityId);
            this.showSuccess('Vulnerability deleted successfully');
            await this.loadVulnerabilities();
            
            if (window.dashboardManager) {
                window.dashboardManager.updateDashboard();
            }
        } catch (error) {
            console.error('Error deleting vulnerability:', error);
            this.showError('Failed to delete vulnerability');
        }
    }

    getSeverityClass(severity) {
        switch (severity) {
            case 'Critical': return 'danger';
            case 'High': return 'warning';
            case 'Moderate': return 'info';
            case 'Medium': return 'info';
            case 'Low': return 'success';
            default: return 'secondary';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'Open': return 'success';
            case 'Due': return 'warning';
            case 'Breached': return 'danger';
            case 'In Progress': return 'info';
            case 'Resolved': return 'secondary';
            default: return 'success';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
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

    escapeCsv(text) {
        if (!text) return '';
        return String(text).replace(/"/g, '""');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    getVulnerabilityStats() {
        try {
            const stats = this.db.getDashboardStats();
            return stats.vulnerabilities;
        } catch (error) {
            console.error('Error getting vulnerability stats:', error);
            return {
                total: 0,
                open: 0,
                inProgress: 0,
                resolved: 0,
                bySeverity: []
            };
        }
    }

    getVulnerabilityChartData() {
        try {
            const result = this.db.query(`
                SELECT severity, COUNT(*) as count 
                FROM vulnerabilities 
                GROUP BY severity
            `);
            return this.db.formatQueryResult(result);
        } catch (error) {
            console.error('Error getting vulnerability chart data:', error);
            return [];
        }
    }

    getVulnerabilityTrends(days = 30) {
        try {
            const result = this.db.query(`
                SELECT 
                    DATE(discovered_date) as date,
                    COUNT(*) as count
                FROM vulnerabilities 
                WHERE discovered_date >= date('now', '-${days} days')
                GROUP BY DATE(discovered_date)
                ORDER BY date
            `);
            return this.db.formatQueryResult(result);
        } catch (error) {
            console.error('Error getting vulnerability trends:', error);
            return [];
        }
    }
}

// Initialize vulnerabilities manager when database is ready
async function initVulnerabilitiesManager() {
    console.log('=== initVulnerabilitiesManager() START ===');
    
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
            console.log('Creating VulnerabilitiesManager...');
            window.vulnerabilitiesManager = new VulnerabilitiesManager(window.dbManager);
            console.log('Vulnerabilities manager CREATED and assigned to window.vulnerabilitiesManager');
            
            // Initialize the manager fully
            console.log('Initializing VulnerabilitiesManager...');
            await window.vulnerabilitiesManager.init();
            console.log('VulnerabilitiesManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initVulnerabilitiesManager:', error);
    }
    
    console.log('=== initVulnerabilitiesManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initVulnerabilitiesManager');
    initVulnerabilitiesManager();
});

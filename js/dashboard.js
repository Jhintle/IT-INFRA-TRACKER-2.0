// Dashboard Management Module
class DashboardManager {
    constructor(database) {
        this.db = database;
        this.charts = {};
    }

    async init() {
        await this.updateDashboard();
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Global search with debouncing to reduce DOM updates
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.performGlobalSearch(e.target.value);
                }, 300); // Wait 300ms after user stops typing
            });
        }
    }

    destroyCharts() {
        // Properly cleanup charts to prevent memory leaks
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });
    }

    async updateDashboard() {
        await this.updateSummaryCards();
        await this.updateCharts();
    }

    async updateSummaryCards() {
        console.log('updateSummaryCards() called');
        try {
            console.log('Fetching dashboard stats...');
            const stats = await this.db.getDashboardStats();
            console.log('Received stats:', stats);

            // Update project count
            const projectsEl = document.getElementById('projectsCount');
            console.log('Projects element:', projectsEl);
            if (projectsEl) {
                projectsEl.textContent = stats.projects.total;
                console.log('Updated projects count to:', stats.projects.total);
            } else {
                console.error('projectsCount element not found!');
            }
            
            // Update weekly tasks count
            const weeklyEl = document.getElementById('weeklyTasksCount');
            console.log('Weekly tasks element:', weeklyEl);
            if (weeklyEl) {
                weeklyEl.textContent = stats.weekly_tasks.thisWeek;
                console.log('Updated weekly tasks count to:', stats.weekly_tasks.thisWeek);
            } else {
                console.error('weeklyTasksCount element not found!');
            }
            
            // Update vulnerabilities count (include Open, Due, and Breached)
            const activeVulnerabilities = stats.vulnerabilities.open + stats.vulnerabilities.due + stats.vulnerabilities.breached;
            const vulnEl = document.getElementById('vulnerabilitiesCount');
            console.log('Vulnerabilities element:', vulnEl);
            if (vulnEl) {
                vulnEl.textContent = activeVulnerabilities;
                console.log('Updated vulnerabilities count to:', activeVulnerabilities);
            } else {
                console.error('vulnerabilitiesCount element not found!');
            }
            
            // Update risks count
            const risksEl = document.getElementById('risksCount');
            console.log('Risks element:', risksEl);
            if (risksEl) {
                risksEl.textContent = stats.risks.total;
                console.log('Updated risks count to:', stats.risks.total);
            } else {
                console.error('risksCount element not found!');
            }
            
            // Update critical tasks count
            const criticalEl = document.getElementById('criticalTasksCount');
            console.log('Critical tasks element:', criticalEl);
            if (criticalEl) {
                criticalEl.textContent = stats.critical_tasks.total;
                console.log('Updated critical tasks count to:', stats.critical_tasks.total);
            } else {
                console.error('criticalTasksCount element not found!');
            }

        } catch (error) {
            console.error('Error updating summary cards:', error);
        }
    }

    async updateCharts() {
        console.log('updateCharts() called');
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded, skipping chart updates');
            return;
        }
        console.log('Chart.js is loaded, updating charts...');
        await this.updateVulnerabilityChart();
        await this.updateProjectChart();
        console.log('Charts updated');
    }

    async updateVulnerabilityChart() {
        try {
            console.log('Updating vulnerability chart...');
            const ctx = document.getElementById('vulnerabilityChart');
            if (!ctx) {
                console.error('Vulnerability chart canvas not found!');
                return;
            }
            
            console.log('Canvas found:', ctx);
            
            // Ensure canvas has proper dimensions
            const container = ctx.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                console.log('Container dimensions:', rect.width, 'x', rect.height);
                if (rect.width === 0 || rect.height === 0) {
                    console.error('Chart container has zero dimensions!');
                    return;
                }
            }

            const stats = await this.db.getDashboardStats();
            console.log('Dashboard stats:', stats);
            
            if (!stats || !stats.vulnerabilities || !stats.vulnerabilities.bySeverity) {
                console.error('Invalid stats data:', stats);
                return;
            }
            
            const severityData = stats.vulnerabilities.bySeverity;
            console.log('Severity data:', severityData);

            // Prepare data for chart
            const labels = ['Low', 'Medium', 'High', 'Critical'];
            const data = [0, 0, 0, 0];
            const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444'];

            severityData.forEach(item => {
                const index = labels.indexOf(item.severity);
                if (index !== -1) {
                    data[index] = item.count;
                }
            });
            
            console.log('Chart data:', data);
            
            // Check if all data is 0 - if so, show empty state
            const totalVulns = data.reduce((a, b) => a + b, 0);
            
            if (totalVulns === 0) {
                console.log('No vulnerabilities to display in chart');
                // Destroy existing chart if it exists
                if (this.charts.vulnerability) {
                    this.charts.vulnerability.destroy();
                    this.charts.vulnerability = null;
                }
                // Show "No Data" message
                let noDataMsg = container.querySelector('.no-data-message');
                if (!noDataMsg) {
                    noDataMsg = document.createElement('div');
                    noDataMsg.className = 'no-data-message';
                    noDataMsg.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; text-align: center; color: var(--text-secondary);';
                    noDataMsg.innerHTML = '<i class="fas fa-shield-alt" style="font-size: 4rem; opacity: 0.2; margin-bottom: 1rem;"></i><span style="font-size: 1.1rem;">No vulnerabilities to display</span><span style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.7;">Import data or add vulnerabilities to see the chart</span>';
                    container.appendChild(noDataMsg);
                }
                return;
            } else {
                // Remove no data message if it exists
                const noDataMsg = container.querySelector('.no-data-message');
                if (noDataMsg) {
                    noDataMsg.remove();
                }
            }

            // Destroy existing chart if it exists
            if (this.charts.vulnerability) {
                console.log('Destroying existing vulnerability chart');
                this.charts.vulnerability.destroy();
            }

            // Create new chart with natural aspect ratio
            console.log('Creating new vulnerability chart...');
            this.charts.vulnerability = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 15,
                                padding: 15,
                                font: {
                                    size: 12,
                                    family: "'Work Sans', sans-serif"
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: 20
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true
                    }
                }
            });
            
            console.log('Vulnerability chart created successfully');

        } catch (error) {
            console.error('Error updating vulnerability chart:', error);
            console.error('Error stack:', error.stack);
        }
    }

    async updateProjectChart() {
        try {
            const ctx = document.getElementById('projectChart');
            if (!ctx) return;

            // Get project status data from API
            let statusData = [];
            try {
                const projects = await this.db.select('projects');
                const statusCounts = {};
                projects.forEach(p => {
                    const status = p.status || 'Active';
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                });
                statusData = Object.keys(statusCounts).map(status => ({
                    status,
                    count: statusCounts[status]
                }));
            } catch (err) {
                console.error('Error fetching projects for chart:', err);
                statusData = [];
            }

            // Prepare data for chart
            const labels = ['Active', 'On Hold', 'Completed'];
            const data = [0, 0, 0];
            const colors = ['#10b981', '#f59e0b', '#06b6d4'];

            statusData.forEach(item => {
                const index = labels.indexOf(item.status);
                if (index !== -1) {
                    data[index] = item.count;
                }
            });

            // Destroy existing chart if it exists
            if (this.charts.project) {
                this.charts.project.destroy();
            }

            // Create new chart
            this.charts.project = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Projects',
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: 11
                                }
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 11
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    layout: {
                        padding: 10
                    }
                }
            });

        } catch (error) {
            console.error('Error updating project chart:', error);
        }
    }

    async performGlobalSearch(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            this.clearSearchResults();
            return;
        }

        try {
            const results = await this.db.searchAll(searchTerm);
            await this.displaySearchResults(results, searchTerm);
        } catch (error) {
            console.error('Error performing global search:', error);
        }
    }

    async displaySearchResults(results, searchTerm) {
        // Create or update search results container
        let searchResultsContainer = document.getElementById('searchResults');
        if (!searchResultsContainer) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'searchResults';
            searchResultsContainer.className = 'search-results-container';
            
            // Insert after dashboard header
            const dashboardHeader = document.querySelector('.dashboard-header');
            dashboardHeader.insertAdjacentElement('afterend', searchResultsContainer);
        }

        const hasResults = Object.values(results).some(array => array.length > 0);

        if (!hasResults) {
            searchResultsContainer.innerHTML = `
                <div class="search-results empty">
                    <h3>No results found for "${searchTerm}"</h3>
                    <p>Try searching with different keywords</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="search-results">
                <div class="search-results-header">
                    <h3>Search Results for "${searchTerm}"</h3>
                    <button class="btn btn-secondary btn-sm" onclick="dashboardManager.clearSearchResults()">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
        `;

        // Projects results
        if (results.projects.length > 0) {
            html += `
                <div class="search-section">
                    <h4><i class="fas fa-project-diagram"></i> Projects (${results.projects.length})</h4>
                    <div class="search-results-grid">
                        ${results.projects.map(project => `
                            <div class="search-result-item" onclick="dashboardManager.navigateToItem('projects', ${project.id})">
                                <strong>${this.escapeHtml(project.title)}</strong>
                                <p>${this.escapeHtml(project.description || '').substring(0, 100)}...</p>
                                <span class="badge badge-${this.getProjectStatusClass(project.status)}">${project.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Weekly Tasks results
        if (results.weekly_tasks.length > 0) {
            html += `
                <div class="search-section">
                    <h4><i class="fas fa-calendar-week"></i> Weekly Tasks (${results.weekly_tasks.length})</h4>
                    <div class="search-results-grid">
                        ${results.weekly_tasks.map(task => `
                            <div class="search-result-item" onclick="dashboardManager.navigateToItem('weekly-tasks', ${task.id})">
                                <strong>${this.escapeHtml(task.title)}</strong>
                                <p>Assigned to: ${this.escapeHtml(task.assigned_team || 'Unassigned')}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Vulnerabilities results
        if (results.vulnerabilities.length > 0) {
            html += `
                <div class="search-section">
                    <h4><i class="fas fa-shield-alt"></i> Vulnerabilities (${results.vulnerabilities.length})</h4>
                    <div class="search-results-grid">
                        ${results.vulnerabilities.map(vuln => `
                            <div class="search-result-item" onclick="dashboardManager.navigateToItem('vulnerabilities', ${vuln.id})">
                                <strong>${this.escapeHtml(vuln.title)}</strong>
                                <p>${this.escapeHtml(vuln.description || '').substring(0, 100)}...</p>
                                <span class="badge badge-${this.getSeverityClass(vuln.severity)}">${vuln.severity}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Risks results
        if (results.risk_register.length > 0) {
            html += `
                <div class="search-section">
                    <h4><i class="fas fa-exclamation-triangle"></i> Risk Register (${results.risk_register.length})</h4>
                    <div class="search-results-grid">
                        ${results.risk_register.map(risk => `
                            <div class="search-result-item" onclick="dashboardManager.navigateToItem('risks', ${risk.id})">
                                <strong>${this.escapeHtml(risk.risk_description)}</strong>
                                <p>${this.escapeHtml(risk.required_action || '').substring(0, 100)}...</p>
                                <span class="badge badge-${this.getRiskStatusClass(risk.status)}">${risk.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Critical Tasks results
        if (results.critical_tasks.length > 0) {
            html += `
                <div class="search-section">
                    <h4><i class="fas fa-fire"></i> Critical Tasks (${results.critical_tasks.length})</h4>
                    <div class="search-results-grid">
                        ${results.critical_tasks.map(task => `
                            <div class="search-result-item" onclick="dashboardManager.navigateToItem('critical-tasks', ${task.id})">
                                <strong>${this.escapeHtml(task.title)}</strong>
                                <p>${this.escapeHtml(task.description || '').substring(0, 100)}...</p>
                                <span class="badge badge-${this.getPriorityClass(task.priority)}">${task.priority}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        searchResultsContainer.innerHTML = html;
    }

    clearSearchResults() {
        const searchResultsContainer = document.getElementById('searchResults');
        if (searchResultsContainer) {
            searchResultsContainer.remove();
        }
        
        // Clear search input
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.value = '';
        }
    }

    navigateToItem(module, itemId) {
        // Switch to the appropriate tab
        const tabButton = document.querySelector(`[data-tab="${module}"]`);
        if (tabButton) {
            // Remove active class from all tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to selected tab
            tabButton.classList.add('active');
            
            // Show corresponding content
            const contentElement = document.getElementById(module);
            if (contentElement) {
                contentElement.classList.add('active');
                
                // Initialize the module if needed and scroll to item
                setTimeout(() => {
                    this.scrollToItem(module, itemId);
                }, 300);
            }
        }
        
        // Clear search results
        this.clearSearchResults();
    }

    scrollToItem(module, itemId) {
        // Find the table row with the specific item
        const tbody = document.querySelector(`#${module} .data-table tbody`);
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const actionButtons = row.querySelector('.action-buttons');
                if (actionButtons) {
                    const editButton = actionButtons.querySelector('[onclick*="' + itemId + '"]');
                    if (editButton) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight the row temporarily
                        row.style.backgroundColor = 'var(--warning-color)';
                        row.style.color = 'white';
                        setTimeout(() => {
                            row.style.backgroundColor = '';
                            row.style.color = '';
                        }, 2000);
                    }
                }
            });
        }
    }

    // Helper methods for getting CSS classes
    getProjectStatusClass(status) {
        switch (status) {
            case 'Active': return 'success';
            case 'On Hold': return 'warning';
            case 'Completed': return 'info';
            default: return 'secondary';
        }
    }

    getSeverityClass(severity) {
        switch (severity) {
            case 'Critical': return 'danger';
            case 'High': return 'warning';
            case 'Medium': return 'info';
            case 'Low': return 'success';
            default: return 'secondary';
        }
    }

    getRiskStatusClass(status) {
        switch (status) {
            case 'Active': return 'danger';
            case 'Monitoring': return 'warning';
            case 'Resolved': return 'success';
            default: return 'secondary';
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add styles for search results
const searchStyles = document.createElement('style');
searchStyles.textContent = `
    .search-results-container {
        margin-bottom: 2rem;
        background: var(--bg-primary);
        border-radius: var(--radius);
        box-shadow: var(--shadow-md);
        overflow: hidden;
    }
    
    .search-results {
        padding: 1.5rem;
    }
    
    .search-results.empty {
        text-align: center;
        padding: 2rem;
    }
    
    .search-results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-color);
    }
    
    .search-section {
        margin-bottom: 2rem;
    }
    
    .search-section:last-child {
        margin-bottom: 0;
    }
    
    .search-section h4 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        color: var(--text-primary);
        font-weight: 600;
    }
    
    .search-results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
    }
    
    .search-result-item {
        padding: 1rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        cursor: pointer;
        transition: var(--transition);
    }
    
    .search-result-item:hover {
        background: var(--bg-tertiary);
        border-color: var(--primary-color);
        transform: translateY(-2px);
    }
    
    .search-result-item strong {
        display: block;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
    }
    
    .search-result-item p {
        margin-bottom: 0.75rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
        line-height: 1.4;
    }
    
    .search-result-item .badge {
        font-size: 0.75rem;
    }
`;
document.head.appendChild(searchStyles);

// Initialize dashboard manager when database is ready
async function initDashboardManager() {
    console.log('=== initDashboardManager() START ===');
    
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
            console.log('Creating DashboardManager...');
            window.dashboardManager = new DashboardManager(window.dbManager);
            console.log('Dashboard manager CREATED and assigned to window.dashboardManager');
            
            // Initialize the manager fully
            console.log('Initializing DashboardManager...');
            await window.dashboardManager.init();
            window.dashboardManager.initialized = true;
            console.log('DashboardManager initialization completed');
        } else {
            console.error('ERROR: window.dbManager is null after waiting!');
        }
    } catch (error) {
        console.error('ERROR in initDashboardManager:', error);
    }
    
    console.log('=== initDashboardManager() END ===');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initDashboardManager');
    initDashboardManager();
});
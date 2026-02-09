// Main Application Controller
class App {
    constructor() {
        this.db = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.isInitialized = false;
        this.autoSwitchInterval = null;
        this.tabs = ['dashboard', 'projects', 'weekly-tasks', 'vulnerabilities', 'risks', 'critical-tasks'];
        this.currentTabIndex = 0;
        this.isAutoSwitchPaused = false;
        this.userActivityTimeout = null;
        this.ACTIVITY_DELAY = 30000; // Resume auto-switch after 30 seconds of inactivity
    }

    async init() {
        console.log('App init started...');
        try {
            // Wait for database to be ready
            if (window.dbManager && window.dbManager.ready) {
                console.log('Waiting for database to be ready...');
                await window.dbManager.ready;
                console.log('Database is ready');
            }
            
            // Initialize database link
            this.db = window.dbManager;
            
            // Set theme
            this.setTheme(this.currentTheme);
            
            // Initialize navigation IMMEDIATELY so tabs work
            this.initNavigation();
            
            // Initialize theme toggle
            this.initThemeToggle();
            
            // Initialize export functionality
            this.initExport();
            
            // Initialize demo data loader
            this.initDemoData();
            
            // Initialize clear data functionality
            this.initClearData();

            // Initialize modal backdrop click handler
            this.initModalBackdrop();

            // Show dashboard by default
            this.showTab('dashboard');
            
            // Initialize dashboard if it exists
            if (window.dashboardManager) {
                console.log('Dashboard manager found, initializing...');
                try {
                    await window.dashboardManager.init();
                    window.dashboardManager.initialized = true;
                    console.log('Dashboard initialized successfully');
                } catch (err) {
                    console.error('Error initializing dashboard:', err);
                }
            } else {
                console.warn('Dashboard manager not found, will retry...');
                // Retry after a short delay
                setTimeout(async () => {
                    if (window.dashboardManager) {
                        console.log('Dashboard manager found on retry, initializing...');
                        try {
                            await window.dashboardManager.init();
                            window.dashboardManager.initialized = true;
                            console.log('Dashboard initialized successfully on retry');
                        } catch (err) {
                            console.error('Error initializing dashboard on retry:', err);
                        }
                    } else {
                        console.error('Dashboard manager still not found after retry');
                    }
                }, 1000);
            }

            this.isInitialized = true;
            console.log('Application UI initialized successfully');
            
            // Verify buttons have listeners
            console.log('=== VERIFYING BUTTONS ===');
            const buttons = [
                'loadDemoBtn', 'clearDataBtn', 'exportBtn', 'themeToggle',
                'addProjectBtn', 'exportProjectsBtn',
                'addWeeklyTaskBtn', 'exportWeeklyTasksBtn',
                'addVulnerabilityBtn', 'importXlsxBtn', 'exportVulnerabilitiesBtn',
                'addRiskBtn', 'exportRisksBtn',
                'addCriticalTaskBtn', 'exportCriticalTasksBtn'
            ];
            buttons.forEach(id => {
                const btn = document.getElementById(id);
                console.log(`${id}: ${btn ? 'FOUND ✓' : 'NOT FOUND ✗'}`);
            });
            console.log('=== BUTTON VERIFICATION COMPLETE ===');
            
            // Show welcome message for first-time users
            this.checkFirstTimeUser();
            
            // Start auto-switching between modules every 5 seconds
            this.startAutoSwitch();
            
        } catch (error) {
            console.error('Application initialization failed:', error);
        }
    }

    startAutoSwitch() {
        console.log('Starting auto-switch between modules (5 seconds interval)');
        this.initUserActivityDetection();
        this.autoSwitchInterval = setInterval(() => {
            // Only switch if not paused
            if (!this.isAutoSwitchPaused) {
                this.currentTabIndex = (this.currentTabIndex + 1) % this.tabs.length;
                const nextTab = this.tabs[this.currentTabIndex];
                console.log('Auto-switching to:', nextTab);
                this.showTab(nextTab);
                this.initializeModule(nextTab);
            } else {
                console.log('Auto-switch paused - waiting for user activity to stop');
            }
        }, 5000);
    }

    stopAutoSwitch() {
        if (this.autoSwitchInterval) {
            clearInterval(this.autoSwitchInterval);
            this.autoSwitchInterval = null;
            console.log('Auto-switch stopped');
        }
        if (this.userActivityTimeout) {
            clearTimeout(this.userActivityTimeout);
            this.userActivityTimeout = null;
        }
    }

    initUserActivityDetection() {
        // Detect user activity in content area
        const contentArea = document.querySelector('.content-area') || document;
        
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'input', 'change'];
        
        activityEvents.forEach(event => {
            contentArea.addEventListener(event, () => this.handleUserActivity(), { passive: true });
        });

        // Also detect when modals are open
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const modalContainer = document.getElementById('modalContainer');
                    if (modalContainer && modalContainer.innerHTML.trim() !== '') {
                        this.pauseAutoSwitch('Modal is open');
                    } else {
                        this.resumeAutoSwitchAfterDelay();
                    }
                }
            });
        });

        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            observer.observe(modalContainer, { childList: true, subtree: true });
        }
    }

    handleUserActivity() {
        // Pause auto-switch when user is active
        if (!this.isAutoSwitchPaused) {
            this.pauseAutoSwitch('User activity detected');
        }
        
        // Reset the timeout
        if (this.userActivityTimeout) {
            clearTimeout(this.userActivityTimeout);
        }
        
        // Resume after period of inactivity
        this.userActivityTimeout = setTimeout(() => {
            this.resumeAutoSwitch();
        }, this.ACTIVITY_DELAY);
    }

    pauseAutoSwitch(reason) {
        this.isAutoSwitchPaused = true;
        console.log(`Auto-switch PAUSED: ${reason}`);
        
        // Visual indicator
        this.showPauseIndicator(true);
    }

    resumeAutoSwitch() {
        if (this.isAutoSwitchPaused) {
            this.isAutoSwitchPaused = false;
            console.log('Auto-switch RESUMED');
            
            // Remove visual indicator
            this.showPauseIndicator(false);
        }
    }

    resumeAutoSwitchAfterDelay() {
        // Small delay before resuming to avoid rapid switching
        setTimeout(() => {
            this.resumeAutoSwitch();
        }, 1000);
    }

    showPauseIndicator(show) {
        let indicator = document.getElementById('autoSwitchPauseIndicator');
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'autoSwitchPauseIndicator';
                indicator.innerHTML = '<i class="fas fa-pause-circle"></i> Auto-switch paused';
                indicator.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    padding: 10px 15px;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    z-index: 9999;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(indicator);
                
                // Fade in
                setTimeout(() => indicator.style.opacity = '1', 10);
            }
        } else {
            if (indicator) {
                indicator.style.opacity = '0';
                setTimeout(() => indicator.remove(), 300);
            }
        }
    }

    initNavigation() {
        const tabButtons = document.querySelectorAll('.nav-tab');
        console.log('Initializing navigation with', tabButtons.length, 'tabs');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                console.log('Tab clicked:', tabName);
                
                // Pause auto-switch when user manually clicks a tab
                this.pauseAutoSwitch('Manual tab selection');
                
                this.showTab(tabName);
                this.initializeModule(tabName);
                
                // Resume after delay
                this.resumeAutoSwitchAfterDelay();
            });
        });
    }

    showTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(tabName);
        if (activeContent) activeContent.classList.add('active');
        
        // Update dashboard stats when switching back
        if (tabName === 'dashboard' && window.dashboardManager) {
            window.dashboardManager.updateDashboard();
        }
    }

    initializeModule(tabName) {
        console.log('Initializing module:', tabName);
        const managers = {
            'projects': 'projectsManager',
            'weekly-tasks': 'weeklyTasksManager',
            'vulnerabilities': 'vulnerabilitiesManager',
            'risks': 'risksManager',
            'critical-tasks': 'criticalTasksManager'
        };

        const managerName = managers[tabName];
        if (managerName && window[managerName]) {
            if (!window[managerName].initialized) {
                window[managerName].init();
                window[managerName].initialized = true;
            } else if (typeof window[managerName].loadProjects === 'function') {
                window[managerName].loadProjects();
            } else if (typeof window[managerName].loadRisks === 'function') {
                window[managerName].loadRisks();
            } else if (typeof window[managerName].loadVulnerabilities === 'function') {
                window[managerName].loadVulnerabilities();
            } else if (typeof window[managerName].loadCriticalTasks === 'function') {
                window[managerName].loadCriticalTasks();
            } else if (typeof window[managerName].loadWeeklyTasks === 'function') {
                window[managerName].loadWeeklyTasks();
            }
        }
    }

    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    initExport() {
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            console.log('Attaching Export button handler');
            exportBtn.addEventListener('click', async () => {
                console.log('Export button clicked');
                await this.exportData();
            });
        } else {
            console.warn('Export button not found');
        }
    }

    async exportData() {
        try {
            const data = await this.db.exportAllData();
            const csvContent = this.convertToCSV(data);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `it-infra-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Report exported successfully as CSV');
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Export failed');
        }
    }

    convertToCSV(data) {
        let csv = '';
        
        // Export Projects
        if (data.projects && data.projects.length > 0) {
            csv += 'PROJECTS\n';
            csv += 'Title,Description,Target End Date,Completion %,Assigned Team,Status,Created Date\n';
            data.projects.forEach(project => {
                csv += `"${this.escapeCsv(project.title)}","${this.escapeCsv(project.description)}",${project.target_end_date || ''},${project.completion_percentage || 0}%,"${this.escapeCsv(project.assigned_team)}",${project.status || 'Active'},${project.created_at || ''}\n`;
            });
            csv += '\n\n';
        }
        
        // Export Weekly Tasks
        if (data.weekly_tasks && data.weekly_tasks.length > 0) {
            csv += 'WEEKLY TASKS\n';
            csv += 'Title,Assigned Team,Progress,Week Of,Created Date\n';
            data.weekly_tasks.forEach(task => {
                csv += `"${this.escapeCsv(task.title)}","${this.escapeCsv(task.assigned_team)}",${task.progress || 0}%,${task.week_of || ''},${task.created_at || ''}\n`;
            });
            csv += '\n\n';
        }
        
        // Export Vulnerabilities
        if (data.vulnerabilities && data.vulnerabilities.length > 0) {
            csv += 'VULNERABILITIES\n';
            csv += 'Title,Severity,Description,Status,Discovered Date,Resolved Date\n';
            data.vulnerabilities.forEach(vuln => {
                csv += `"${this.escapeCsv(vuln.title)}",${vuln.severity || 'Unknown'},"${this.escapeCsv(vuln.description)}",${vuln.status || 'Open'},${vuln.discovered_date || ''},${vuln.resolved_date || ''}\n`;
            });
            csv += '\n\n';
        }
        
        // Export Risk Register
        if (data.risk_register && data.risk_register.length > 0) {
            csv += 'RISK REGISTER\n';
            csv += 'Risk Description,Status,Required Action,Created Date\n';
            data.risk_register.forEach(risk => {
                csv += `"${this.escapeCsv(risk.risk_description)}",${risk.status || 'Active'},"${this.escapeCsv(risk.required_action)}",${risk.created_at || ''}\n`;
            });
            csv += '\n\n';
        }
        
        // Export Critical Tasks
        if (data.critical_tasks && data.critical_tasks.length > 0) {
            csv += 'CRITICAL TASKS\n';
            csv += 'Title,Priority,Description,Assigned Team,Status,Created Date\n';
            data.critical_tasks.forEach(task => {
                csv += `"${this.escapeCsv(task.title)}",${task.priority || 'Medium'},"${this.escapeCsv(task.description)}","${this.escapeCsv(task.assigned_team)}",${task.status || 'Open'},${task.created_at || ''}\n`;
            });
        }
        
        return csv;
    }

    escapeCsv(text) {
        if (!text) return '';
        return String(text).replace(/"/g, '""');
    }

    closeModal(modalId) {
        console.log('Closing modal:', modalId);
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.innerHTML = '';
            modalContainer.classList.remove('active');
        }
    }

    initModalBackdrop() {
        // Close modal when clicking on backdrop
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer) {
                    this.closeModal();
                }
            });
        }
    }

    showSuccess(message) { this.showToast(message, 'success'); }
    showError(message) { this.showToast(message, 'error'); }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i><span>${message}</span></div>`;
        let container = document.querySelector('.toast-container') || document.createElement('div');
        if (!container.className) { container.className = 'toast-container'; document.body.appendChild(container); }
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    checkFirstTimeUser() {
        if (!localStorage.getItem('itInfraVisited')) {
            this.showWelcomeMessage();
            localStorage.setItem('itInfraVisited', 'true');
        }
    }

    showWelcomeMessage() {
        console.log('Showing welcome message');
        const modalHtml = `
            <div class="modal">
                <div class="modal-header"><h3 class="modal-title">Welcome!</h3></div>
                <div class="modal-body">
                    <p>Track your IT infrastructure activities easily.</p>
                    <ul>
                        <li>Projects & Weekly Tasks</li>
                        <li>Vulnerabilities & Risks</li>
                        <li>Critical Priority Tasks</li>
                    </ul>
                </div>
                <div class="modal-footer"><button class="btn btn-primary" id="welcomeCloseBtn">Get Started</button></div>
            </div>`;
        const container = document.getElementById('modalContainer');
        if (container) {
            container.innerHTML = modalHtml;
            container.classList.add('active');
            
            // Attach event listener to close button after modal is rendered
            const closeBtn = document.getElementById('welcomeCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Welcome close button clicked');
                    this.closeModal();
                });
            }
            
            // Initialize backdrop click
            this.initModalBackdrop();
        }
    }

    initDragAndDrop() {}

    initDemoData() {
        const demoBtn = document.getElementById('loadDemoBtn');
        if (demoBtn) {
            console.log('Attaching Load Demo button handler');
            demoBtn.addEventListener('click', async () => {
                console.log('Load Demo button clicked');
                if (confirm('This will load sample data for testing. Continue?')) {
                    if (window.DemoDataLoader && window.dbManager) {
                        console.log('Creating DemoDataLoader...');
                        const loader = new window.DemoDataLoader(window.dbManager);
                        console.log('Loading demo data...');
                        const result = await loader.loadDemoData();
                        console.log('Demo data load result:', result);
                    } else {
                        console.error('DemoDataLoader or dbManager not available');
                        console.log('DemoDataLoader:', window.DemoDataLoader);
                        console.log('dbManager:', window.dbManager);
                    }
                }
            });
        } else {
            console.warn('Load Demo button not found');
        }
    }

    initClearData() {
        const clearBtn = document.getElementById('clearDataBtn');
        if (clearBtn) {
            console.log('Attaching Clear Data button handler');
            clearBtn.addEventListener('click', async () => {
                console.log('Clear Data button clicked');
                if (confirm('WARNING: This will delete ALL data including projects, tasks, vulnerabilities, risks, and critical tasks.\n\nAre you sure you want to continue?')) {
                    if (window.dbManager) {
                        console.log('Clearing all data...');
                        try {
                            // Clear all data from database
                            await this.clearAllData();
                            this.showSuccess('All data cleared successfully');
                            
                            // Refresh all modules
                            this.refreshAllModules();
                        } catch (error) {
                            console.error('Error clearing data:', error);
                            this.showError('Failed to clear data');
                        }
                    }
                }
            });
        }
    }

    async clearAllData() {
        try {
            let result;
            
            if (window.isOfflineMode) {
                // Use offline API
                result = await window.offlineApi.clearAllData();
            } else {
                // Use the new bulk delete API endpoint
                result = await api.clearAllData();
            }
            
            if (result.success) {
                console.log('Clear all data result:', result);
                
                // Clear all caches
                if (this.db) {
                    this.db.clearCache('projects');
                    this.db.clearCache('weekly_tasks');
                    this.db.clearCache('vulnerabilities');
                    this.db.clearCache('risk_register');
                    this.db.clearCache('critical_tasks');
                }
                
                return result;
            } else {
                throw new Error('Failed to clear all data');
            }
        } catch (error) {
            console.error('Error in clearAllData:', error);
            throw error;
        }
        
        // Clear cache
        if (this.db && this.db.cache) {
            this.db.cache.clear();
        }
    }

    refreshAllModules() {
        // Refresh dashboard
        if (window.dashboardManager) {
            window.dashboardManager.updateDashboard();
        }
        
        // Refresh all initialized modules
        const managers = ['projectsManager', 'weeklyTasksManager', 'vulnerabilitiesManager', 'risksManager', 'criticalTasksManager'];
        managers.forEach(manager => {
            if (window[manager] && window[manager].initialized) {
                if (typeof window[manager].loadProjects === 'function') {
                    window[manager].loadProjects();
                } else if (typeof window[manager].loadRisks === 'function') {
                    window[manager].loadRisks();
                } else if (typeof window[manager].loadVulnerabilities === 'function') {
                    window[manager].loadVulnerabilities();
                } else if (typeof window[manager].loadCriticalTasks === 'function') {
                    window[manager].loadCriticalTasks();
                } else if (typeof window[manager].loadWeeklyTasks === 'function') {
                    window[manager].loadWeeklyTasks();
                }
            }
        });
    }
}

// Global initialization
window.addEventListener('load', () => {
    window.app = new App();
    window.app.init();
});

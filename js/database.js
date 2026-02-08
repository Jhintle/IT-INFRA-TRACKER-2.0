// Database Management Class - Now using Backend API with PostgreSQL
class DatabaseManager {
    constructor() {
        this.isInitialized = false;
        this.cache = new Map();
        this.cacheExpiry = 5000;
        this.useOfflineMode = false;
        this.apiClient = null;
    }

    async initialize() {
        // Detect offline mode during initialization
        // Force offline mode on localhost
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.protocol === 'file:';
        
        console.log('Database initialize() called');
        console.log('window.location.hostname:', window.location.hostname);
        console.log('window.location.protocol:', window.location.protocol);
        console.log('isLocalhost:', isLocalhost);
        console.log('window.isOfflineMode:', window.isOfflineMode);
        
        this.useOfflineMode = window.isOfflineMode || isLocalhost || false;
        this.apiClient = this.useOfflineMode ? window.offlineApi : window.api;
        
        console.log(`Initializing database (${this.useOfflineMode ? 'OFFLINE' : 'Backend API'} mode)...`);
        console.log('this.useOfflineMode:', this.useOfflineMode);
        console.log('this.apiClient:', this.apiClient);
        console.log('window.offlineApi:', window.offlineApi);
        console.log('window.api:', window.api);
        
        if (isLocalhost) {
            console.log('Localhost detected - database forced to offline mode');
        }
        
        // Initialize offline API if needed
        if (this.useOfflineMode && window.offlineApi) {
            console.log('Offline API ready');
        }
        
        this.isInitialized = true;
        console.log('Database initialized - API calls will be made on-demand');
        
        return true;
    }

    // Unified Methods - Now using API
    async select(table, where = '', params = [], orderBy = '') {
        // Only use cache in offline mode - backend mode should always fetch fresh data
        if (this.useOfflineMode) {
            const cached = this.getCached(table, where, params);
            if (cached) return cached;
        }

        let result = [];

        if (this.useOfflineMode) {
            // Fallback to offline API
            try {
                switch (table) {
                    case 'projects':
                        result = await this.apiClient.getProjects();
                        break;
                    case 'weekly_tasks':
                        result = await this.apiClient.getWeeklyTasks();
                        break;
                    case 'vulnerabilities':
                        result = await this.apiClient.getVulnerabilities();
                        break;
                    case 'risk_register':
                        result = await this.apiClient.getRisks();
                        break;
                    case 'critical_tasks':
                        result = await this.apiClient.getCriticalTasks();
                        break;
                    default:
                        console.warn('Unknown table:', table);
                        result = [];
                }
            } catch (error) {
                console.error('Offline API select error:', error);
                result = [];
            }
        } else {
            // Use API
            try {
                switch (table) {
                    case 'projects':
                        result = await api.getProjects();
                        break;
                    case 'weekly_tasks':
                        result = await api.getWeeklyTasks();
                        break;
                    case 'vulnerabilities':
                        result = await api.getVulnerabilities();
                        break;
                    case 'risk_register':
                        result = await api.getRisks();
                        break;
                    case 'critical_tasks':
                        result = await api.getCriticalTasks();
                        break;
                    default:
                        console.warn('Unknown table:', table);
                        result = [];
                }
            } catch (error) {
                console.error('API select error:', error);
                result = [];
            }
        }

        // Apply simple filtering for basic WHERE clauses
        if (where && params.length > 0) {
            // Parse WHERE clause to extract conditions
            const conditions = where.split(' AND ').map(c => c.trim());
            
            result = result.filter(item => {
                // Check all conditions - all must pass
                for (let i = 0; i < conditions.length; i++) {
                    const condition = conditions[i];
                    const paramValue = params[i];
                    
                    if (condition === 'is_archived = 0') {
                        if (item.is_archived) return false;
                    } else if (condition === 'is_archived = 1') {
                        if (!item.is_archived) return false;
                    } else if (condition.includes(' = ?')) {
                        // Extract field name (e.g., "status = ?" -> "status")
                        const field = condition.split(' = ?')[0].trim();
                        // Handle both direct field access and nested access
                        const itemValue = item[field];
                        // Loose equality to handle string/number comparisons
                        if (itemValue != paramValue) return false;
                    }
                }
                return true;
            });
        }

        // Apply sorting
        if (orderBy && orderBy.includes('DESC')) {
            result.reverse();
        }

        // Only cache in offline mode - backend mode should not cache
        if (this.useOfflineMode) {
            this.setCache(table, where, params, result);
        }
        return result;
    }

    async insert(table, data) {
        this.clearCache(table);
        
        if (this.useOfflineMode) {
            // Use offline API
            try {
                let result;
                switch (table) {
                    case 'projects':
                        result = await this.apiClient.createProject(data);
                        break;
                    case 'weekly_tasks':
                        result = await this.apiClient.createWeeklyTask(data);
                        break;
                    case 'vulnerabilities':
                        result = await this.apiClient.createVulnerability(data);
                        break;
                    case 'risk_register':
                        result = await this.apiClient.createRisk(data);
                        break;
                    case 'critical_tasks':
                        result = await this.apiClient.createCriticalTask(data);
                        break;
                    default:
                        console.warn('Insert not implemented for table:', table);
                        result = null;
                }
                return result;
            } catch (error) {
                console.error('Offline API insert error:', error);
                throw error;
            }
        }

        // Use API
        try {
            let result;
            switch (table) {
                case 'projects':
                    result = await api.createProject(data);
                    break;
                case 'weekly_tasks':
                    result = await api.createWeeklyTask(data);
                    break;
                case 'vulnerabilities':
                    result = await api.createVulnerability(data);
                    break;
                case 'risk_register':
                    result = await api.createRisk(data);
                    break;
                case 'critical_tasks':
                    result = await api.createCriticalTask(data);
                    break;
                default:
                    console.warn('Insert not implemented for table:', table);
                    result = null;
            }
            return result;
        } catch (error) {
            console.error('API insert error:', error);
            throw error;
        }
    }

    async update(table, id, data) {
        this.clearCache(table);
        
        if (this.useOfflineMode) {
            // Use offline API
            try {
                let result;
                switch (table) {
                    case 'projects':
                        result = await this.apiClient.updateProject(id, data);
                        break;
                    case 'weekly_tasks':
                        result = await this.apiClient.updateWeeklyTask(id, data);
                        break;
                    case 'vulnerabilities':
                        result = await this.apiClient.updateVulnerability(id, data);
                        break;
                    case 'risk_register':
                        result = await this.apiClient.updateRisk(id, data);
                        break;
                    case 'critical_tasks':
                        result = await this.apiClient.updateCriticalTask(id, data);
                        break;
                    default:
                        console.warn('Update not implemented for table:', table);
                        result = null;
                }
                return result;
            } catch (error) {
                console.error('Offline API update error:', error);
                throw error;
            }
        }

        // Use API
        try {
            let result;
            switch (table) {
                case 'projects':
                    result = await api.updateProject(id, data);
                    break;
                case 'weekly_tasks':
                    result = await api.updateWeeklyTask(id, data);
                    break;
                case 'vulnerabilities':
                    result = await api.updateVulnerability(id, data);
                    break;
                case 'risk_register':
                    result = await api.updateRisk(id, data);
                    break;
                case 'critical_tasks':
                    result = await api.updateCriticalTask(id, data);
                    break;
                default:
                    console.warn('Update not implemented for table:', table);
                    result = null;
            }
            return result;
        } catch (error) {
            console.error('API update error:', error);
            // Check if it's a 404 error and include it in the error message
            if (error.message && error.message.includes('404')) {
                const enhancedError = new Error(`404 - Resource not found during update: ${error.message}`);
                enhancedError.originalError = error;
                throw enhancedError;
            }
            throw error;
        }
    }

    async delete(table, id) {
        this.clearCache(table);
        
        if (this.useOfflineMode) {
            // Use offline API
            try {
                let result;
                switch (table) {
                    case 'vulnerabilities':
                        result = await this.apiClient.deleteVulnerability(id);
                        break;
                    case 'risk_register':
                        result = await this.apiClient.deleteRisk(id);
                        break;
                    case 'critical_tasks':
                        result = await this.apiClient.deleteCriticalTask(id);
                        break;
                    default:
                        console.warn('Delete not implemented for table:', table);
                        result = null;
                }
                return result;
            } catch (error) {
                console.error('Offline API delete error:', error);
                throw error;
            }
        }

        // Use API
        try {
            let result;
            switch (table) {
                case 'vulnerabilities':
                    result = await api.deleteVulnerability(id);
                    break;
                default:
                    console.warn('Delete not implemented for table:', table);
                    result = null;
            }
            return result;
        } catch (error) {
            console.error('API delete error:', error);
            throw error;
        }
    }

    // Cache management methods
    getCacheKey(table, where, params) {
        return `${table}:${where}:${JSON.stringify(params)}`;
    }

    getCached(table, where, params) {
        const key = this.getCacheKey(table, where, params);
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            return cached.data;
        }
        return null;
    }

    setCache(table, where, params, data) {
        const key = this.getCacheKey(table, where, params);
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache(table) {
        // Clear all cache entries for this table
        console.log('Clearing cache for table:', table);
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            // Cache keys are formatted as "table:where:params"
            if (key.startsWith(table + ':')) {
                keysToDelete.push(key);
                console.log('Deleting cache key:', key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        console.log('Cleared', keysToDelete.length, 'cache entries for', table);
    }

    async getDashboardStats() {
        console.log('getDashboardStats() called');
        console.log('this.useOfflineMode:', this.useOfflineMode);
        
        try {
            // Calculate stats from actual data - works for both offline and backend modes
            console.log('Calculating dashboard stats from data...');
            
            // Get all data
            const projects = await this.select('projects');
            const vulnerabilities = await this.select('vulnerabilities');
            const risks = await this.select('risk_register');
            const criticalTasks = await this.select('critical_tasks');
            const weeklyTasks = await this.select('weekly_tasks');
            
            console.log('Raw data counts:', {
                projects: projects.length,
                vulnerabilities: vulnerabilities.length,
                risks: risks.length,
                criticalTasks: criticalTasks.length,
                weeklyTasks: weeklyTasks.length
            });
            
            // Calculate projects
            const activeProjects = projects.filter(p => p.status === 'Active').length;
            
            // Calculate vulnerabilities by severity
            const bySeverity = [
                { severity: 'Low', count: vulnerabilities.filter(v => v.severity === 'Low').length },
                { severity: 'Medium', count: vulnerabilities.filter(v => v.severity === 'Medium').length },
                { severity: 'High', count: vulnerabilities.filter(v => v.severity === 'High').length },
                { severity: 'Critical', count: vulnerabilities.filter(v => v.severity === 'Critical').length }
            ];
            
            // Calculate vulnerability statuses
            const open = vulnerabilities.filter(v => v.status === 'Open').length;
            const inProgress = vulnerabilities.filter(v => v.status === 'In Progress').length;
            const due = vulnerabilities.filter(v => v.status === 'Due').length;
            const breached = vulnerabilities.filter(v => v.status === 'Breached').length;
            const resolved = vulnerabilities.filter(v => v.status === 'Resolved').length;
            
            // Calculate weekly tasks for this week
            const today = new Date();
            const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
            weekStart.setHours(0, 0, 0, 0);
            const thisWeek = weeklyTasks.filter(t => {
                const taskDate = new Date(t.created_at || t.createdAt);
                return taskDate >= weekStart;
            }).length;
            
            const stats = {
                projects: {
                    total: projects.length,
                    active: activeProjects
                },
                weekly_tasks: {
                    total: weeklyTasks.length,
                    thisWeek: thisWeek
                },
                vulnerabilities: {
                    total: vulnerabilities.length,
                    open: open,
                    inProgress: inProgress,
                    due: due,
                    breached: breached,
                    resolved: resolved,
                    bySeverity: bySeverity
                },
                risks: {
                    total: risks.filter(r => !r.is_archived).length
                },
                critical_tasks: {
                    total: criticalTasks.filter(t => !t.is_archived).length
                }
            };
            
            console.log('Calculated stats:', stats);
            return stats;
            
        } catch (error) {
            console.error('Failed to calculate dashboard stats:', error);
            return {
                projects: { total: 0, active: 0 },
                weekly_tasks: { total: 0, thisWeek: 0 },
                vulnerabilities: { total: 0, open: 0, inProgress: 0, due: 0, breached: 0, resolved: 0, bySeverity: [] },
                risks: { total: 0 },
                critical_tasks: { total: 0 }
            };
        }
    }

    async searchAll(term) {
        try {
            const results = {
                projects: [],
                weekly_tasks: [],
                vulnerabilities: [],
                risk_register: [],
                critical_tasks: []
            };
            
            // Search each table
            results.projects = await this.searchInTable('projects', term);
            results.weekly_tasks = await this.searchInTable('weekly_tasks', term);
            results.vulnerabilities = await this.searchInTable('vulnerabilities', term);
            results.risk_register = await this.searchInTable('risk_register', term);
            results.critical_tasks = await this.searchInTable('critical_tasks', term);
            
            return results;
        } catch (error) {
            console.error('Search error:', error);
            return {
                projects: [],
                weekly_tasks: [],
                vulnerabilities: [],
                risk_register: [],
                critical_tasks: []
            };
        }
    }

    async searchInTable(table, term) {
        try {
            const items = await this.select(table);
            return items.filter(item => 
                JSON.stringify(item).toLowerCase().includes(term.toLowerCase())
            );
        } catch (error) {
            console.error('Search in table error:', error);
            return [];
        }
    }

    async exportAllData() {
        return this.useOfflineMode ? this.exportOfflineData() : this.exportApiData();
    }

    exportOfflineData() {
        const savedData = localStorage.getItem('itInfraOfflineData');
        return savedData ? JSON.parse(savedData) : {
            projects: [],
            weekly_tasks: [],
            vulnerabilities: [],
            risk_register: [],
            critical_tasks: []
        };
    }

    async exportApiData() {
        try {
            return {
                projects: await this.select('projects'),
                weekly_tasks: await this.select('weekly_tasks'),
                vulnerabilities: await this.select('vulnerabilities'),
                risk_register: await this.select('risk_register'),
                critical_tasks: await this.select('critical_tasks')
            };
        } catch (error) {
            console.error('Export error:', error);
            return {
                projects: [],
                weekly_tasks: [],
                vulnerabilities: [],
                risk_register: [],
                critical_tasks: []
            };
        }
    }
    
    query(sql, params = []) {
        console.warn('Direct SQL queries not supported in API mode');
        return [];
    }

    formatQueryResult(result) {
        console.warn('formatQueryResult not supported in API mode');
        return [];
    }

    async getCount(table, where = '', params = []) {
        try {
            const items = await this.select(table, where, params);
            return items.length;
        } catch (error) {
            console.error('Get count error:', error);
            return 0;
        }
    }

    getWeekNumber() { return 1; }
    resetWeeklyTasksForNewWeek() {}
    save() {
        if (this.useOfflineMode && window.offlineApi) {
            // Use the offline API's save method to ensure correct key is used
            const data = window.offlineApi.getData();
            window.offlineApi.saveData(data);
            console.log('Data saved to localStorage via offlineApi');
        } else {
            console.log('Data saved to backend (no local save needed)');
        }
    }
}

// Global database instance
window.dbManager = new DatabaseManager();

// Create a promise that resolves when database is initialized
window.dbManager.ready = window.dbManager.initialize();

// Wait for initialization before marking as globally ready
window.dbManager.ready.then(() => {
    console.log('Database manager fully initialized and ready');
    window.dbManagerReady = true;
}).catch(err => {
    console.error('Database initialization failed:', err);
});

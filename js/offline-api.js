// Offline API Client - Uses localStorage instead of backend API
class OfflineApiClient {
    constructor() {
        this.storageKey = 'itInfraOfflineData_v2';
        this.initialized = false;
        this.initializeStorage();
    }

    initializeStorage() {
        const existing = localStorage.getItem(this.storageKey);
        if (!existing) {
            const initialData = {
                users: [{
                    id: 'offline-admin',
                    username: 'admin',
                    email: 'admin@local',
                    fullName: 'Local Admin',
                    password: 'admin',
                    role: 'admin',
                    created_at: new Date().toISOString()
                },
                {
                    id: 'user-jhin',
                    username: 'jhin',
                    email: 'jhin@local',
                    fullName: 'Jhin',
                    password: 'jhin123',
                    role: 'user',
                    created_at: new Date().toISOString()
                },
                {
                    id: 'user-jinx',
                    username: 'jinx',
                    email: 'jinx@local',
                    fullName: 'Jinx',
                    password: 'jinx123',
                    role: 'user',
                    created_at: new Date().toISOString()
                }],
                projects: [],
                weekly_tasks: [],
                vulnerabilities: [],
                risk_register: [],
                critical_tasks: []
            };
            localStorage.setItem(this.storageKey, JSON.stringify(initialData));
        }
        this.initialized = true;
    }

    getData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {
            users: [],
            projects: [],
            weekly_tasks: [],
            vulnerabilities: [],
            risk_register: [],
            critical_tasks: []
        };
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    generateId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Auth endpoints
    async login(username, password) {
        const data = this.getData();
        let user = data.users.find(u => u.username === username);
        
        if (!user) {
            // Create user on first login with default password
            user = {
                id: this.generateId(),
                username: username,
                email: `${username}@local`,
                fullName: username,
                password: password,
                role: 'admin',
                created_at: new Date().toISOString()
            };
            data.users.push(user);
            this.saveData(data);
        } else {
            // Check password for existing users
            if (user.password && user.password !== password) {
                return {
                    success: false,
                    error: 'Invalid username or password'
                };
            }
        }

        // Create a fake token
        const token = 'offline_token_' + Date.now();
        
        return {
            success: true,
            user: user,
            token: token
        };
    }

    async register(userData) {
        const data = this.getData();
        const newUser = {
            id: this.generateId(),
            username: userData.username,
            email: userData.email,
            fullName: userData.fullName || userData.username,
            role: 'user',
            created_at: new Date().toISOString()
        };
        data.users.push(newUser);
        this.saveData(data);
        
        return {
            success: true,
            message: 'User created successfully',
            user: newUser
        };
    }

    async getCurrentUser() {
        const data = this.getData();
        const user = data.users[0]; // Return first user as current
        return { user: user };
    }

    // Dashboard
    async getDashboardStats() {
        const data = this.getData();
        
        const vulnStats = data.vulnerabilities.reduce((acc, v) => {
            acc.total++;
            acc[v.status] = (acc[v.status] || 0) + 1;
            return acc;
        }, { total: 0, open: 0, due: 0, breached: 0, resolved: 0 });

        return {
            projects: {
                total: data.projects.length,
                active: data.projects.filter(p => p.status === 'Active').length
            },
            weekly_tasks: {
                total: data.weekly_tasks.length,
                thisWeek: data.weekly_tasks.length
            },
            vulnerabilities: {
                total: vulnStats.total,
                open: vulnStats.Open || 0,
                inProgress: vulnStats['In Progress'] || 0,
                due: vulnStats.Due || 0,
                breached: vulnStats.Breached || 0,
                resolved: vulnStats.Resolved || 0,
                bySeverity: []
            },
            risks: {
                total: data.risk_register.filter(r => !r.is_archived).length
            },
            critical_tasks: {
                total: data.critical_tasks.filter(t => !t.is_archived).length
            }
        };
    }

    // Projects
    async getProjects() {
        return this.getData().projects;
    }

    async createProject(project) {
        const data = this.getData();
        const newProject = {
            ...project,
            id: this.generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.projects.push(newProject);
        this.saveData(data);
        return newProject;
    }

    async updateProject(id, project) {
        const data = this.getData();
        const index = data.projects.findIndex(p => p.id == id);
        if (index !== -1) {
            data.projects[index] = {
                ...data.projects[index],
                ...project,
                updated_at: new Date().toISOString()
            };
            this.saveData(data);
            return data.projects[index];
        }
        throw new Error('Project not found');
    }

    async deleteProject(id) {
        const data = this.getData();
        data.projects = data.projects.filter(p => p.id != id);
        this.saveData(data);
        return { success: true };
    }

    // Weekly Tasks
    async getWeeklyTasks() {
        return this.getData().weekly_tasks;
    }

    async createWeeklyTask(task) {
        const data = this.getData();
        const newTask = {
            ...task,
            id: this.generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.weekly_tasks.push(newTask);
        this.saveData(data);
        return newTask;
    }

    async updateWeeklyTask(id, task) {
        const data = this.getData();
        const index = data.weekly_tasks.findIndex(t => t.id == id);
        if (index !== -1) {
            data.weekly_tasks[index] = {
                ...data.weekly_tasks[index],
                ...task,
                updated_at: new Date().toISOString()
            };
            this.saveData(data);
            return data.weekly_tasks[index];
        }
        throw new Error('Task not found');
    }

    async deleteWeeklyTask(id) {
        const data = this.getData();
        data.weekly_tasks = data.weekly_tasks.filter(t => t.id != id);
        this.saveData(data);
        return { success: true };
    }

    // Vulnerabilities
    async getVulnerabilities() {
        return this.getData().vulnerabilities;
    }

    async createVulnerability(vuln) {
        const data = this.getData();
        const newVuln = {
            ...vuln,
            id: this.generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.vulnerabilities.push(newVuln);
        this.saveData(data);
        return newVuln;
    }

    async updateVulnerability(id, vuln) {
        const data = this.getData();
        const index = data.vulnerabilities.findIndex(v => v.id == id);
        if (index !== -1) {
            data.vulnerabilities[index] = {
                ...data.vulnerabilities[index],
                ...vuln,
                updated_at: new Date().toISOString()
            };
            this.saveData(data);
            return data.vulnerabilities[index];
        }
        throw new Error('Vulnerability not found');
    }

    async deleteVulnerability(id) {
        const data = this.getData();
        data.vulnerabilities = data.vulnerabilities.filter(v => v.id != id);
        this.saveData(data);
        return { success: true };
    }

    async importVulnerabilities(vulnerabilities) {
        const data = this.getData();
        let imported = 0;
        
        for (const vuln of vulnerabilities) {
            const existing = data.vulnerabilities.find(v => v.title === vuln.title);
            if (!existing) {
                data.vulnerabilities.push({
                    ...vuln,
                    id: this.generateId(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                imported++;
            }
        }
        
        this.saveData(data);
        return { success: true, imported, updated: 0, removed: 0 };
    }

    // Risks
    async getRisks(archived = false) {
        const data = this.getData();
        if (archived) {
            return data.risk_register;
        }
        return data.risk_register.filter(r => !r.is_archived);
    }

    async createRisk(risk) {
        const data = this.getData();
        const newRisk = {
            ...risk,
            id: this.generateId(),
            is_archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.risk_register.push(newRisk);
        this.saveData(data);
        return newRisk;
    }

    async updateRisk(id, risk) {
        const data = this.getData();
        const index = data.risk_register.findIndex(r => r.id == id);
        if (index !== -1) {
            data.risk_register[index] = {
                ...data.risk_register[index],
                ...risk,
                updated_at: new Date().toISOString()
            };
            this.saveData(data);
            return data.risk_register[index];
        }
        throw new Error('Risk not found');
    }

    async deleteRisk(id) {
        const data = this.getData();
        data.risk_register = data.risk_register.filter(r => r.id != id);
        this.saveData(data);
        return { success: true };
    }

    // Critical Tasks
    async getCriticalTasks(archived = false) {
        const data = this.getData();
        if (archived) {
            return data.critical_tasks;
        }
        return data.critical_tasks.filter(t => !t.is_archived);
    }

    async createCriticalTask(task) {
        const data = this.getData();
        const newTask = {
            ...task,
            id: this.generateId(),
            is_archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.critical_tasks.push(newTask);
        this.saveData(data);
        return newTask;
    }

    async updateCriticalTask(id, task) {
        const data = this.getData();
        const index = data.critical_tasks.findIndex(t => t.id == id);
        if (index !== -1) {
            data.critical_tasks[index] = {
                ...data.critical_tasks[index],
                ...task,
                updated_at: new Date().toISOString()
            };
            this.saveData(data);
            return data.critical_tasks[index];
        }
        throw new Error('Critical task not found');
    }

    async deleteCriticalTask(id) {
        const data = this.getData();
        data.critical_tasks = data.critical_tasks.filter(t => t.id != id);
        this.saveData(data);
        return { success: true };
    }

    // Bulk delete methods
    async clearAllData() {
        const data = this.getData();
        const counts = {
            projects: data.projects.length,
            weekly_tasks: data.weekly_tasks.length,
            vulnerabilities: data.vulnerabilities.length,
            risk_register: data.risk_register.length,
            critical_tasks: data.critical_tasks.length
        };
        
        data.projects = [];
        data.weekly_tasks = [];
        data.vulnerabilities = [];
        data.risk_register = [];
        data.critical_tasks = [];
        
        this.saveData(data);
        return { success: true, deletedCounts: counts };
    }

    async clearProjects() {
        const data = this.getData();
        const count = data.projects.length;
        data.projects = [];
        this.saveData(data);
        return { success: true, deleted: count };
    }

    async clearWeeklyTasks() {
        const data = this.getData();
        const count = data.weekly_tasks.length;
        data.weekly_tasks = [];
        this.saveData(data);
        return { success: true, deleted: count };
    }

    async clearVulnerabilities() {
        const data = this.getData();
        const count = data.vulnerabilities.length;
        data.vulnerabilities = [];
        this.saveData(data);
        return { success: true, deleted: count };
    }

    async clearRisks() {
        const data = this.getData();
        const count = data.risk_register.length;
        data.risk_register = [];
        this.saveData(data);
        return { success: true, deleted: count };
    }

    async clearCriticalTasks() {
        const data = this.getData();
        const count = data.critical_tasks.length;
        data.critical_tasks = [];
        this.saveData(data);
        return { success: true, deleted: count };
    }

    // Dashboard Stats
    async getDashboardStats() {
        console.log('Offline API getDashboardStats() called');
        const data = this.getData();
        console.log('Raw data from localStorage:', data);
        console.log('Projects count:', data.projects.length);
        console.log('Vulnerabilities count:', data.vulnerabilities.length);
        console.log('Risks count:', data.risk_register.length);
        console.log('Critical tasks count:', data.critical_tasks.length);
        console.log('Weekly tasks count:', data.weekly_tasks.length);
        
        // Calculate vulnerability stats by severity
        const vulnerabilities = data.vulnerabilities;
        const bySeverity = [
            { severity: 'Low', count: vulnerabilities.filter(v => v.severity === 'Low').length },
            { severity: 'Medium', count: vulnerabilities.filter(v => v.severity === 'Medium').length },
            { severity: 'High', count: vulnerabilities.filter(v => v.severity === 'High').length },
            { severity: 'Critical', count: vulnerabilities.filter(v => v.severity === 'Critical').length }
        ];
        
        console.log('Vulnerability severity breakdown:', bySeverity);
        
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
        const thisWeek = data.weekly_tasks.filter(t => {
            const taskDate = new Date(t.created_at);
            return taskDate >= weekStart;
        }).length;
        
        return {
            projects: {
                total: data.projects.length,
                active: data.projects.filter(p => p.status === 'Active').length
            },
            weekly_tasks: {
                total: data.weekly_tasks.length,
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
                total: data.risk_register.filter(r => !r.is_archived).length
            },
            critical_tasks: {
                total: data.critical_tasks.filter(t => !t.is_archived).length
            }
        };
    }
}

// Create global offline API instance
window.offlineApi = new OfflineApiClient();

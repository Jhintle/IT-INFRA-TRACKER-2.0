// API Configuration - Always use relative path for Docker/Nginx setup
const API_BASE_URL = '/api';

// Auth token management
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
        // Chrome compatible cookie (no Secure for http://localhost)
        document.cookie = `auth_token=Bearer ${token}; path=/; SameSite=Lax; Max-Age=86400`;
        
        console.log('API Client: Token stored, cookie set');
    }

    setUser(user) {
        this.user = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return !!this.token;
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Clear auth cookie
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login.html';
    }
}

const auth = new AuthManager();

// API Client
class ApiClient {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token
        if (auth.isLoggedIn()) {
            config.headers['Authorization'] = `Bearer ${auth.getToken()}`;
        }

        try {
            console.log('API Request:', url, config);
            const response = await fetch(url, config);
            console.log('API Response:', response.status);
            
            // Better error handling
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('401 Unauthorized - checking authentication');
                    // Don't immediately logout, might be a temporary auth issue
                    // Only logout if this is a protected route and we really need auth
                    throw new Error('Authentication required');
                }
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('API Success:', endpoint, data);
            return data;
        } catch (error) {
            console.error('Request failed:', endpoint, error);
            throw error;
        }
    }

    // Auth endpoints
    async login(username, password) {
        const result = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (result && result.token) {
            auth.setToken(result.token);
            auth.setUser(result.user);
        }
        
        return result;
    }

    async register(userData) {
        return await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getCurrentUser() {
        return await this.request('/auth/me');
    }

    // Dashboard
    async getDashboardStats() {
        return await this.request('/dashboard/stats');
    }

    // Projects
    async getProjects() {
        return await this.request('/projects');
    }

    async createProject(project) {
        return await this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(project)
        });
    }

    async updateProject(id, project) {
        // Convert snake_case to camelCase for API compatibility
        const apiProject = {};
        
        Object.keys(project).forEach(key => {
            if (key === 'target_end_date') {
                apiProject.targetEndDate = project[key];
            } else if (key === 'assigned_team') {
                apiProject.assignedTeam = project[key];
            } else if (key === 'completion_percentage') {
                apiProject.completionPercentage = project[key];
            } else {
                apiProject[key] = project[key];
            }
        });
        
        return await this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(apiProject)
        });
    }

    async deleteProject(id) {
        return await this.request(`/projects/${id}`, {
            method: 'DELETE'
        });
    }

    // Weekly Tasks
    async getWeeklyTasks() {
        return await this.request('/weekly-tasks');
    }

    async createWeeklyTask(task) {
        // Convert snake_case to camelCase for API compatibility
        const apiTask = {
            title: task.title,
            assignedTeam: task.assigned_team,
            checklist: task.checklist,
            weekNumber: task.week_number,
            year: task.year
        };
        
        return await this.request('/weekly-tasks', {
            method: 'POST',
            body: JSON.stringify(apiTask)
        });
    }

    async updateWeeklyTask(id, task) {
        // Convert snake_case to camelCase for API compatibility
        const apiTask = {};
        
        Object.keys(task).forEach(key => {
            if (key === 'assigned_team') {
                apiTask.assignedTeam = task[key];
            } else if (key === 'week_number') {
                apiTask.weekNumber = task[key];
            } else {
                apiTask[key] = task[key];
            }
        });
        
        return await this.request(`/weekly-tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(apiTask)
        });
    }

    async deleteWeeklyTask(id) {
        return await this.request(`/weekly-tasks/${id}`, {
            method: 'DELETE'
        });
    }

    // Vulnerabilities
    async getVulnerabilities() {
        return await this.request('/vulnerabilities');
    }

    async createVulnerability(vuln) {
        // Convert snake_case to camelCase for API compatibility
        const apiVuln = {
            title: vuln.title,
            severity: vuln.severity,
            description: vuln.description,
            status: vuln.status,
            dueDate: vuln.due_date,
            assignmentGroup: vuln.assignment_group,
            created_by: vuln.created_by,
            discovered_date: vuln.discovered_date,
            resolved_date: vuln.resolved_date
        };
        
        return await this.request('/vulnerabilities', {
            method: 'POST',
            body: JSON.stringify(apiVuln)
        });
    }

    async updateVulnerability(id, vuln) {
        // Convert snake_case to camelCase for API compatibility
        const apiVuln = {};
        
        Object.keys(vuln).forEach(key => {
            if (key === 'due_date') {
                apiVuln.dueDate = vuln[key];
            } else if (key === 'assignment_group') {
                apiVuln.assignmentGroup = vuln[key];
            } else if (key === 'discovered_date') {
                apiVuln.discoveredDate = vuln[key];
            } else if (key === 'resolved_date') {
                apiVuln.resolvedDate = vuln[key];
            } else {
                apiVuln[key] = vuln[key];
            }
        });
        
        return await this.request(`/vulnerabilities/${id}`, {
            method: 'PUT',
            body: JSON.stringify(apiVuln)
        });
    }

    async deleteVulnerability(id) {
        return await this.request(`/vulnerabilities/${id}`, {
            method: 'DELETE'
        });
    }

    // Risks
    async getRisks(archived = false) {
        const endpoint = archived ? '/risks?archived=true' : '/risks';
        return await this.request(endpoint);
    }

    async createRisk(risk) {
        // Convert snake_case to camelCase for API compatibility
        const apiRisk = {
            riskDescription: risk.risk_description,
            status: risk.status,
            requiredAction: risk.required_action
        };
        
        return await this.request('/risks', {
            method: 'POST',
            body: JSON.stringify(apiRisk)
        });
    }

    async updateRisk(id, risk) {
        // Convert snake_case to camelCase for API compatibility
        const apiRisk = {};
        
        Object.keys(risk).forEach(key => {
            if (key === 'risk_description') {
                apiRisk.riskDescription = risk[key];
            } else if (key === 'required_action') {
                apiRisk.requiredAction = risk[key];
            } else if (key === 'is_archived') {
                apiRisk.isArchived = risk[key];
            } else {
                apiRisk[key] = risk[key];
            }
        });
        
        return await this.request(`/risks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(apiRisk)
        });
    }

    async deleteRisk(id) {
        return await this.request(`/risks/${id}`, {
            method: 'DELETE'
        });
    }

    // Critical Tasks
    async getCriticalTasks() {
        return await this.request('/critical-tasks');
    }

    async createCriticalTask(task) {
        return await this.request('/critical-tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    }

    async updateCriticalTask(id, task) {
        // Convert snake_case to camelCase for API compatibility
        const apiTask = {};
        
        Object.keys(task).forEach(key => {
            if (key === 'assigned_team') {
                apiTask.assignedTeam = task[key];
            } else if (key === 'is_archived') {
                apiTask.isArchived = task[key];
            } else {
                apiTask[key] = task[key];
            }
        });
        
        return await this.request(`/critical-tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(apiTask)
        });
    }

    async deleteCriticalTask(id) {
        return await this.request(`/critical-tasks/${id}`, {
            method: 'DELETE'
        });
    }

    async importVulnerabilities(vulnerabilities) {
        return await this.request('/vulnerabilities/import', {
            method: 'POST',
            body: JSON.stringify({ vulnerabilities })
        });
    }

    // Bulk delete methods for clear data functionality
    async clearAllData() {
        return await this.request('/clear-all-data', {
            method: 'DELETE'
        });
    }

    async clearProjects() {
        return await this.request('/projects/clear', {
            method: 'DELETE'
        });
    }

    async clearWeeklyTasks() {
        return await this.request('/weekly-tasks/clear', {
            method: 'DELETE'
        });
    }

    async clearVulnerabilities() {
        return await this.request('/vulnerabilities/clear', {
            method: 'DELETE'
        });
    }

    async clearRisks() {
        return await this.request('/risks/clear', {
            method: 'DELETE'
        });
    }

    async clearCriticalTasks() {
        return await this.request('/critical-tasks/clear', {
            method: 'DELETE'
        });
    }

    // Dashboard Stats
    async getDashboardStats() {
        return await this.request('/dashboard/stats');
    }
}

const api = new ApiClient();

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded - checking authentication...');
    console.log('User agent:', navigator.userAgent);
    console.log('Cookie available:', document.cookie);
    console.log('Token in storage:', localStorage.getItem('token') ? 'YES' : 'NO');
    
    if (auth.isLoggedIn()) {
        try {
            console.log('Getting current user...');
            const user = await api.getCurrentUser();
            if (user && user.user) {
                console.log('User authenticated successfully:', user.user);
                updateUIForLoggedInUser(user.user);
            } else {
                console.warn('No user data returned, but continuing...');
                // Don't immediately logout - might be a temporary issue
            }
        } catch (error) {
            console.warn('Auth check failed (continuing anyway):', error);
            console.warn('Error details:', error.message);
            // Don't immediately logout - let the user continue and try again
        }
    } else {
        console.log('No authentication found - should redirect to login');
    }
});

function updateUIForLoggedInUser(user) {
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.innerHTML = `
            <span>Welcome, ${user.fullName || user.username}</span>
            <button onclick="auth.logout()" class="btn btn-secondary btn-sm">Logout</button>
        `;
    }
}

// Make auth and api globally available
window.auth = auth;
window.api = api;

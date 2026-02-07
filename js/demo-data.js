// Demo Data Loader - Populates database with test examples
class DemoDataLoader {
    constructor(database) {
        this.db = database;
    }

    async loadDemoData() {
        try {
            console.log('Loading demo data...');
            
            // Check if data already exists
            const existingProjects = await this.db.select('projects');
            const existingVulns = await this.db.select('vulnerabilities');
            const existingRisks = await this.db.select('risk_register');
            const existingTasks = await this.db.select('critical_tasks');
            const existingWeekly = await this.db.select('weekly_tasks');
            
            if (existingProjects.length > 0 || existingVulns.length > 0) {
                console.log('Database already has data, skipping demo load');
                return false;
            }

            // Load Projects
            await this.loadDemoProjects();
            
            // Load Vulnerabilities with different severities
            await this.loadDemoVulnerabilities();
            
            // Load Risks
            await this.loadDemoRisks();
            
            // Load Critical Tasks
            await this.loadDemoCriticalTasks();
            
            // Load Weekly Tasks
            await this.loadDemoWeeklyTasks();
            
            // Clear entire database cache to ensure fresh data
            if (this.db && this.db.cache) {
                console.log('Clearing entire database cache...');
                const cacheSize = this.db.cache.size;
                this.db.cache.clear();
                console.log('Cleared', cacheSize, 'cache entries');
            }
            
            // Force refresh data from backend/localStorage
            console.log('Refreshing data from storage...');
            await this.db.select('projects');
            await this.db.select('vulnerabilities');
            await this.db.select('risk_register');
            await this.db.select('critical_tasks');
            await this.db.select('weekly_tasks');
            
            console.log('Demo data loaded successfully');
            
            // Show success message
            if (window.app) {
                window.app.showSuccess('Demo data loaded successfully!');
            }
            
            // Wait a bit for localStorage to sync
            console.log('Waiting for localStorage sync...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh all modules
            await this.refreshAllModules();
            
            return true;
        } catch (error) {
            console.error('Error loading demo data:', error);
            return false;
        }
    }

    async loadDemoProjects() {
        const projects = [
            {
                title: 'Network Infrastructure Upgrade',
                description: 'Upgrading core network switches and routers to improve performance and security',
                target_end_date: '2024-03-15',
                completion_percentage: 75,
                assigned_team: 'Network Team',
                status: 'Active'
            },
            {
                title: 'Cloud Migration Phase 1',
                description: 'Migrating on-premise servers to AWS cloud infrastructure',
                target_end_date: '2024-04-30',
                completion_percentage: 45,
                assigned_team: 'Cloud Team',
                status: 'Active'
            },
            {
                title: 'Security Audit 2024',
                description: 'Comprehensive security audit of all systems and applications',
                target_end_date: '2024-02-28',
                completion_percentage: 100,
                assigned_team: 'Security Team',
                status: 'Completed'
            },
            {
                title: 'Data Center Relocation',
                description: 'Moving primary data center to new facility with better cooling and power',
                target_end_date: '2024-06-15',
                completion_percentage: 20,
                assigned_team: 'Infrastructure Team',
                status: 'On Hold'
            },
            {
                title: 'Backup System Overhaul',
                description: 'Implementing new 3-2-1 backup strategy with automated testing',
                target_end_date: '2024-03-30',
                completion_percentage: 60,
                assigned_team: 'Storage Team',
                status: 'Active'
            }
        ];

        for (const project of projects) {
            await this.db.insert('projects', project);
        }
    }

    async loadDemoVulnerabilities() {
        const vulnerabilities = [
            // Critical vulnerabilities
            {
                title: 'CVE-2024-1234: Remote Code Execution in Apache Struts',
                severity: 'Critical',
                description: 'A critical remote code execution vulnerability affecting Apache Struts 2.5.0 to 2.5.33. Allows attackers to execute arbitrary code on the server.',
                status: 'Open',
                discovered_date: '2024-01-15',
                resolved_date: null
            },
            {
                title: 'Critical SQL Injection in Payment Gateway',
                severity: 'Critical',
                description: 'SQL injection vulnerability in payment processing module that could expose customer financial data.',
                status: 'In Progress',
                discovered_date: '2024-01-10',
                resolved_date: null
            },
            {
                title: 'Zero-Day: Windows Kernel Privilege Escalation',
                severity: 'Critical',
                description: 'Unpatched Windows kernel vulnerability allowing privilege escalation from user to SYSTEM.',
                status: 'Open',
                discovered_date: '2024-01-20',
                resolved_date: null
            },
            // High vulnerabilities
            {
                title: 'CVE-2024-5678: Buffer Overflow in OpenSSL',
                severity: 'High',
                description: 'Buffer overflow vulnerability in OpenSSL 3.0.x that could lead to denial of service or code execution.',
                status: 'In Progress',
                discovered_date: '2024-01-08',
                resolved_date: null
            },
            {
                title: 'High Risk: Unpatched Java Deserialization',
                severity: 'High',
                description: 'Java deserialization vulnerability in legacy application allowing remote code execution.',
                status: 'Open',
                discovered_date: '2024-01-12',
                resolved_date: null
            },
            {
                title: 'Directory Traversal in File Upload',
                severity: 'High',
                description: 'Directory traversal vulnerability allowing attackers to write files to arbitrary locations.',
                status: 'Resolved',
                discovered_date: '2023-12-20',
                resolved_date: '2024-01-05'
            },
            {
                title: 'Weak Cryptographic Algorithm Usage',
                severity: 'High',
                description: 'Application using deprecated MD5 hashing algorithm for password storage.',
                status: 'In Progress',
                discovered_date: '2024-01-14',
                resolved_date: null
            },
            // Medium vulnerabilities
            {
                title: 'Information Disclosure in Error Messages',
                severity: 'Medium',
                description: 'Verbose error messages revealing sensitive system information and stack traces.',
                status: 'Open',
                discovered_date: '2024-01-05',
                resolved_date: null
            },
            {
                title: 'Missing HTTP Security Headers',
                severity: 'Medium',
                description: 'Web application missing important security headers like CSP, HSTS, and X-Frame-Options.',
                status: 'Resolved',
                discovered_date: '2023-12-15',
                resolved_date: '2024-01-08'
            },
            {
                title: 'Weak TLS Configuration',
                severity: 'Medium',
                description: 'Server accepting TLS 1.0 and 1.1 connections which are considered insecure.',
                status: 'In Progress',
                discovered_date: '2024-01-18',
                resolved_date: null
            },
            {
                title: 'Session Fixation Vulnerability',
                severity: 'Medium',
                description: 'Application does not regenerate session ID after authentication.',
                status: 'Open',
                discovered_date: '2024-01-09',
                resolved_date: null
            },
            {
                title: 'Clickjacking Vulnerability',
                severity: 'Medium',
                description: 'Web application vulnerable to clickjacking attacks due to missing frame protection.',
                status: 'Resolved',
                discovered_date: '2023-12-28',
                resolved_date: '2024-01-12'
            },
            // Low vulnerabilities
            {
                title: 'Outdated jQuery Library',
                severity: 'Low',
                description: 'Using jQuery 1.12.4 which has known XSS vulnerabilities.',
                status: 'Open',
                discovered_date: '2024-01-11',
                resolved_date: null
            },
            {
                title: 'Verbose Server Banners',
                severity: 'Low',
                description: 'Web server revealing version information in HTTP response headers.',
                status: 'Resolved',
                discovered_date: '2023-12-22',
                resolved_date: '2024-01-03'
            },
            {
                title: 'Missing Content Security Policy',
                severity: 'Low',
                description: 'No CSP header defined, increasing risk of XSS attacks.',
                status: 'In Progress',
                discovered_date: '2024-01-16',
                resolved_date: null
            },
            {
                title: 'Autocompletion Enabled on Password Fields',
                severity: 'Low',
                description: 'Password input fields allowing browser autocompletion.',
                status: 'Open',
                discovered_date: '2024-01-07',
                resolved_date: null
            },
            {
                title: 'Internal IP Disclosure',
                severity: 'Low',
                description: 'Internal IP addresses visible in application responses.',
                status: 'Open',
                discovered_date: '2024-01-13',
                resolved_date: null
            },
            {
                title: 'Cookie Without Secure Flag',
                severity: 'Low',
                description: 'Session cookies not using Secure flag, may be transmitted over HTTP.',
                status: 'Resolved',
                discovered_date: '2023-12-18',
                resolved_date: '2024-01-10'
            }
        ];

        for (const vuln of vulnerabilities) {
            await this.db.insert('vulnerabilities', vuln);
        }
    }

    async loadDemoRisks() {
        const risks = [
            {
                risk_description: 'Data Breach - Customer PII Exposure',
                status: 'Active',
                required_action: 'Implement DLP solution, encrypt all PII at rest and in transit, conduct security training',
                is_archived: 0
            },
            {
                risk_description: 'Ransomware Attack on File Servers',
                status: 'Active',
                required_action: 'Deploy advanced endpoint protection, implement offline backups, establish incident response plan',
                is_archived: 0
            },
            {
                risk_description: 'Insider Threat - Privileged Access Abuse',
                status: 'Monitoring',
                required_action: 'Implement PAM solution, enable comprehensive audit logging, establish regular access reviews',
                is_archived: 0
            },
            {
                risk_description: 'Third-Party Vendor Security Breach',
                status: 'Active',
                required_action: 'Conduct vendor security assessments, establish security requirements in contracts, implement monitoring',
                is_archived: 0
            },
            {
                risk_description: 'DDoS Attack on Public Website',
                status: 'Monitoring',
                required_action: 'Deploy DDoS protection service, establish rate limiting, create communication plan',
                is_archived: 0
            },
            {
                risk_description: 'Legacy System End-of-Life',
                status: 'Active',
                required_action: 'Develop migration plan, identify replacement solutions, secure additional budget',
                is_archived: 0
            },
            {
                risk_description: 'Compliance Violation - GDPR Non-Compliance',
                status: 'Resolved',
                required_action: 'Implemented data mapping, established consent management, created data retention policies',
                is_archived: 1
            }
        ];

        for (const risk of risks) {
            await this.db.insert('risk_register', risk);
        }
    }

    async loadDemoCriticalTasks() {
        const tasks = [
            {
                title: 'URGENT: Patch Critical Security Vulnerabilities',
                priority: 'Critical',
                description: 'Immediately patch CVE-2024-1234 and CVE-2024-5678 on all production systems',
                assigned_team: 'Security Operations',
                status: 'In Progress',
                is_archived: 0
            },
            {
                title: 'Restore Production Database from Backup',
                priority: 'Critical',
                description: 'Database corruption detected in primary production instance. Emergency restore required.',
                assigned_team: 'Database Team',
                status: 'Open',
                is_archived: 0
            },
            {
                title: 'Network Outage - Core Switch Failure',
                priority: 'Critical',
                description: 'Core switch in Data Center A has failed. Redundancy active but needs immediate replacement.',
                assigned_team: 'Network Team',
                status: 'Resolved',
                is_archived: 1
            },
            {
                title: 'High Priority: SSL Certificate Renewal',
                priority: 'High',
                description: 'SSL certificates for customer portal expiring in 7 days. Must renew immediately.',
                assigned_team: 'Infrastructure Team',
                status: 'In Progress',
                is_archived: 0
            },
            {
                title: 'Implement Emergency Firewall Rules',
                priority: 'High',
                description: 'Block suspicious IP ranges identified in recent attack attempts.',
                assigned_team: 'Security Team',
                status: 'Open',
                is_archived: 0
            },
            {
                title: 'Server Performance Degradation',
                priority: 'High',
                description: 'Application servers experiencing 90% CPU utilization. Investigation and scaling required.',
                assigned_team: 'Systems Team',
                status: 'Resolved',
                is_archived: 1
            },
            {
                title: 'Update Disaster Recovery Documentation',
                priority: 'Medium',
                description: 'DR procedures need updates to reflect new cloud infrastructure.',
                assigned_team: 'IT Operations',
                status: 'In Progress',
                is_archived: 0
            },
            {
                title: 'Conduct Security Awareness Training',
                priority: 'Medium',
                description: 'Quarterly security training for all staff. Focus on phishing awareness.',
                assigned_team: 'Training Team',
                status: 'Open',
                is_archived: 0
            },
            {
                title: 'Clean Up Old Log Files',
                priority: 'Low',
                description: 'Archive and delete log files older than 90 days to free up storage space.',
                assigned_team: 'Systems Team',
                status: 'Resolved',
                is_archived: 1
            }
        ];

        for (const task of tasks) {
            await this.db.insert('critical_tasks', task);
        }
    }

    async loadDemoWeeklyTasks() {
        const currentWeek = this.getWeekNumber();
        const currentYear = new Date().getFullYear();
        
        const weeklyTasks = [
            {
                title: 'Weekly Security Scan',
                assigned_team: 'Security Team',
                checklist: JSON.stringify([
                    { text: 'Run vulnerability scan on external perimeter', completed: true },
                    { text: 'Review security logs for anomalies', completed: true },
                    { text: 'Check patch status on critical systems', completed: false },
                    { text: 'Review failed login attempts', completed: false },
                    { text: 'Verify backup integrity', completed: true }
                ]),
                week_number: currentWeek,
                year: currentYear
            },
            {
                title: 'System Maintenance Checklist',
                assigned_team: 'Infrastructure Team',
                checklist: JSON.stringify([
                    { text: 'Check disk space on all servers', completed: true },
                    { text: 'Review system performance metrics', completed: true },
                    { text: 'Clean up temporary files', completed: false },
                    { text: 'Verify monitoring alerts are configured', completed: true },
                    { text: 'Test failover systems', completed: false }
                ]),
                week_number: currentWeek,
                year: currentYear
            },
            {
                title: 'Network Health Check',
                assigned_team: 'Network Team',
                checklist: JSON.stringify([
                    { text: 'Check switch and router logs', completed: true },
                    { text: 'Verify VLAN configurations', completed: true },
                    { text: 'Test VPN connectivity', completed: true },
                    { text: 'Review bandwidth utilization', completed: false },
                    { text: 'Check firewall rules for unnecessary entries', completed: false }
                ]),
                week_number: currentWeek,
                year: currentYear
            },
            {
                title: 'Compliance Review',
                assigned_team: 'Compliance Team',
                checklist: JSON.stringify([
                    { text: 'Review access control lists', completed: false },
                    { text: 'Check audit logs completeness', completed: false },
                    { text: 'Verify data retention policies', completed: false },
                    { text: 'Review user access reviews', completed: false }
                ]),
                week_number: currentWeek,
                year: currentYear
            }
        ];

        for (const task of weeklyTasks) {
            await this.db.insert('weekly_tasks', task);
        }
    }

    getWeekNumber() {
        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    async refreshAllModules() {
        console.log('Refreshing all modules...');
        
        // Longer delay to ensure database writes are complete and localStorage is synced
        console.log('Waiting for data to sync...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify data is in localStorage
        if (window.offlineApi) {
            const verifyData = window.offlineApi.getData();
            console.log('Verification - Projects:', verifyData.projects.length);
            console.log('Verification - Vulnerabilities:', verifyData.vulnerabilities.length);
        }
        
        // Refresh dashboard
        if (window.dashboardManager) {
            console.log('Refreshing dashboard...');
            await window.dashboardManager.updateDashboard();
            console.log('Dashboard refreshed');
        }
        
        // Refresh all initialized modules
        if (window.projectsManager && window.projectsManager.initialized) {
            console.log('Refreshing projects...');
            await window.projectsManager.loadProjects();
        }
        
        if (window.weeklyTasksManager && window.weeklyTasksManager.initialized) {
            console.log('Refreshing weekly tasks...');
            await window.weeklyTasksManager.loadWeeklyTasks();
        }
        
        if (window.vulnerabilitiesManager && window.vulnerabilitiesManager.initialized) {
            console.log('Refreshing vulnerabilities...');
            await window.vulnerabilitiesManager.loadVulnerabilities();
        }
        
        if (window.risksManager && window.risksManager.initialized) {
            console.log('Refreshing risks...');
            await window.risksManager.loadRisks();
        }
        
        if (window.criticalTasksManager && window.criticalTasksManager.initialized) {
            console.log('Refreshing critical tasks...');
            await window.criticalTasksManager.loadCriticalTasks();
        }
        
        console.log('All modules refreshed');
    }
}

// Make it globally available
window.DemoDataLoader = DemoDataLoader;

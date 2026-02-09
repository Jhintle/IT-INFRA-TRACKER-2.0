const mysql = require('mysql2/promise');

let pool = null;

// Only create pool if DB_HOST is configured and not localhost
if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') {
    try {
        const dbConfig = {
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'it_infrastructure_tracker',
            waitForConnections: true,
            connectionLimit: 20,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        };

        // Check if using Unix socket (Cloud SQL) or TCP host
        if (process.env.DB_HOST.startsWith('/cloudsql/')) {
            console.log('Using Cloud SQL Unix socket:', process.env.DB_HOST);
            dbConfig.socketPath = process.env.DB_HOST;
        } else {
            console.log('Using TCP host:', process.env.DB_HOST);
            dbConfig.host = process.env.DB_HOST;
            dbConfig.port = process.env.DB_PORT || 3306;
        }

        pool = mysql.createPool(dbConfig);

        pool.on('connection', (connection) => {
            console.log('New MySQL connection established');
        });

        pool.on('error', (err) => {
            console.error('Unexpected MySQL pool error:', err);
        });
    } catch (error) {
        console.warn('Failed to create MySQL pool:', error.message);
        pool = null;
    }
} else {
    console.log('No DB_HOST configured, MySQL disabled');
}

async function initializeDatabase() {
    if (!pool) {
        console.log('MySQL pool not available, skipping initialization');
        return null;
    }

    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Initializing MySQL database...');
        
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                full_name VARCHAR(100),
                role VARCHAR(20) DEFAULT 'user',
                saml_id VARCHAR(255),
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                INDEX idx_username (username),
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create projects table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS projects (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                target_end_date DATE,
                completion_percentage INT DEFAULT 0,
                assigned_team VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Active',
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create weekly_tasks table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS weekly_tasks (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                title VARCHAR(255) NOT NULL,
                assigned_team VARCHAR(255),
                checklist JSON,
                week_number INT,
                year INT,
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create vulnerabilities table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS vulnerabilities (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                title VARCHAR(255) NOT NULL,
                severity VARCHAR(20) DEFAULT 'Moderate',
                description TEXT,
                status VARCHAR(20) DEFAULT 'Open',
                discovered_date DATE DEFAULT (CURRENT_DATE),
                resolved_date DATE,
                assignment_group VARCHAR(255),
                due_date DATE,
                source VARCHAR(50) DEFAULT 'Manual',
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY unique_title (title),
                INDEX idx_severity (severity),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create risk_register table (legacy columns included for migration)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS risk_register (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                risk_name VARCHAR(255),
                risk_description TEXT,
                impact VARCHAR(20) DEFAULT 'Medium',
                owner VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Open',
                mitigation TEXT,
                required_action TEXT,
                is_archived TINYINT(1) DEFAULT 0,
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_archived (is_archived),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migration: Add new columns if they don't exist (for existing tables)
        const addColumnIfNotExists = async (columnName, columnDef) => {
            try {
                await connection.execute(`ALTER TABLE risk_register ADD COLUMN ${columnName} ${columnDef}`);
                console.log(`Added column ${columnName} to risk_register`);
            } catch (err) {
                if (err.message && err.message.includes('Duplicate column')) {
                    console.log(`Column ${columnName} already exists`);
                } else {
                    console.log(`Column ${columnName} check:`, err.message);
                }
            }
        };

        await addColumnIfNotExists('risk_name', 'VARCHAR(255)');
        await addColumnIfNotExists('risk_description', 'TEXT');
        await addColumnIfNotExists('impact', "VARCHAR(20) DEFAULT 'Medium'");
        await addColumnIfNotExists('owner', 'VARCHAR(255)');
        await addColumnIfNotExists('mitigation', 'TEXT');
        await addColumnIfNotExists('required_action', 'TEXT');
        console.log('Risk register table migration completed');

        // Create critical_tasks table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS critical_tasks (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                title VARCHAR(255) NOT NULL,
                priority VARCHAR(20) DEFAULT 'Medium',
                description TEXT,
                assigned_team VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Open',
                is_archived TINYINT(1) DEFAULT 0,
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_archived (is_archived)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create session table for express-mysql-session
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) NOT NULL PRIMARY KEY,
                expires INT UNSIGNED NOT NULL,
                data MEDIUMTEXT,
                INDEX idx_expires (expires)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('All MySQL tables created successfully');
        
        // Create default admin user if not exists
        const [adminRows] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            ['admin']
        );
        
        if (adminRows.length === 0) {
            console.log('Creating default admin user...');
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash('admin', 10);
            await connection.execute(
                `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active) 
                 VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
                ['admin', 'admin@local', passwordHash, 'Administrator', 'admin', 1]
            );
            console.log('Default admin user created');
        }
        
    } catch (error) {
        console.error('Database initialization error:', error.message);
        return null;
    } finally {
        if (connection) {
            connection.release();
        }
    }
    
    return pool;
}

// Helper function for queries with MySQL syntax
async function query(sql, params = []) {
    if (!pool) {
        throw new Error('Database not available');
    }
    try {
        let mysqlSql = sql.replace(/\$(\d+)/g, '?');
        if (mysqlSql.toLowerCase().includes('returning')) {
            mysqlSql = mysqlSql.replace(/\s+RETURNING\s+.+$/i, '');
        }
        const [rows] = await pool.execute(mysqlSql, params);
        return { rows: Array.isArray(rows) ? rows : [rows] };
    } catch (error) {
        console.error('MySQL query error:', error);
        throw error;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    query
};

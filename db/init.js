const { Pool } = require('pg');

// SSL configuration - disabled by default, enable for external databases
const sslConfig = process.env.DB_SSL === 'true' 
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } 
    : false;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Enable UUID extension
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        
        // Create tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                full_name VARCHAR(100),
                role VARCHAR(20) DEFAULT 'user',
                saml_id VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                target_end_date DATE,
                completion_percentage INTEGER DEFAULT 0,
                assigned_team VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Active',
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS weekly_tasks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                assigned_team VARCHAR(255),
                checklist JSONB,
                week_number INTEGER,
                year INTEGER,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS vulnerabilities (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                severity VARCHAR(20) DEFAULT 'Moderate',
                description TEXT,
                status VARCHAR(20) DEFAULT 'Open',
                discovered_date DATE DEFAULT CURRENT_DATE,
                resolved_date DATE,
                assignment_group VARCHAR(255),
                due_date DATE,
                source VARCHAR(50) DEFAULT 'Manual',
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(title)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS risk_register (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                risk_description TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'Active',
                required_action TEXT,
                is_archived BOOLEAN DEFAULT false,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS critical_tasks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                priority VARCHAR(20) DEFAULT 'Medium',
                description TEXT,
                assigned_team VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Open',
                is_archived BOOLEAN DEFAULT false,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create session table for connect-pg-simple
        await client.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
        `);

        console.log('All tables created successfully');
    } finally {
        client.release();
    }
    
    // Return the pool for use in server
    return pool;
}

module.exports = {
    pool,
    initializeDatabase,
    query: (text, params) => pool.query(text, params)
};

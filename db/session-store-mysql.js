const session = require('express-session');

// Check if we should use MySQL or memory store
const useMySQL = process.env.DB_HOST && process.env.DB_HOST !== 'localhost';

let sessionStore;

if (useMySQL) {
    try {
        const MySQLStore = require('express-mysql-session')(session);
        const options = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'it_infrastructure_tracker',
            clearExpired: true,
            checkExpirationInterval: 900000,
            expiration: 86400000,
            createDatabaseTable: true,
            schema: {
                tableName: 'sessions',
                columnNames: {
                    session_id: 'session_id',
                    expires: 'expires',
                    data: 'data'
                }
            }
        };
        sessionStore = new MySQLStore(options);
        console.log('Using MySQL session store');
    } catch (error) {
        console.warn('Failed to create MySQL session store, falling back to memory:', error.message);
        sessionStore = null;
    }
} else {
    console.log('No DB_HOST configured, using default session store');
    sessionStore = null;
}

module.exports = sessionStore;

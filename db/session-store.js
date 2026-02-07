const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./init');

const sessionStore = new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
});

module.exports = sessionStore;

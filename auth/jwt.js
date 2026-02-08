const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db/init');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Middleware to protect routes
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const user = verifyToken(token);
    if (!user) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
}

async function registerUser({ username, email, password, fullName }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await query(
        `INSERT INTO users (username, email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4, 'user') 
         RETURNING id, username, email, full_name, role`,
        [username, email, hashedPassword, fullName]
    );
    
    return result.rows[0];
}

async function loginUser(username, password) {
    const result = await query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
    );

    if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    
    if (!user.password_hash) {
        throw new Error('Please use SSO login');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }

    // Update last login
    await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
    );

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        token: generateToken(user)
    };
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken,
    registerUser,
    loginUser
};

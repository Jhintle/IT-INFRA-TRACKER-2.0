console.log('Starting server initialization...');

try {
    const express = require('express');
    console.log('Express loaded');
    
    const cors = require('cors');
    const helmet = require('helmet');
    const morgan = require('morgan');
    const session = require('express-session');
    const passport = require('passport');
    const path = require('path');
    
    console.log('Loading environment config...');
    require('dotenv').config();
    console.log('Environment loaded, PORT:', process.env.PORT || 8080);

    console.log('Loading routes and modules...');
    const authRoutes = require('./routes/auth');
    const apiRoutes = require('./routes/api-mysql');
    const { initializeDatabase } = require('./db/init-mysql');
    const { configurePassport } = require('./auth/passport');
    const { authenticateToken } = require('./auth/jwt');
    console.log('All modules loaded successfully');

    const app = express();

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sheetjs.com", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'"],
            },
        },
    }));

    app.use(cors({
        origin: true,
        credentials: true
    }));

    // Logging
    app.use(morgan('combined'));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session configuration with MySQL store
    console.log('Configuring session store...');
    const sessionStore = require('./db/session-store-mysql');
    app.use(session({
        store: sessionStore,
        secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
        resave: false,
        saveUninitialized: false,
        name: 'sessionId',
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        }
    }));
    console.log('Session configured');

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());
    configurePassport(passport);
    console.log('Passport configured');

    // Global database reference
    let db = null;

    // Attach database to all requests
    app.use((req, res, next) => {
        req.db = db;
        req.app.locals.db = db;
        next();
    });

    // Health check endpoint - MUST BE FIRST
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0-mysql',
            database: 'MySQL',
            samlEnabled: process.env.ENABLE_SAML === 'true',
            environment: process.env.NODE_ENV || 'development'
        });
    });
    
    console.log('Health check endpoint registered');

    // Auth validation endpoint
    app.get('/api/auth/validate', authenticateToken, (req, res) => {
        res.status(200).json({ valid: true, user: req.user });
    });

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api', apiRoutes);
    console.log('API routes registered');

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Server error:', err.message);
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Endpoint not found' });
    });

    // Start server immediately
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`MySQL Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Initialize database asynchronously (don't block server start)
    setTimeout(async () => {
        try {
            console.log('Initializing MySQL database...');
            db = await initializeDatabase();
            if (db) {
                console.log('MySQL database initialized successfully');
            } else {
                console.log('Running without database connection');
            }
        } catch (error) {
            console.error('Database connection failed:', error.message);
            console.log('Server will continue without database');
        }
    }, 100);

} catch (error) {
    console.error('FATAL ERROR during server startup:', error);
    console.error(error.stack);
    process.exit(1);
}

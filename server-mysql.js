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
        contentSecurityPolicy: false,
    }));

    app.use(cors({
        origin: true,
        credentials: true
    }));

    // Logging
    app.use(morgan('combined'));

    // Content Security Policy: allow external scripts for charts and SQL wasm
    app.use((req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.sheetjs.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://sql.js.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';"
        );
        next();
    });

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

    // Serve static HTML files
    console.log('__dirname:', __dirname);
    console.log('Registering root route...');
    
    app.get('/', (req, res) => {
        console.log('Root route hit, serving login.html');
        const filePath = path.join(__dirname, 'login.html');
        console.log('File path:', filePath);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error serving login.html:', err);
                res.status(404).json({ error: 'Login page not found', details: err.message });
            }
        });
    });
    
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'login.html'), (err) => {
            if (err) {
                console.error('Error serving login.html:', err);
                res.status(404).json({ error: 'Login page not found' });
            }
        });
    });
    
    app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'), (err) => {
            if (err) {
                console.error('Error serving index.html:', err);
                res.status(404).json({ error: 'Dashboard page not found' });
            }
        });
    });

    app.get('/index.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'), (err) => {
            if (err) {
                console.error('Error serving index.html:', err);
                res.status(404).json({ error: 'Dashboard page not found' });
            }
        });
    });

    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'admin.html'), (err) => {
            if (err) {
                console.error('Error serving admin.html:', err);
                res.status(404).json({ error: 'Admin page not found' });
            }
        });
    });
    
    // Serve static assets (css, js, assets)
    app.use('/css', express.static(path.join(__dirname, 'css')));
    app.use('/js', express.static(path.join(__dirname, 'js')));
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    console.log('Static file routes registered');

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Server error:', err.message);
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });

    // Debug middleware to log all unmatched requests
    app.use((req, res, next) => {
        console.log(`DEBUG: Unmatched request - ${req.method} ${req.url} from ${req.ip}`);
        next();
    });

    // 404 handler
    app.use((req, res) => {
        console.log(`404 Not Found: ${req.method} ${req.url}`);
        res.status(404).json({ error: 'Endpoint not found', path: req.url, method: req.method });
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

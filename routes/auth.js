const express = require('express');
const passport = require('passport');
const { loginUser, registerUser } = require('../auth/jwt');
const { authenticateToken } = require('../auth/jwt');
const router = express.Router();

// Local login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await loginUser(username, password);
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            },
            token: user.token
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Register (admin only in production)
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password required' });
        }

        const user = await registerUser({ username, email, password, fullName });
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name
            }
        });
    } catch (error) {
        if (error.message.includes('unique constraint')) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// SAML Routes (only if enabled)
if (process.env.ENABLE_SAML === 'true') {
    // Initiate SAML login
    router.get('/saml', passport.authenticate('saml', {
        failureRedirect: '/login',
        failureFlash: true
    }));

    // SAML callback
    router.post('/saml/callback', 
        passport.authenticate('saml', { failureRedirect: '/login' }),
        (req, res) => {
            // Generate JWT for SAML user
            const { generateToken } = require('../auth/jwt');
            const token = generateToken(req.user);
            
            // Redirect to frontend with token
            res.redirect(`/?token=${token}`);
        }
    );

    // SAML metadata
    router.get('/saml/metadata', (req, res) => {
        const saml = require('passport-saml');
        const strategy = passport._strategies.saml;
        
        if (strategy) {
            res.type('application/xml');
            res.send(strategy.generateServiceProviderMetadata(
                process.env.SAML_CERT,
                process.env.SAML_CERT
            ));
        } else {
            res.status(404).json({ error: 'SAML not configured' });
        }
    });
}

module.exports = router;

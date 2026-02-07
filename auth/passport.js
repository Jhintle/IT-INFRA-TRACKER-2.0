const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { query } = require('../db/init');

// Configure local strategy
function configureLocalStrategy() {
    passport.use('local', new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, async (username, password, done) => {
        try {
            const result = await query(
                'SELECT * FROM users WHERE username = $1 AND is_active = true',
                [username]
            );

            if (result.rows.length === 0) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            const user = result.rows[0];

            // Check if user has a password (local user)
            if (!user.password_hash) {
                return done(null, false, { message: 'Please use SSO login' });
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            // Update last login
            await query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            return done(null, {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            });
        } catch (error) {
            return done(error);
        }
    }));
}

// Configure SAML strategy (if enabled)
function configureSamlStrategy() {
    if (process.env.ENABLE_SAML !== 'true') {
        console.log('SAML authentication disabled');
        return;
    }

    try {
        const { Strategy: SamlStrategy } = require('passport-saml');
        
        const samlConfig = {
            entryPoint: process.env.SAML_ENTRY_POINT,
            issuer: process.env.SAML_ISSUER,
            callbackUrl: '/api/auth/saml/callback',
            cert: process.env.SAML_CERT,
            identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            acceptedClockSkewMs: 60000
        };

        passport.use('saml', new SamlStrategy(samlConfig, async (profile, done) => {
            try {
                const email = profile.email || profile.nameID;
                const samlId = profile.nameID;

                // Check if user exists
                let result = await query(
                    'SELECT * FROM users WHERE saml_id = $1 OR email = $2',
                    [samlId, email]
                );

                let user;

                if (result.rows.length > 0) {
                    // Existing user - update SAML info
                    user = result.rows[0];
                    await query(
                        'UPDATE users SET saml_id = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
                        [samlId, user.id]
                    );
                } else {
                    // Create new user from SAML
                    const newUser = await query(
                        `INSERT INTO users (username, email, full_name, saml_id, role) 
                         VALUES ($1, $2, $3, $4, 'user') 
                         RETURNING *`,
                        [email.split('@')[0], email, profile.displayName || email.split('@')[0], samlId]
                    );
                    user = newUser.rows[0];
                }

                return done(null, {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    samlUser: true
                });
            } catch (error) {
                return done(error);
            }
        }));

        console.log('SAML authentication enabled');
    } catch (error) {
        console.error('Failed to configure SAML:', error);
    }
}

function configurePassport(passport) {
    // Serialize user
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
        try {
            const result = await query(
                'SELECT id, username, email, full_name, role FROM users WHERE id = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return done(null, false);
            }
            
            done(null, result.rows[0]);
        } catch (error) {
            done(error);
        }
    });

    configureLocalStrategy();
    configureSamlStrategy();
}

module.exports = { configurePassport };

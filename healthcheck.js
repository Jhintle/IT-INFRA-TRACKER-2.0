const http = require('http');

const options = {
    host: '0.0.0.0',
    port: process.env.PORT || 3002,
    path: '/api/health',
    timeout: 2000
};

const request = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.log('Health check failed with status:', res.statusCode);
        process.exit(1);
    }
});

request.on('error', (err) => {
    console.log('Health check error:', err.message);
    process.exit(1);
});

request.end();

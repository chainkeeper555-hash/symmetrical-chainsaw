require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const morgan = require('morgan');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const rateLimit = require('express-rate-limit');

// Import routes
const mainRoutes = require('./routes/index');
const giveawayRoutes = require('./routes/giveawayRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const giveawayContentRoutes = require('./routes/giveawayContentRoutes');
const contactRoutes = require('./routes/contactRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const newsRoutes = require('./routes/newsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate environment variables
const requiredEnvVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'MONGO_URI'
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing environment variables:', missingEnvVars.join(', '));
    console.error('Please set these in your .env file');
    process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? '****' : undefined
});

// Test Cloudinary connection
cloudinary.api.ping()
    .then(() => console.log('✅ Cloudinary API connection successful'))
    .catch(err => console.error('❌ Cloudinary API connection failed:', err.message));

// 🛡️ SECURITY - Helmet setup
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.tailwindcss.com',
                'https://unpkg.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com'
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://unpkg.com',
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
                'https://cdn.jsdelivr.net'
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:', 'https://cdn.jsdelivr.net'],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://cdnjs.cloudflare.com',
                'https://static.photos',
                'https://res.cloudinary.com'
            ],
            connectSrc: [
                "'self'",
                'http://localhost:3000',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://kick.com',
                'https://bcgame.st',
                'https://unpkg.com',
                'https://api.cloudinary.com',
                'https://bc.game'
            ],
            frameSrc: [
                "'self'",
                'https://www.youtube.com',
                'https://youtube.com',
                'https://youtu.be',
                'https://www.youtube-nocookie.com',
                'https://player.vimeo.com',
                'https://www.kick.com'
            ],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 🌍 CORS setup
app.use(cors({
    origin: [
        'http://localhost:3000',
        process.env.CLIENT_URL || 'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

// 🧱 Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', {
    skip: (req, res) => req.path === '/api' && req.method === 'GET'
}));

// Rate limiter for /api/upload-image
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 requests per IP
    message: 'Too many upload requests, please try again later.'
});
app.use('/api/upload-image', uploadLimiter);

// 🗂️ Static frontend files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.html') {
            res.set('Cache-Control', 'no-cache');
        }
    }
}));
app.use('/font', express.static(path.join(__dirname, 'font'), {
    setHeaders: (res) => {
        res.set('Cache-Control', 'public, max-age=31536000');
    }
}));
app.use('/img', express.static(path.join(__dirname, 'img'), {
    setHeaders: (res) => {
        res.set('Cache-Control', 'public, max-age=86400');
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// 🧭 API Routes
console.log('🔗 Mounting API routes');
app.use('/api', mainRoutes);
app.use('/api/giveaway', giveawayRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/giveaway-content', giveawayContentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/news', newsRoutes);

// 🖼️ Cloudinary Image Upload Endpoint
app.post('/api/upload-image', async (req, res) => {
    try {
        if (!req.body.image) {
            return res.status(400).json({ message: 'No image provided' });
        }
        if (!req.body.image.startsWith('data:image/')) {
            return res.status(400).json({ message: 'Invalid image format' });
        }
        const match = req.body.image.match(/^data:image\/(\w+);base64,/);
        if (!match) {
            return res.status(400).json({ message: 'Invalid base64 image header' });
        }
        const imageType = match[1];
        const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
        if (!base64Data) {
            return res.status(400).json({ message: 'Invalid base64 data' });
        }
        console.log('Image upload attempt:', {
            imageType,
            base64Length: base64Data.length,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length === 0) {
            return res.status(400).json({ message: 'Empty image buffer' });
        }
        console.log('Uploading to Cloudinary, buffer size:', buffer.length);
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'streamerpulse',
                    resource_type: 'image',
                    timeout: 30000
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', {
                            message: error.message,
                            name: error.name,
                            http_code: error.http_code,
                            stack: error.stack,
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            timestamp: new Date().toISOString()
                        });
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );
            const readableStream = Readable.from(buffer);
            readableStream.on('error', (err) => {
                console.error('Stream error:', {
                    message: err.message,
                    stack: err.stack,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString()
                });
                reject(new Error('Stream piping failed'));
            });
            readableStream.pipe(stream);
        });
        console.log('Cloudinary upload success:', {
            url: result.secure_url,
            public_id: result.public_id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(200).json({
            message: 'Image uploaded successfully',
            url: result.secure_url,
            public_id: result.public_id
        });
    } catch (err) {
        console.error('Error uploading to Cloudinary:', {
            message: err.message,
            name: err.name,
            http_code: err.http_code,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        let errorMessage = 'Failed to upload image';
        if (err.http_code === 401) {
            errorMessage = 'Unauthorized: Invalid Cloudinary credentials';
        } else if (err.http_code === 400) {
            errorMessage = 'Bad request: Check image data or Cloudinary configuration';
        } else if (err.http_code === 420) {
            errorMessage = 'Rate limit exceeded: Try again later';
        }
        res.status(err.http_code === 401 ? 401 : 500).json({ message: errorMessage, details: err.message });
    }
});

// 🩺 Health check endpoint
app.use('/api', (req, res, next) => {
    if (req.path === '/' && req.method === 'GET') {
        return res.status(200).json({ message: 'SH4NER Backend is running! 🚀' });
    }
    next();
});

// 📄 Serve dashboard.html for /admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// 📄 Serve frontend index.html for non-admin SPA routes and handle 404s
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API endpoint not found' });
    }
    if (req.path.startsWith('/font') || req.path.startsWith('/img')) {
        return next();
    }
    if (req.path.startsWith('/admin')) {
        return res.status(404).send('Admin page not found');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ⚠️ Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: 'Something went wrong!', details: err.message });
});

// 🧠 MongoDB Connection
console.log("🔍 Mongo URI:", process.env.MONGO_URI || 'mongodb://localhost:27017/streamerpulse');
mongoose.connect(process.env.MONGO_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', {
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });
        process.exit(1);
    });

// 🚀 Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    console.log(`🔗 Admin URL: http://localhost:${PORT}/admin`);
});
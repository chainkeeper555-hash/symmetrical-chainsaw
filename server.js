import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cloudinary from 'cloudinary';
import { Readable } from 'stream';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import mainRoutes from './routes/index.js';
import giveawayRoutes from './routes/giveawayRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import giveawayContentRoutes from './routes/giveawayContentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import newsRoutes from './routes/newsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Leaderboard-specific configurations
const CACHE_FILE = path.join(__dirname, 'bcgame_cache.json');
const CACHE_TTL = 30 * 1000; // 30 seconds for testing
const BC_API_URL = 'https://bc.game/api/agent/open-api/kol/invitees/';
const BC_LOGO = '/img/bc-game-esports-logo-png_seeklogo-619973.png'; // Local image path
const ACCOUNTS = [
    { invitationCode: '2cv50ogdp', accessKey: process.env.BC_ACCESS_KEY_1 || 'iigYk9dcgO2XJZeo' },
    { invitationCode: 'sh4ner', accessKey: process.env.BC_ACCESS_KEY_2 || 'ZyFuCnq66f3ODBCv' },
];

// Fixed UTC period: October 1, 2025 - October 31, 2025
const START_DATE = new Date(Date.UTC(2025, 9, 1, 0, 0, 0)); // Month 9 = October
const END_DATE = new Date(Date.UTC(START_DATE.getUTCFullYear(), START_DATE.getUTCMonth() + 1, 0, 23, 59, 59));
const BEGIN_UTC = Math.floor(START_DATE.getTime() / 1000);
const END_UTC = Math.floor(END_DATE.getTime() / 1000);

// Embedded leaderboard data as fallback
const EMBEDDED_DATA = {
  leaderboard: [
    { rank: 1, username: "ЖЕ*****ЧУ", wagered: 243747.58, prize: 4000, img: BC_LOGO },
    { rank: 2, username: "Ma***ts", wagered: 205427.81, prize: 2000, img: BC_LOGO },
    { rank: 3, username: "Lb*******yb", wagered: 97128.16, prize: 1000, img: BC_LOGO },
    { rank: 4, username: "El********cc", wagered: 94694.31, prize: 250, img: BC_LOGO },
    { rank: 5, username: "St********ac", wagered: 68815, prize: 250, img: BC_LOGO },
    { rank: 6, username: "Ma*****f5", wagered: 35404.04, prize: 250, img: BC_LOGO },
    { rank: 7, username: "Ki**_K", wagered: 13919.21, prize: 250, img: BC_LOGO },
    { rank: 8, username: "Ma*****ay", wagered: 13235.44, prize: 250, img: BC_LOGO },
    { rank: 9, username: "Re**im", wagered: 11396.51, prize: 250, img: BC_LOGO },
    { rank: 10, username: "Ng******ri", wagered: 10468.95, prize: 250, img: BC_LOGO },
    { rank: 11, username: "اب***کل", wagered: 9752.73, prize: 250, img: BC_LOGO },
    { rank: 12, username: "Az******🚬", wagered: 7833.94, prize: 250, img: BC_LOGO },
    { rank: 13, username: "ᘻᓍ******🎭", wagered: 6474.33, prize: 250, img: BC_LOGO },
    { rank: 14, username: "Tr******oa", wagered: 6094.99, prize: 250, img: BC_LOGO },
    { rank: 15, username: "Sa**********te", wagered: 5830.2, prize: 250, img: BC_LOGO },
    { rank: 16, username: "Bu**********ze", wagered: 5253.2, img: BC_LOGO },
    { rank: 17, username: "Br***um", wagered: 4680, img: BC_LOGO },
    { rank: 18, username: "सा************🚩", wagered: 4331.13, img: BC_LOGO },
    { rank: 19, username: "ih*****fe", wagered: 4240, img: BC_LOGO },
    { rank: 20, username: "La*****25", wagered: 3588.75, img: BC_LOGO },
  ],
  lastupdated: "15.10.2025 03:30:00 UTC",
};

// Mock data as fallback
const MOCK_DATA = [
    { rank: 1, username: 'Player1', totalWager: 10000.50, reward: 100.00, img: BC_LOGO },
    { rank: 2, username: 'Player2', totalWager: 5000.25, reward: 50.00, img: BC_LOGO },
    { rank: 3, username: 'Ma***ts', totalWager: 204547.88, reward: 2000.00, img: BC_LOGO },
];

console.log('UTC Period:', START_DATE.toISOString(), '-', END_DATE.toISOString());
console.log('Serving images from:', path.join(__dirname, 'img'));

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
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? '****' : undefined
});

// Test Cloudinary connection
cloudinary.v2.api.ping()
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
                'https://cdn.jsdelivr.net'
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
                'http://localhost:3000',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://res.cloudinary.com'
            ],
            connectSrc: [
                "'self'",
                'http://localhost:3000',
                'https://cdn.jsdelivr.net',
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
    crossOriginResourcePolicy: { policy: 'cross-origin' }
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
            const stream = cloudinary.v2.uploader.upload_stream(
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

// 🏆 Leaderboard Endpoint
app.get('/api/leaderboard', async (req, res) => {
    try {
        const data = await fetchAndMerge();
        res.json({ data });
    } catch (err) {
        console.error('Error in /api/leaderboard:', {
            message: err.message,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Retry-enabled fetch
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP error: ${res.status} - ${res.statusText}`);
        } catch (err) {
            if (i < retries - 1) {
                console.warn(`Retrying ${url} (${i + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error(`Failed to fetch ${url}: ${err.message}`);
            }
        }
    }
}

// Fetch BC.Game data
async function fetchBCGame(account) {
    try {
        const payload = {
            invitationCode: account.invitationCode,
            accessKey: account.accessKey,
            beginTimestamp: BEGIN_UTC,
            endTimestamp: END_UTC,
        };

        const res = await fetchWithRetry(BC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
            body: JSON.stringify(payload),
        });

        const json = await res.json();
        console.log(`BC.Game response for ${account.invitationCode}:`, JSON.stringify(json, null, 2));
        return json?.data || [];
    } catch (err) {
        console.error(`Error fetching BC.Game data for ${account.invitationCode}:`, err.message);
        return [];
    }
}

// Use embedded data and normalize
function getEmbeddedData() {
    try {
        const rawData = EMBEDDED_DATA.leaderboard || [];
        console.log('Using embedded data:', JSON.stringify(rawData, null, 2));

        // Normalize embedded fields
        return rawData.map(p => ({
            rank: p.rank || null,
            username: p.username || 'Unknown',
            totalWager: p.wagered ? parseFloat(p.wagered) : 0,
            reward: p.prize ? parseFloat(p.prize) : 0,
            img: BC_LOGO,
        }));
    } catch (err) {
        console.error('Error processing embedded data:', err.message);
        return [];
    }
}

// Merge and cache data
async function fetchAndMerge() {
    // Check cache
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            if (Date.now() - cache.timestamp < CACHE_TTL) {
                console.log('Returning cached data');
                return cache.data;
            }
        }
    } catch (err) {
        console.error('Error reading cache:', err.message);
    }

    const allResults = [];

    // Fetch BC.Game accounts
    for (const acc of ACCOUNTS) {
        const data = await fetchBCGame(acc);
        allResults.push(...data.map(p => ({
            username: p.username || 'Unknown',
            totalWager: p.totalWager || 0,
            reward: p.reward || 0,
            img: BC_LOGO,
        })));
    }

    // Use embedded data
    const embeddedData = getEmbeddedData();
    allResults.push(...embeddedData);

    // Use mock data if no results
    if (!allResults.length) {
        console.warn('No data from APIs or embedded source, using mock data');
        allResults.push(...MOCK_DATA);
    }

    // Merge duplicates by username
    const merged = {};
    for (const p of allResults) {
        const name = p.username || 'Unknown';
        if (!merged[name]) {
            merged[name] = {
                rank: p.rank || null,
                username: name,
                totalWager: 0,
                reward: 0,
                img: BC_LOGO,
            };
        }
        merged[name].totalWager += p.totalWager || 0;
        merged[name].reward += p.reward || 0;
    }

    // Convert to array and sort
    let mergedArray = Object.values(merged);
    if (embeddedData.length && embeddedData.every(p => p.rank !== null)) {
        // Use embedded data ranks if available
        mergedArray = mergedArray.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
    } else {
        // Sort by totalWager descending and assign ranks
        mergedArray = mergedArray
            .sort((a, b) => b.totalWager - a.totalWager)
            .map((entry, index) => ({
                ...entry,
                rank: index + 1,
            }));
    }

    // Cache to file
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data: mergedArray }, null, 2));
    } catch (err) {
        console.error('Error writing cache:', err.message);
    }

    return mergedArray;
}

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
console.log('🔍 Mongo URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/streamerpulse');
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

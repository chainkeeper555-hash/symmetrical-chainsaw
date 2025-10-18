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
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // New dependency for random password

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
const CACHE_TTL = 1 * 60 * 1000; // 1 minute
const BC_API_URL = 'https://bc.game/api/agent/open-api/kol/invitees/';
const BC_LOGO = '/img/bc-game-esports-logo-png_seeklogo-619973.png';
const ACCOUNTS = [
    { invitationCode: '2cv50ogdp', accessKey: process.env.BC_ACCESS_KEY_1 || 'iigYk9dcgO2XJZeo' },
    { invitationCode: 'sh4ner', accessKey: process.env.BC_ACCESS_KEY_2 || 'ZyFuCnq66f3ODBCv' },
];

// Fixed UTC period: October 1, 2025 - October 31, 2025
const START_DATE = new Date(Date.UTC(2025, 9, 1, 0, 0, 0));
const END_DATE = new Date(Date.UTC(START_DATE.getUTCFullYear(), START_DATE.getUTCMonth() + 1, 0, 23, 59, 59));
const BEGIN_UTC = Math.floor(START_DATE.getTime() / 1000);
const END_UTC = Math.floor(END_DATE.getTime() / 1000);

// Flag to force API fetch on first call after server restart
let forceFetchOnStartup = true;

// Clear cache file on server startup
try {
    if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
        console.log('Cleared cache file on server startup');
    }
} catch (err) {
    console.error('Error clearing cache file on startup:', err.message);
}

// Embedded leaderboard data as fallback
const EMBEDDED_DATA = {
  leaderboard: [
    { rank: 1, username: "ЖЕ*****ЧУ", wagered: 243747.58, prize: 3000, img: BC_LOGO },
    { rank: 2, username: "Ma***ts", wagered: 205427.81, prize: 2000, img: BC_LOGO },
    { rank: 3, username: "Lb*******yb", wagered: 97128.16, prize: 1000, img: BC_LOGO },
    { rank: 4, username: "El********cc", wagered: 94694.31, prize: 500, img: BC_LOGO },
    { rank: 5, username: "St********ac", wagered: 68815, prize: 250, img: BC_LOGO },
    { rank: 6, username: "Ma*****f5", wagered: 35404.04, prize: 250, img: BC_LOGO },
    { rank: 7, username: "Ki**_K", wagered: 13919.21, prize: 0, img: BC_LOGO },
    { rank: 8, username: "Ma*****ay", wagered: 13235.44, prize: 0, img: BC_LOGO },
    { rank: 9, username: "Re**im", wagered: 11396.51, prize: 0, img: BC_LOGO },
    { rank: 10, username: "Ng******ri", wagered: 10468.95, prize: 0, img: BC_LOGO },
    { rank: 11, username: "اب***کل", wagered: 9752.73, prize: 0, img: BC_LOGO },
    { rank: 12, username: "Az******🚬", wagered: 7833.94, prize: 0, img: BC_LOGO },
    { rank: 13, username: "ᘻᓍ******🎭", wagered: 6474.33, prize: 0, img: BC_LOGO },
    { rank: 14, username: "Tr******oa", wagered: 6094.99, prize: 0, img: BC_LOGO },
    { rank: 15, username: "Sa**********te", wagered: 5830.2, prize: 0, img: BC_LOGO },
    { rank: 16, username: "Bu**********ze", wagered: 5253.2, prize: 0, img: BC_LOGO },
    { rank: 17, username: "Br***um", wagered: 4680, prize: 0, img: BC_LOGO },
    { rank: 18, username: "सा************🚩", wagered: 4331.13, prize: 0, img: BC_LOGO },
    { rank: 19, username: "ih*****fe", wagered: 4240, prize: 0, img: BC_LOGO },
    { rank: 20, username: "La*****25", wagered: 3588.75, prize: 0, img: BC_LOGO },
  ],
  lastupdated: "15.10.2025 03:30:00 UTC",
};

// Minimal fallback data
const FALLBACK_DATA = [
    { rank: null, username: 'Un****wn', totalWager: 0, reward: 0, img: BC_LOGO }
];

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 1 } // Track session version for invalidation
});

const User = mongoose.model('User', userSchema);

// Create default admin user on startup
async function initializeDefaultUser() {
    try {
        const defaultEmail = 'admin@streamerpulse.com';
        const defaultPassword = `${uuidv4().slice(0, 12)}!Ab1`; // Random secure password
        const existingUser = await User.findOne({ email: defaultEmail });
        if (!existingUser) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await User.create({
                email: defaultEmail,
                password: hashedPassword,
                isDefault: true,
                sessionVersion: 1
            });
            console.log('Default admin user created with email:', defaultEmail);
            console.log('Default password (save this, shown only once):', defaultPassword);
        }
    } catch (err) {
        console.error('Error initializing default user:', err.message);
    }
}

console.log('UTC Period:', START_DATE.toISOString(), '-', END_DATE.toISOString());
console.log('Serving images from:', path.join(__dirname, 'img'));

// Validate environment variables
const requiredEnvVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'MONGO_URI',
    'JWT_SECRET'
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
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// 🧱 Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', {
    skip: (req, res) => req.path === '/api' && req.method === 'GET'
}));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Rate limiter for /api/upload-image
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 requests per IP
    message: 'Too many upload requests, please try again later.'
});
app.use('/api/upload-image', uploadLimiter);

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit to 5 login attempts per IP
    message: 'Too many login attempts, please try again later.'
});

// Rate limiter for update credentials endpoint
const updateCredentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit to 5 attempts per IP
    message: 'Too many credential update attempts, please try again later.'
});

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
app.use('/api/giveaway', authenticateToken, giveawayRoutes);
app.use('/api/schedule', authenticateToken, scheduleRoutes);
app.use('/api/reviews', authenticateToken, reviewRoutes);
app.use('/api/giveaway-content', authenticateToken, giveawayContentRoutes);
app.use('/api/contact', authenticateToken, contactRoutes);
app.use('/api/tracking', authenticateToken, trackingRoutes);
app.use('/api/news', authenticateToken, newsRoutes);

// 🖼️ Cloudinary Image Upload Endpoint
app.post('/api/upload-image', authenticateToken, uploadLimiter, async (req, res) => {
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
            timestamp: new Date().toISOString(),
            user: req.user.email
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
                            timestamp: new Date().toISOString(),
                            user: req.user.email
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
                    timestamp: new Date().toISOString(),
                    user: req.user.email
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
            timestamp: new Date().toISOString(),
            user: req.user.email
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
            timestamp: new Date().toISOString(),
            user: req.user.email
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
        const { data, timestamp } = await fetchAndMerge();
        res.json({ timestamp, data });
    } catch (err) {
        console.error('Error in /api/leaderboard:', {
            message: err.message,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            timestamp: Date.now(),
            data: FALLBACK_DATA,
            error: 'Failed to fetch leaderboard',
            details: err.message
        });
    }
});

// 🧹 Clear Cache Endpoint
app.post('/api/clear-cache', authenticateToken, async (req, res) => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            console.log('Cache cleared via /api/clear-cache');
        }
        forceFetchOnStartup = true;
        res.status(200).json({ message: 'Cache cleared successfully, next leaderboard request will fetch fresh data' });
    } catch (err) {
        console.error('Error clearing cache:', {
            message: err.message,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            user: req.user.email
        });
        res.status(500).json({ message: 'Failed to clear cache', details: err.message });
    }
});

// 🩺 BC.Game API Health Check Endpoint
app.get('/api/bc-health', authenticateToken, async (req, res) => {
    try {
        const payload = {
            invitationCode: ACCOUNTS[0].invitationCode,
            accessKey: ACCOUNTS[0].accessKey,
            beginTimestamp: BEGIN_UTC,
            endTimestamp: END_UTC
        };
        console.log('Testing BC.Game API with payload:', JSON.stringify(payload, null, 2));
        const response = await fetch(BC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        console.log('BC.Game API health response:', JSON.stringify(json, null, 2));
        res.status(200).json({
            status: response.ok ? 'API reachable' : `API error: ${response.status}`,
            response: json,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('BC.Game API health check failed:', err.message);
        res.status(500).json({
            status: 'API unreachable',
            details: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔒 Login Endpoint
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { email: user.email, id: user._id, sessionVersion: user.sessionVersion },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            isDefault: user.isDefault
        });
    } catch (err) {
        console.error('Login error:', {
            message: err.message,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: 'Login failed', details: err.message });
    }
});

// 🔒 Update Credentials Endpoint
app.post('/api/update-credentials', authenticateToken, updateCredentialsLimiter, async (req, res) => {
    try {
        const { oldEmail, currentPassword, newEmail, newPassword } = req.body;
        if (!oldEmail || !currentPassword || !newEmail || !newPassword) {
            return res.status(400).json({ error: 'Current email, current password, new email, and new password are required' });
        }

        // Validate new password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                error: 'New password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
            });
        }

        if (req.user.email !== oldEmail || req.user.sessionVersion !== (await User.findOne({ email: oldEmail })).sessionVersion) {
            return res.status(401).json({ error: 'Unauthorized: Invalid session or email' });
        }

        const user = await User.findOne({ email: oldEmail });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Check if new email is already in use
        if (newEmail !== oldEmail && (await User.findOne({ email: newEmail }))) {
            return res.status(400).json({ error: 'New email is already in use' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.email = newEmail;
        user.password = hashedPassword;
        user.isDefault = false;
        user.sessionVersion += 1; // Invalidate existing sessions
        await user.save();

        console.log('Credentials updated for user:', {
            oldEmail,
            newEmail,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Credentials updated successfully, please log in again' });
    } catch (err) {
        console.error('Update credentials error:', {
            message: err.message,
            stack: err.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            user: req.user.email
        });
        res.status(500).json({ error: 'Failed to update credentials', details: err.message });
    }
});

// Retry-enabled fetch
async function fetchWithRetry(url, options, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP error: ${res.status} - ${res.statusText}`);
        } catch (err) {
            console.warn(`Retrying ${url} (${i + 1}/${retries})... Error: ${err.message}`);
            if (i < retries - 1) {
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
        console.log(`Fetching BC.Game data for ${account.invitationCode} with payload:`, JSON.stringify(payload, null, 2));
        const res = await fetchWithRetry(BC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        console.log(`BC.Game response for ${account.invitationCode}:`, JSON.stringify(json, null, 2));
        if (!json.data) {
            console.warn(`No data returned for ${account.invitationCode}, response:`, JSON.stringify(json, null, 2));
            return [];
        }
        return json.data;
    } catch (err) {
        console.error(`Error fetching BC.Game data for ${account.invitationCode}:`, err.message);
        return [];
    }
}

// Format username to show first 2 and last 2 letters with stars in between
function formatUsername(name) {
    if (!name || typeof name !== 'string' || name === 'Unknown') {
        return 'Un****wn';
    }
    if (name.length <= 4) {
        return name; // If 4 or fewer characters, return as is
    }
    const firstTwo = name.slice(0, 2);
    const lastTwo = name.slice(-2);
    const stars = '*****';
    return `${firstTwo}${stars}${lastTwo}`;
}

// Use embedded data and normalize
function getEmbeddedData() {
    try {
        const rawData = EMBEDDED_DATA.leaderboard || [];
        console.log('Using embedded data as fallback:', JSON.stringify(rawData, null, 2));
        return rawData.map(p => ({
            rank: p.rank || null,
            username: p.username || 'Un****wn', // Already formatted in EMBEDDED_DATA
            totalWager: parseFloat(p.wagered) || 0,
            reward: parseFloat(p.prize) || 0,
            img: BC_LOGO,
        }));
    } catch (err) {
        console.error('Error processing embedded data:', err.message);
        return [];
    }
}

// Merge and cache data
async function fetchAndMerge() {
    let timestamp = Date.now();

    // Check cache
    if (!forceFetchOnStartup) {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                if (Date.now() - cache.timestamp < CACHE_TTL) {
                    console.log('Returning cached data:', JSON.stringify(cache.data, null, 2));
                    return { data: cache.data, timestamp: cache.timestamp };
                }
            }
        } catch (err) {
            console.error('Error reading cache:', err.message);
        }
    } else {
        console.log('Server restarted or cache cleared, forcing new API fetch');
        forceFetchOnStartup = false;
    }

    let allResults = [];

    // Fetch BC.Game accounts
    for (const acc of ACCOUNTS) {
        const data = await fetchBCGame(acc);
        console.log(`Processing ${acc.invitationCode} data, entries: ${data.length}`);
        if (data.length > 0) {
            const mappedData = data.map(p => ({
                username: formatUsername(p.name || 'Unknown'),
                totalWager: parseFloat(p.wager) || 0,
                reward: 0, // Will assign later
                img: BC_LOGO,
            }));
            console.log(`Mapped data for ${acc.invitationCode}:`, JSON.stringify(mappedData.slice(0, 5), null, 2));
            allResults = allResults.concat(mappedData);
        }
    }

    // Use embedded data only if no API data is retrieved
    if (allResults.length === 0) {
        console.warn('No data from BC.Game API for any account, using embedded data');
        allResults = getEmbeddedData();
    }

    // If still no data, use fallback
    if (allResults.length === 0) {
        console.warn('No data from BC.Game API or embedded source, using fallback data');
        allResults = FALLBACK_DATA;
    }

    console.log(`Total results before merging: ${allResults.length}`);

    // Merge duplicates by username
    const merged = {};
    for (const entry of allResults) {
        const name = entry.username || 'Un****wn';
        if (!merged[name]) {
            merged[name] = {
                username: name,
                totalWager: 0,
                reward: 0,
                img: BC_LOGO,
            };
        }
        merged[name].totalWager += entry.totalWager;
    }

    console.log(`Merged usernames: ${Object.keys(merged).length}`);

    // Sort by totalWager, assign ranks and rewards
    let mergedArray = Object.values(merged)
        .sort((a, b) => b.totalWager - a.totalWager)
        .map((entry, index) => {
            const rank = entry.username === 'Un****wn' ? null : index + 1;
            let reward = 0;
            if (rank === 1) reward = 3000;
            else if (rank === 2) reward = 2000;
            else if (rank === 3) reward = 1000;
            else if (rank === 4) reward = 500;
            else if (rank === 5 || rank === 6) reward = 250;
            return { ...entry, rank, reward };
        });

    // Ensure at least 20 entries
    mergedArray = mergedArray.slice(0, 20);

    // Add "Unknown" if not present
    if (!mergedArray.some(entry => entry.username === 'Un****wn')) {
        console.log('Adding fallback "Unknown" entry');
        mergedArray.push(...FALLBACK_DATA);
    }

    console.log('Final merged leaderboard data:', JSON.stringify(mergedArray, null, 2));

    // Cache to file
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp, data: mergedArray }, null, 2));
        console.log('Cache updated:', { timestamp: new Date(timestamp).toISOString() });
    } catch (err) {
        console.error('Error writing cache:', err.message);
    }

    return { data: mergedArray, timestamp };
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
        timestamp: new Date().toISOString(),
        user: req.user ? req.user.email : 'unauthenticated'
    });
    res.status(500).json({ message: 'Something went wrong!', details: err.message });
});

// 🧠 MongoDB Connection
console.log('🔍 Mongo URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/streamerpulse');
mongoose.connect(process.env.MONGO_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000
})
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await initializeDefaultUser();
    })
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

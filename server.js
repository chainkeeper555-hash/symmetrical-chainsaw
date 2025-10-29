import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cloudinary from 'cloudinary';
import { Readable } from 'stream';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';

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

// Leaderboard configurations
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

// In-memory cache (5-minute TTL)
const leaderboardCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const startupCacheKey = 'leaderboard_startup_done';

// Embedded fallback data
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
};

// Minimal fallback
const FALLBACK_DATA = [
    { rank: null, username: 'Un****wn', totalWager: 0, reward: 0, img: BC_LOGO }
];

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// Create default admin
async function initializeDefaultUser() {
    try {
        const defaultEmail = 'admin@streamerpulse.com';
        const defaultPassword = `${uuidv4().slice(0, 12)}!Ab1`;
        const existingUser = await User.findOne({ email: defaultEmail });
        if (!existingUser) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await User.create({
                email: defaultEmail,
                password: hashedPassword,
                isDefault: true,
                sessionVersion: 1
            });
        }
    } catch (err) {}
}

// Validate env
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'MONGO_URI', 'JWT_SECRET'];
if (requiredEnvVars.some(v => !process.env[v])) process.exit(1);

// Cloudinary config
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Compression
app.use(compression());

// Security – FIXED CSP: ALLOW cdnjs.cloudflare.com
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
                'https://cdnjs.cloudflare.com'   // ← ADDED
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://unpkg.com',
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
                'https://cdn.jsdelivr.net',
                'https://cdn.tailwindcss.com'
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:', 'https://cdn.jsdelivr.net'],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://sh4nerewards.com',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://res.cloudinary.com',
                'https://static.photos'
            ],
            connectSrc: [
                "'self'",
                'https://sh4nerewards.com',
                'https://cdn.jsdelivr.net',
                'https://kick.com',
                'https://player.kick.com',
                'https://bcgame.st',
                'https://unpkg.com',
                'https://api.cloudinary.com',
                'https://res.cloudinary.com',
                'https://bc.game',
                'https://t.me',
                'https://youtube.com',
                'https://www.instagram.com',
                'https://fonts.googleapis.com',
                'https://cdn.tailwindcss.com',
                'https://fonts.gstatic.com',
                'https://cdnjs.cloudflare.com'   // ← ADDED
            ],
            frameSrc: [
                "'self'",
                'https://www.youtube.com',
                'https://youtube.com',
                'https://youtu.be',
                'https://www.youtube-nocookie.com',
                'https://player.vimeo.com',
                'https://www.kick.com',
                'https://player.kick.com'
            ],
            workerSrc: ["'self'", 'blob:'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: ['https://sh4nerewards.com', process.env.CLIENT_URL || 'https://sh4nerewards.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// 3. Caching headers
app.use((req, res, next) => {
    if (req.path === '/api/leaderboard') {
        res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    } else if (req.path.startsWith('/font/') || req.path.startsWith('/img/')) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (req.path.startsWith('/admin') || /\/api\/(login|upload|clear-cache)/.test(req.path)) {
        res.set('Cache-Control', 'no-store');
    }
    next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { skip: req => req.path === '/api/leaderboard' }));

// Auth middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Rate limiters
const uploadLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: 'Too many uploads' });
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, message: 'Too many login attempts' });
const updateCredentialsLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, message: 'Too many updates' });

// Static files with correct MIME types for fonts
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), { setHeaders: res => res.set('Cache-Control', 'no-cache') }));
app.use('/font', express.static(path.join(__dirname, 'font'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.woff2')) res.setHeader('Content-Type', 'font/woff2');
        if (filepath.endsWith('.woff')) res.setHeader('Content-Type', 'font/woff');
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
app.use('/img', express.static(path.join(__dirname, 'img'), {
    setHeaders: (res) => res.set('Cache-Control', 'public, max-age=31536000, immutable')
}));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', mainRoutes);
app.use('/api/giveaway',authenticateToken, giveawayRoutes);
app.use('/api/schedule', authenticateToken, scheduleRoutes);
app.use('/api/reviews', authenticateToken, reviewRoutes);
app.use('/api/giveaway-content', authenticateToken, giveawayContentRoutes);
app.use('/api/contact', authenticateToken, contactRoutes);
app.use('/api/tracking', authenticateToken, trackingRoutes);
app.use('/api/news', authenticateToken, newsRoutes);

// Upload image
app.post('/api/upload-image', uploadLimiter, async (req, res) => {
    try {
        if (!req.body.image?.startsWith('data:image/')) return res.status(400).json({ message: 'Invalid image' });
        const match = req.body.image.match(/^data:image\/(\w+);base64,/);
        if (!match) return res.status(400).json({ message: 'Invalid base64' });
        const buffer = Buffer.from(req.body.image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        if (!buffer.length) return res.status(400).json({ message: 'Empty image' });

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                { folder: 'streamerpulse', resource_type: 'image', timeout: 30000 },
                (err, res) => err ? reject(err) : resolve(res)
            );
            Readable.from(buffer).pipe(stream);
        });

        res.json({ message: 'Uploaded', url: result.secure_url, public_id: result.public_id });
    } catch (err) {
        const msg = err.http_code === 401 ? 'Unauthorized' : err.http_code === 400 ? 'Bad request' : err.http_code === 420 ? 'Rate limited' : 'Upload failed';
        res.status(err.http_code === 401 ? 401 : 500).json({ message: msg });
    }
});

// 3. Leaderboard with in-memory cache
app.get('/api/leaderboard', async (req, res) => {
    const cached = leaderboardCache.get('data');
    if (cached) return res.json(cached);
    try {
        const result = await fetchAndMerge();
        leaderboardCache.set('data', result);
        res.json(result);
    } catch {
        res.status(500).  json({ timestamp: Date.now(), data: FALLBACK_DATA, error: 'Fetch failed' });
    }
});

// Clear cache
app.post('/api/clear-cache', authenticateToken, (req, res) => {
    leaderboardCache.flushAll();
    res.json({ message: 'Cache cleared' });
});

// BC health
app.get('/api/bc-health', authenticateToken, async (req, res) => {
    try {
        const response = await fetch(BC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
            body: JSON.stringify({
                invitationCode: ACCOUNTS[0].invitationCode,
                accessKey: ACCOUNTS[0].accessKey,
                beginTimestamp: BEGIN_UTC,
                endTimestamp: END_UTC
            })
        });
        const json = await response.json();
        res.json({ status: response.ok ? 'reachable' : `error ${response.status}`, response: json });
    } catch (err) {
        res.status(500).json({ status: 'unreachable', details: err.message });
    }
});

// Login
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Credentials required' });
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid' });
        const token = jwt.sign({ email: user.email, id: user._id, sessionVersion: user.sessionVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Success', token, isDefault: user.isDefault });
    } catch {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Update credentials
app.post('/api/update-credentials', authenticateToken, updateCredentialsLimiter, async (req, res) => {
    try {
        const { oldEmail, currentPassword, newEmail, newPassword } = req.body;
        if (!oldEmail || !currentPassword || !newEmail || !newPassword) return res.status(400).json({ error: 'All fields required' });
        const passwordRegex = /^ (?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: 'Weak password' });
        const user = await User.findOne({ email: oldEmail });
        if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
        if (newEmail !== oldEmail && await User.findOne({ email: newEmail })) return res.status(400).json({ error: 'Email taken' });
        user.email = newEmail;
        user.password = await bcrypt.hash(newPassword, 10);
        user.isDefault = false;
        user.sessionVersion += 1;
        await user.save();
        res.json({ message: 'Updated, log in again' });
    } catch {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Fetch helpers
async function fetchWithRetry(url, options, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function fetchBCGame(account) {
    try {
        const res = await fetchWithRetry(BC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
            body: JSON.stringify({
                invitationCode: account.invitationCode,
                accessKey: account.accessKey,
                beginTimestamp: BEGIN_UTC,
                endTimestamp: END_UTC,
            }),
        });
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}

function formatUsername(name) {
    if (!name || name.length <= 4) return name || 'Un****wn';
    return `${name.slice(0, 2)}*****${name.slice(-2)}`;
}

function getEmbeddedData() {
    try {
        return EMBEDDED_DATA.leaderboard.map(p => ({
            rank: p.rank || null,
            username: p.username,
            totalWager: parseFloat(p.wagered) || 0,
            reward: parseFloat(p.prize) || 0,
            img: BC_LOGO,
        }));
    } catch {
        return [];
    }
}

async function fetchAndMerge() {
    let allResults = [];
    for (const acc of ACCOUNTS) {
        const data = await fetchBCGame(acc);
        allResults = allResults.concat(data.map(p => ({
            username: formatUsername(p.name),
            totalWager: parseFloat(p.wager) || 0,
            reward: 0,
            img: BC_LOGO,
        })));
    }
    if (!allResults.length) allResults = getEmbeddedData();
    if (!allResults.length) allResults = FALLBACK_DATA;

    const merged = {};
    for (const e of allResults) {
        const key = e.username;
        if (!merged[key]) merged[key] = { username: key, totalWager: 0, reward: 0, img: BC_LOGO };
        merged[key].totalWager += e.totalWager;
    }

    let result = Object.values(merged)
        .sort((a, b) => b.totalWager - a.totalWager)
        .map((e, i) => {
            const rank = e.username === 'Un****wn' ? null : i + 1;
            let reward = 0;
            if (rank === 1) reward = 3000;
            else if (rank === 2) reward = 2000;
            else if (rank === 3) reward = 1000;
            else if (rank === 4) reward = 500;
            else if (rank === 5 || rank === 6) reward = 250;
            return { ...e, rank, reward };
        })
        .slice(0, 20);

    if (!result.some(e => e.username === 'Un****wn')) result.push(...FALLBACK_DATA);
    return { data: result, timestamp: Date.now() };
}

// Health & SPA
app.get('/api/', (req, res) => res.json({ message: 'SH4NER Backend running!' }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Not found' });
    if (req.path.startsWith('/admin')) return res.status(404).send('Not found');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => res.status(500).json({ message: 'Server error' }));

// 6. Background worker (non-blocking)
const backgroundWorker = async () => {
    while (true) {
        try {
            await new Promise(r => setTimeout(r, 5 * 60 * 1000));
            if (!leaderboardCache.has('data')) {
                const result = await fetchAndMerge();
                leaderboardCache.set('data', result);
            }
        } catch {}
    }
};

// Start
mongoose.connect(process.env.MONGO_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000
}).then(() => initializeDefaultUser());

backgroundWorker().catch(() => {});

app.listen(PORT, async () => {
    if (!leaderboardCache.has(startupCacheKey)) {
        try {
            const result = await fetchAndMerge();
            leaderboardCache.set('data', result);
            leaderboardCache.set(startupCacheKey, true);
        } catch {}
    }
    console.log(`Server running on port ${PORT}`);
});

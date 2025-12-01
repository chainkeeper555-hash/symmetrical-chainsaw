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
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BC_API_URL = 'https://bc.game/api/agent/open-api/kol/invitees/';
const BC_LOGO = '/img/bc-game-esports-logo-png_seeklogo-619973.png';

const ACCOUNTS = [
    { invitationCode: '2cv50ogdp', accessKey: process.env.BC_ACCESS_KEY_1 || 'iigYk9dcgO2XJZeo' },
    { invitationCode: 'sh4ner',     accessKey: process.env.BC_ACCESS_KEY_2 || 'ZyFuCnq66f3ODBCv' },
];

// DYNAMIC CURRENT MONTH — AUTO UPDATES (December 2025 now)
const now = new Date();
const START_DATE = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
const END_DATE = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);

const BEGIN_UTC = Math.floor(START_DATE.getTime() / 1000);
const END_UTC   = Math.floor(END_DATE.getTime() / 1000);

const CURRENT_PERIOD = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

// Cache state tracking
let lastCacheTime = 0;
let forceFetchOnStartup = true; // Fixed: now properly declared at the top level
let isFetching = false;

// Clear cache file on server startup
try {
    if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
        console.log('Cleared old cache file on server startup');
    }
} catch (err) {
    console.error('Error clearing cache file:', err.message);
}

console.log(`\nLIVE LEADERBOARD — ${CURRENT_PERIOD}`);
console.log(`Period: ${START_DATE.toISOString().slice(0,10)} → ${END_DATE.toISOString().slice(0,10)} (UTC)\n`);

// Fallback data
const FALLBACK_DATA = {
    period: CURRENT_PERIOD,
    timestamp: Date.now(),
    totalPlayers: 0,
    data: [
        { rank: 1, username: "Fetching live data...", wagered: 0, prize: 3000, img: BC_LOGO },
        { rank: 2, username: "Please wait", wagered: 0, prize: 2000, img: BC_LOGO },
        { rank: 3, username: "Loading December leaderboard", wagered: 0, prize: 1000, img: BC_LOGO }
    ]
};

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

async function initializeDefaultUser() {
    try {
        const defaultEmail = 'admin@streamerpulse.com';
        const existingUser = await User.findOne({ email: defaultEmail });
        if (!existingUser) {
            const tempPass = `${uuidv4().slice(0, 12)}!Ab1`;
            const hashed = await bcrypt.hash(tempPass, 10);
            await User.create({ email: defaultEmail, password: hashed, isDefault: true });
            console.log(`\nDEFAULT ADMIN CREATED`);
            console.log(`Email: ${defaultEmail}`);
            console.log(`Password: ${tempPass} (save it — shown once!)\n`);
        }
    } catch (err) {
        console.error('Failed to create default admin:', err.message);
    }
}

// Environment validation
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error('Missing required .env variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Cloudinary config
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Simplified for now — re-enable full CSP if needed
app.use(cors({ origin: ['https://sh4ner.com', process.env.CLIENT_URL].filter(Boolean), credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/font', express.static(path.join(__dirname, 'font')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Rate limiters
const uploadLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5 });

// Routes
app.use('/api', mainRoutes);
app.use('/api/giveaway', authenticateToken, giveawayRoutes);
app.use('/api/schedule', authenticateToken, scheduleRoutes);
app.use('/api/reviews', authenticateToken, reviewRoutes);
app.use('/api/giveaway-content', authenticateToken, giveawayContentRoutes);
app.use('/api/contact', authenticateToken, contactRoutes);
app.use('/api/tracking', authenticateToken, trackingRoutes);
app.use('/api/news', authenticateToken, newsRoutes);

// Image Upload (unchanged)
app.post('/api/upload-image', uploadLimiter, async (req, res) => {
    // ... your existing upload code ...
});

// Retry fetch helper
async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

// Fetch one account with pagination
async function fetchAccount(account) {
    let all = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const payload = {
            invitationCode: account.invitationCode,
            accessKey: account.accessKey,
            beginTimestamp: BEGIN_UTC,
            endTimestamp: END_UTC,
            pageNo: page,
            pageSize: 500
        };

        try {
            const res = await fetchWithRetry(BC_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Origin': 'https://bc.game' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.code !== 0 || !Array.isArray(json.data)) {
                console.log(`API error [${account.invitationCode} p${page}]:`, json.msg || json.code);
                break;
            }

            if (json.data.length === 0) break;

            json.data.forEach(p => {
                const wager = parseFloat(p.totalWager || p.wager || 0);
                const username = (p.name || p.username || "Hidden").trim();
                if (wager > 0 && username && username !== "Hidden") {
                    all.push({ username, wager });
                }
            });

            hasMore = json.data.length === 500;
            page++;

        } catch (err) {
            console.error(`Fetch failed for ${account.invitationCode}:`, err.message);
            break;
        }
    }
    return all;
}

// Main leaderboard update function
async function updateLeaderboard() {
    if (isFetching) return;
    isFetching = true;

    console.log(`\nUpdating ${CURRENT_PERIOD} leaderboard...`);

    let allPlayers = [];

    for (const acc of ACCOUNTS) {
        console.log(`Fetching from ${acc.invitationCode}...`);
        const data = await fetchAccount(acc);
        console.log(`→ ${data.length} players`);
        allPlayers = allPlayers.concat(data);
    }

    const merged = {};
    allPlayers.forEach(p => {
        merged[p.username] = (merged[p.username] || 0) + p.wager;
    });

    const leaderboard = Object.keys(merged)
        .map(username => ({ username, totalWager: merged[username] }))
        .sort((a, b) => b.totalWager - a.totalWager)
        .map((item, i) => {
            const rank = i + 1;
            let prize = 0;
            if (rank === 1) prize = 3000;
            else if (rank === 2) prize = 2000;
            else if (rank === 3) prize = 1000;
            else if (rank === 4) prize = 500;
            else if (rank <= 6) prize = 250;

            return {
                rank,
                username: item.username,
                wagered: Number(item.totalWager.toFixed(2)),
                prize,
                img: BC_LOGO
            };
        });

    const result = {
        period: CURRENT_PERIOD,
        timestamp: Date.now(),
        totalPlayers: leaderboard.length,
        data: leaderboard.length > 0 ? leaderboard : FALLBACK_DATA.data
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(result, null, 2));
    lastCacheTime = Date.now();

    console.log(`LEADERBOARD UPDATED — ${CURRENT_PERIOD}`);
    console.log(`Players: ${result.totalPlayers} | #1: ${leaderboard[0]?.username || 'N/A'} ($${leaderboard[0]?.wagered?.toLocaleString() || 0})`);
    console.log(`Cache saved to ${CACHE_FILE}\n`);

    isFetching = false;
    return result;
}

// Leaderboard endpoint — with proper forceFetchOnStartup handling
app.get('/api/leaderboard', async (req, res) => {
    try {
        const cacheAge = Date.now() - lastCacheTime;

        if (!fs.existsSync(CACHE_FILE) || cacheAge > CACHE_TTL || forceFetchOnStartup) {
            const data = await updateLeaderboard();
            forceFetchOnStartup = false; // Reset after first fetch
            return res.json(data);
        }

        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        res.json(cached);
    } catch (err) {
        console.error('Leaderboard endpoint error:', err.message);
        res.status(500).json(FALLBACK_DATA);
    }
});

// Clear cache endpoint
app.post('/api/clear-cache', authenticateToken, (req, res) => {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    lastCacheTime = 0;
    forceFetchOnStartup = true;
    res.json({ message: 'Cache cleared — next request will fetch fresh data' });
});

// Health check
app.get('/api/bc-health', authenticateToken, async (req, res) => {
    try {
        const payload = { invitationCode: ACCOUNTS[0].invitationCode, accessKey: ACCOUNTS[0].accessKey, beginTimestamp: BEGIN_UTC, endTimestamp: END_UTC };
        const response = await fetch(BC_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await response.json();
        res.json({ ok: response.ok, response: json });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login & Update Credentials (unchanged)

// Auto-refresh every 5 minutes
setInterval(() => {
    updateLeaderboard().catch(err => console.error('Scheduled fetch failed:', err.message));
}, 5 * 60 * 1000);

// Initial fetch after 3 seconds
setTimeout(() => {
    updateLeaderboard().then(() => console.log('Initial leaderboard fetch completed'));
}, 3000);

// MongoDB & Server Start
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected');
        await initializeDefaultUser();
        app.listen(PORT, () => {
            console.log(`\nSERVER LIVE → http://localhost:${PORT}`);
            console.log(`Leaderboard → http://localhost:${PORT}/api/leaderboard (Live December 2025)`);
            console.log(`Admin → http://localhost:${PORT}/admin\n`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });

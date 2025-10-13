const express = require('express');
const router = express.Router();

router.post('/proxy/bcgame', async (req, res) => {
    try {
        // Validate request body
        if (!req.body.invitationCode || !req.body.accessKey || !req.body.beginTimestamp || !req.body.endTimestamp) {
            console.error('Missing required fields:', {
                body: req.body,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        // Log the request being sent to bc.game
        console.log('Sending request to bc.game:', {
            url: 'https://bc.game/api/agent/open-api/kol/invitees/',
            body: req.body,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });

        const response = await fetch('https://bc.game/api/agent/open-api/kol/invitees/', {
            method: 'POST',
            headers: {
                'Origin': 'https://bc.game',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.text();
        console.log('bc.game API response:', {
            status: response.status,
            body: data,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });

        let jsonData;
        try {
            jsonData = JSON.parse(data);
            // Ensure data.data is an array; if not, return an empty array
            if (!jsonData.data || !Array.isArray(jsonData.data)) {
                console.warn('bc.game API returned non-array data:', jsonData);
                jsonData = { data: [] };
            }
        } catch (e) {
            console.error('Failed to parse bc.game response:', {
                response: data,
                error: e.message,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            return res.status(response.status).json({ message: 'Invalid response from bc.game', details: data });
        }

        res.status(response.status).json(jsonData);
    } catch (error) {
        console.error('Proxy error:', {
            message: error.message,
            stack: error.stack,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ message: 'Failed to fetch leaderboard data from bc.game', details: error.message });
    }
});

module.exports = router;
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

// 1. 取得 TDX Access Token (含快取)
let cachedToken = null;
let tokenExpiry = 0;

async function getTDXToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const authUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.TDX_CLIENT_ID);
    params.append('client_secret', process.env.TDX_CLIENT_SECRET);
    const response = await axios.post(authUrl, params, { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
    return cachedToken;
}

// 2. 取得縣市公車路線列表
app.get('/api/bus/routes', async (req, res) => {
    try {
        const { city } = req.query;
        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/Route/City/${city}?$format=JSON`;
        const response = await axios.get(tdxUrl, { headers: { Authorization: `Bearer ${token}` } });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: '失敗' }); }
});

// 3. 取得指定路線的去返程站序
app.get('/api/bus/stops', async (req, res) => {
    try {
        const { city, routeName } = req.query;
        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/StopOfRoute/City/${city}?$format=JSON`;
        const response = await axios.get(tdxUrl, { headers: { Authorization: `Bearer ${token}` } });
        const targetRoutes = response.data.filter(r => r.RouteName.Zh_tw === routeName);
        res.json(targetRoutes);
    } catch (error) { res.status(500).json({ error: '失敗' }); }
});

// 4. 取得指定路線的即時到站預估
app.get('/api/bus/arrival', async (req, res) => {
    try {
        const { city, routeName } = req.query;
        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/EstimatedTimeOfArrival/City/${city}/${routeName}?$format=JSON`;
        const response = await axios.get(tdxUrl, { headers: { Authorization: `Bearer ${token}` } });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: '失敗' }); }
});

// 5. 查詢附近站牌
app.get('/api/bus/nearby', async (req, res) => {
    try {
        const { city, lat, lon } = req.query;
        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/Stop/City/${city}?$spatialFilter=nearby(${lat},${lon},500)&$format=JSON`;
        const response = await axios.get(tdxUrl, { headers: { Authorization: `Bearer ${token}` } });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: '失敗' }); }
});

// 6. 🌟 新增：查詢經過特定站牌的所有路線 (解決找不到公車的問題)
app.get('/api/bus/routesByStop', async (req, res) => {
    try {
        const { city, stopUID } = req.query;
        const token = await getTDXToken();
        // 使用 TDX API 查詢行經該站牌的路線
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/Route/City/${city}/Stop/${stopUID}?$format=JSON`;
        const response = await axios.get(tdxUrl, { headers: { Authorization: `Bearer ${token}` } });
        res.json(response.data);
    } catch (error) {
        console.error('查詢站牌路線失敗:', error.message);
        res.status(500).json({ error: '失敗', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`伺服器運行中...`); });
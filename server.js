const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

// ==========================================
// 1. 取得 TDX Access Token (含快取)
// ==========================================
let cachedToken = null;
let tokenExpiry = 0;

async function getTDXToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    const authUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.TDX_CLIENT_ID);
    params.append('client_secret', process.env.TDX_CLIENT_SECRET);

    const response = await axios.post(authUrl, params, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
    return cachedToken;
}

// ==========================================
// 2. 取得縣市公車路線列表
// ==========================================
app.get('/api/bus/routes', async (req, res) => {
    try {
        const { city } = req.query;
        if (!city) return res.status(400).json({ error: '缺少 city 參數' });

        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/Route/City/${city}?$format=JSON`;

        const response = await axios.get(tdxUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json(response.data);
    } catch (error) {
        console.error('取得路線失敗:', error.message);
        res.status(500).json({ error: '取得路線失敗', details: error.message });
    }
});

// ==========================================
// 3. 取得指定路線的去返程站序
// ==========================================
app.get('/api/bus/stops', async (req, res) => {
    try {
        const { city, routeName } = req.query;
        if (!city || !routeName) return res.status(400).json({ error: '缺少參數' });

        const token = await getTDXToken();
        // 這裡使用 StopOfRoute 查詢該縣市所有路線的站序
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/StopOfRoute/City/${city}?$format=JSON`;

        const response = await axios.get(tdxUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        // 過濾出使用者選擇的路線 (支援去返程 Direction 0 與 1)
        const allRoutes = response.data;
        const targetRoutes = allRoutes.filter(r => r.RouteName.Zh_tw === routeName);
        
        if (targetRoutes.length === 0) {
            return res.status(404).json({ error: '找不到該路線的站序資料' });
        }
        
        res.json(targetRoutes);
    } catch (error) {
        console.error('取得站序失敗:', error.message);
        res.status(500).json({ error: '取得站序失敗', details: error.message });
    }
});

// ==========================================
// 4. 取得指定路線的即時到站預估與車牌
// ==========================================
app.get('/api/bus/arrival', async (req, res) => {
    try {
        const { city, routeName } = req.query;
        if (!city || !routeName) return res.status(400).json({ error: '缺少參數' });

        const token = await getTDXToken();
        const tdxUrl = `https://tdx.transportdata.tw/api/basic/v2/Bus/EstimatedTimeOfArrival/City/${city}/${routeName}?$format=JSON`;

        const response = await axios.get(tdxUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json(response.data);
    } catch (error) {
        console.error('取得即時到站失敗:', error.message);
        res.status(500).json({ error: '取得即時到站失敗', details: error.message });
    }
});

// ==========================================
// 5. 啟動伺服器
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`公車後端伺服器正在 http://localhost:${PORT} 運行中...`);
});
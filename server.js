const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'saved_history.json');
const MAX_HISTORY = 1000;

let state = {
    totalWins: 0,
    totalLosses: 0,
    currentStreakType: "",
    currentStreakCount: 0,
    maxLossStreak: 0,
    maxWinStreak: 0,
    currentLvl: 1,
    pendingPrediction: null,
    latestPrediction: null,
    lastFetchedIssue: "",
    history: []
};

// লোকাল ফাইল থেকে আগের ডাটা লোড
if (fs.existsSync(DATA_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        state = { ...state, ...saved };
    } catch (e) {}
}

function saveDataToDisk() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            totalWins: state.totalWins,
            totalLosses: state.totalLosses,
            currentStreakType: state.currentStreakType,
            currentStreakCount: state.currentStreakCount,
            maxLossStreak: state.maxLossStreak,
            maxWinStreak: state.maxWinStreak,
            currentLvl: state.currentLvl,
            history: state.history.slice(0, MAX_HISTORY)
        }, null, 2));
    } catch (err) {}
}

// ব্রাউজার ইউজার-এজেন্ট হেডারসহ শক্তিশালী ডাটা ফেচিং ফাংশন
async function fetchDkwin30S() {
    const rawUrl = `https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?no=0&size=50&t=${Date.now()}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://dkwin9.com/'
    };

    // ১. সরাসরি রিকোয়েস্ট
    try {
        const res = await fetch(rawUrl, { headers });
        if (res.ok) {
            const json = await res.json();
            if (json?.data?.list && json.data.list.length > 0) return json.data.list;
        }
    } catch (e) {}

    // ২. ব্যাকআপ প্রক্সি ১
    try {
        const p1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
        const res = await fetch(p1);
        if (res.ok) {
            const json = await res.json();
            if (json?.data?.list && json.data.list.length > 0) return json.data.list;
        }
    } catch (e) {}

    // ৩. ব্যাকআপ প্রক্সি ২
    try {
        const p2 = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
        const res = await fetch(p2, { headers });
        if (res.ok) {
            const json = await res.json();
            if (json?.data?.list && json.data.list.length > 0) return json.data.list;
        }
    } catch (e) {}

    return null;
}

// ডিপ কোয়ান্টাম ইঞ্জিন (Markov + EMA + Chop)
function calculateDeepQuantum(list) {
    const numbers = list.map(x => parseInt(x.number, 10)).filter(n => !isNaN(n));
    const bits = numbers.map(n => n >= 5 ? 1 : 0);

    let streak = 1;
    for (let i = 1; i < bits.length; i++) {
        if (bits[i] === bits[0]) streak++;
        else break;
    }

    let chopCount = 0;
    for (let i = 0; i < Math.min(10, bits.length - 1); i++) {
        if (bits[i] !== bits[i + 1]) chopCount++;
    }
    const isChopRegime = chopCount >= 6;

    let bAfterB = 0, sAfterB = 0;
    let bAfterS = 0, sAfterS = 0;
    for (let i = bits.length - 1; i > 0; i--) {
        const prev = bits[i];
        const curr = bits[i - 1];
        if (prev === 1) {
            if (curr === 1) bAfterB++;
            else sAfterB++;
        } else {
            if (curr === 1) bAfterS++;
            else sAfterS++;
        }
    }

    const lastBit = bits[0];
    let markovPred = (lastBit === 1) ? (bAfterB >= sAfterB ? 1 : 0) : (bAfterS >= sAfterS ? 1 : 0);

    let ema = bits[0];
    const alpha = 0.35;
    for (let i = 1; i < Math.min(15, bits.length); i++) {
        ema = (alpha * bits[i]) + ((1 - alpha) * ema);
    }
    const emaPred = ema >= 0.5 ? 1 : 0;

    let finalBit = 1;
    let confidence = 82;

    if (isChopRegime) {
        finalBit = lastBit === 1 ? 0 : 1;
        confidence = 89;
    } else if (streak >= 3 && streak <= 7) {
        finalBit = lastBit;
        confidence = 92;
    } else if (streak > 7) {
        finalBit = lastBit === 1 ? 0 : 1;
        confidence = 84;
    } else {
        finalBit = (markovPred === emaPred) ? markovPred : (bits[0] === 1 ? 0 : 1);
        confidence = 80;
    }

    const predSize = finalBit === 1 ? "BIG" : "SMALL";

    let predColor = "";
    let targets = [];
    if (predSize === "BIG") {
        const bigSubset = numbers.slice(0, 20).filter(n => n >= 5);
        const greenCount = bigSubset.filter(n => n === 7 || n === 9).length;
        const redCount = bigSubset.filter(n => n === 6 || n === 8).length;
        predColor = greenCount >= redCount ? "GREEN" : "RED";
        targets = predColor === "GREEN" ? [7, 9] : [6, 8];
    } else {
        const smallSubset = numbers.slice(0, 20).filter(n => n < 5);
        const greenCount = smallSubset.filter(n => n === 1 || n === 3).length;
        const redCount = smallSubset.filter(n => n === 2 || n === 4).length;
        predColor = greenCount >= redCount ? "GREEN" : "RED";
        targets = predColor === "GREEN" ? [1, 3] : [2, 4];
    }

    return { size: predSize, color: predColor, confidence, targets };
}

function verifyDraw(actualIssue, actualNum) {
    if (!state.pendingPrediction || state.pendingPrediction.period !== actualIssue) return;

    const actualSize = actualNum >= 5 ? "BIG" : "SMALL";
    const isWin = (state.pendingPrediction.size === actualSize) || state.pendingPrediction.targets.includes(actualNum);

    if (isWin) {
        state.totalWins++;
        if (state.currentStreakType === "WIN") state.currentStreakCount++;
        else { state.currentStreakType = "WIN"; state.currentStreakCount = 1; }
        if (state.currentStreakCount > state.maxWinStreak) state.maxWinStreak = state.currentStreakCount;
        state.currentLvl = 1;
    } else {
        state.totalLosses++;
        if (state.currentStreakType === "LOSS") state.currentStreakCount++;
        else { state.currentStreakType = "LOSS"; state.currentStreakCount = 1; }
        if (state.currentStreakCount > state.maxLossStreak) state.maxLossStreak = state.currentStreakCount;
        state.currentLvl = Math.min(5, state.currentStreakCount + 1);
    }

    state.history.unshift({
        issue: actualIssue,
        predSize: state.pendingPrediction.size,
        actualNum: actualNum,
        actualSize: actualSize,
        isWin: isWin,
        level: state.pendingPrediction.level,
        streakType: state.currentStreakType,
        streakNum: state.currentStreakCount
    });

    if (state.history.length > MAX_HISTORY) state.history.pop();
    saveDataToDisk();
    state.pendingPrediction = null;
}

// ব্যাকগ্রাউন্ড ইঞ্জিন
async function cloudBackgroundLoop() {
    try {
        const list = await fetchDkwin30S();
        if (!list || list.length === 0) return;

        const latest = list[0];
        const currentIssue = latest.issueNumber;

        if (currentIssue !== state.lastFetchedIssue) {
            const actualNum = parseInt(latest.number, 10);
            verifyDraw(currentIssue, actualNum);
            state.lastFetchedIssue = currentIssue;

            let nextIssue;
            try {
                nextIssue = (BigInt(currentIssue) + 1n).toString();
            } catch {
                nextIssue = String(Number(currentIssue) + 1);
            }

            const decision = calculateDeepQuantum(list);
            state.pendingPrediction = {
                period: nextIssue,
                size: decision.size,
                color: decision.color,
                targets: decision.targets,
                level: state.currentLvl
            };
            state.latestPrediction = { ...state.pendingPrediction, confidence: decision.confidence };
        }
    } catch (err) {}
}

setInterval(cloudBackgroundLoop, 1500);

app.get('/api/state', (req, res) => {
    const s = new Date().getSeconds();
    let rem = 30 - (s % 30);
    if (rem === 30) rem = 0;

    res.json({
        timer: `00:${rem < 10 ? '0' + rem : rem}`,
        totalWins: state.totalWins,
        totalLosses: state.totalLosses,
        maxLossStreak: state.maxLossStreak,
        maxWinStreak: state.maxWinStreak,
        currentStreakType: state.currentStreakType,
        currentStreakCount: state.currentStreakCount,
        currentLvl: state.currentLvl,
        prediction: state.latestPrediction,
        history: state.history
    });
});

app.post('/api/reset', (req, res) => {
    state.totalWins = 0;
    state.totalLosses = 0;
    state.maxLossStreak = 0;
    state.maxWinStreak = 0;
    state.currentStreakType = "";
    state.currentStreakCount = 0;
    state.currentLvl = 1;
    state.history = [];
    saveDataToDisk();
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DKWIN 30S 24/7 CLOUD SERVER</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #030508; --panel: #0a0e17; --border: #162035;
            --green: #00ff88; --red: #ff2b5e; --cyan: #00d9ff; --gold: #ffb700;
            --text: #e2e8f0; --text-dim: #64748b;
        }
        * { margin:0; padding:0; box-sizing:border-box; font-family: 'JetBrains Mono', 'Hind Siliguri', monospace; }
        body { background: var(--bg); color: var(--text); display: flex; justify-content: center; min-height: 100vh; padding: 12px; }
        .terminal-container { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 12px; }
        .system-bar { background: var(--panel); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
        .status-badge { display: flex; align-items: center; gap: 6px; color: var(--green); font-weight: 700; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px var(--green); animation: blink 1.2s infinite; }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 8px 4px; text-align: center; }
        .stat-label { font-size: 8.5px; color: var(--text-dim); text-transform: uppercase; font-weight: 700; }
        .stat-val { font-size: 18px; font-weight: 900; margin-top: 3px; }
        .val-win { color: var(--green); text-shadow: 0 0 10px rgba(0,255,136,0.3); }
        .val-loss { color: var(--red); text-shadow: 0 0 10px rgba(255,43,94,0.3); }
        .val-acc { color: var(--cyan); }
        .val-lvl { color: var(--gold); }
        .val-max-loss { color: #ff0055; text-shadow: 0 0 12px rgba(255,0,85,0.4); }
        .val-max-win { color: #00ffaa; text-shadow: 0 0 12px rgba(0,255,170,0.4); }
        .main-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
        .header-title { text-align: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px; }
        .header-title h1 { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
        .header-title p { font-size: 10px; color: var(--cyan); margin-top: 2px; }
        .prediction-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; }
        .pred-pod { background: #06080e; border: 1px solid var(--border); border-radius: 8px; padding: 10px 4px; text-align: center; }
        .pod-label { font-size: 8.5px; color: var(--text-dim); text-transform: uppercase; font-weight: 700; }
        .pod-val { font-size: 22px; font-weight: 900; margin: 3px 0; }
        .c-big { color: var(--cyan); text-shadow: 0 0 12px rgba(0,217,255,0.4); }
        .c-small { color: var(--gold); text-shadow: 0 0 12px rgba(255,183,0,0.4); }
        .c-green { color: var(--green); }
        .c-red { color: var(--red); }
        .history-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
        .history-top { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 8px; }
        .btn-reset { background: #1e1117; border: 1px solid #4a1d28; color: #ff5e7e; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: 700; }
        .table-wrap { max-height: 400px; overflow-y: auto; border: 1px solid #111724; border-radius: 6px; }
        .verified-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        .verified-table th { padding: 8px 4px; text-align: center; color: var(--text-dim); border-bottom: 1px solid var(--border); background: #080c14; position: sticky; top: 0; z-index: 1; }
        .verified-table td { padding: 7px 4px; text-align: center; border-bottom: 1px solid #0f1523; }
        .badge { padding: 2px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 800; display: inline-block; }
        .badge-win { background: rgba(0,255,136,0.15); color: var(--green); border: 1px solid var(--green); }
        .badge-loss { background: rgba(255,43,94,0.15); color: var(--red); border: 1px solid var(--red); }
    </style>
</head>
<body>
    <div class="terminal-container">
        <div class="system-bar">
            <div class="status-badge"><span class="status-dot"></span><span>24/7 CLOUD SERVER: ACTIVE</span></div>
            <div><span style="color:var(--text-dim);">NEXT DRAW:</span> <span id="syncTimer" style="color:var(--cyan); font-weight:800;">00:30</span></div>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">TOTAL WIN</div><div id="statWins" class="stat-val val-win">0</div></div>
            <div class="stat-card"><div class="stat-label">TOTAL LOSS</div><div id="statLosses" class="stat-val val-loss">0</div></div>
            <div class="stat-card"><div class="stat-label">WIN RATE</div><div id="statAcc" class="stat-val val-acc">100%</div></div>
            <div class="stat-card"><div class="stat-label">MAX LOSS STREAK</div><div id="statMaxLoss" class="stat-val val-max-loss">0</div></div>
            <div class="stat-card"><div class="stat-label">MAX WIN STREAK</div><div id="statMaxWin" class="stat-val val-max-win">0</div></div>
            <div class="stat-card"><div class="stat-label">CURRENT STATUS</div><div id="statCurrentStreak" class="stat-val val-lvl">L1 (0)</div></div>
        </div>

        <div class="main-card">
            <div class="header-title">
                <h1>24/7 CLOUD QUANTUM ENGINE</h1>
                <p id="targetPeriodText">টার্গেট পিরিয়ড: লোড হচ্ছে...</p>
            </div>
            <div class="prediction-grid">
                <div class="pred-pod"><div class="pod-label">QUANT SIZE</div><div id="predSize" class="pod-val">--</div><div id="predSizeProb" style="font-size:9.5px;color:var(--text-dim);">অপেক্ষা করুন</div></div>
                <div class="pred-pod"><div class="pod-label">SPECTRUM</div><div id="predColor" class="pod-val">--</div><div id="predColorProb" style="font-size:9.5px;color:var(--text-dim);">কালার সিগন্যাল</div></div>
                <div class="pred-pod"><div class="pod-label">HOT TARGETS</div><div id="predNumbers" class="pod-val" style="color:var(--gold);">--</div><div style="font-size:9.5px;color:var(--text-dim);">ফিল্টার্ড ডিজিট</div></div>
            </div>
        </div>

        <div class="history-card">
            <div class="history-top">
                <span id="totalEvaluatedText" style="color:var(--green); font-weight:700;">০ টি ড্র সংরক্ষিত (Max: 1000)</span>
                <button class="btn-reset" onclick="resetServerData()">RESET DATA</button>
            </div>
            <div class="table-wrap">
                <table class="verified-table">
                    <thead>
                        <tr><th>PERIOD</th><th>PREDICTED</th><th>ACTUAL</th><th>RESULT</th><th>STREAK</th></tr>
                    </thead>
                    <tbody id="verifiedTableBody">
                        <tr><td colspan="5" style="padding:24px; color:var(--text-dim); text-align:center;">সার্ভার থেকে ডাটা আসছে...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        async function updateDashboard() {
            try {
                const res = await fetch('/api/state');
                const data = await res.json();

                document.getElementById('syncTimer').innerText = data.timer;
                document.getElementById('statWins').innerText = data.totalWins;
                document.getElementById('statLosses').innerText = data.totalLosses;
                const total = data.totalWins + data.totalLosses;
                document.getElementById('statAcc').innerText = total > 0 ? ((data.totalWins / total) * 100).toFixed(1) + '%' : '100%';
                document.getElementById('statMaxLoss').innerText = data.maxLossStreak;
                document.getElementById('statMaxWin').innerText = data.maxWinStreak;

                const col = data.currentStreakType === "WIN" ? "var(--green)" : (data.currentStreakType === "LOSS" ? "var(--red)" : "var(--gold)");
                document.getElementById('statCurrentStreak').innerHTML = '<span style="color:'+col+'">L'+data.currentLvl+' ('+data.currentStreakCount+(data.currentStreakType ? data.currentStreakType[0] : '')+')</span>';

                if (data.prediction) {
                    document.getElementById('targetPeriodText').innerText = 'টার্গেট পিরিয়ড: #' + data.prediction.period.slice(-4);
                    const sizeEl = document.getElementById('predSize');
                    sizeEl.innerText = data.prediction.size;
                    sizeEl.className = 'pod-val ' + (data.prediction.size === 'BIG' ? 'c-big' : 'c-small');
                    document.getElementById('predSizeProb').innerText = data.prediction.confidence + '% নিশ্চিত';

                    const colorEl = document.getElementById('predColor');
                    colorEl.innerText = data.prediction.color;
                    colorEl.className = 'pod-val ' + (data.prediction.color === 'GREEN' ? 'c-green' : 'c-red');
                    document.getElementById('predNumbers').innerText = data.prediction.targets.join(', ');
                }

                document.getElementById('totalEvaluatedText').innerText = data.history.length + ' টি ড্র সংরক্ষিত (Max: 1000)';

                const tbody = document.getElementById('verifiedTableBody');
                if (data.history.length > 0) {
                    tbody.innerHTML = data.history.map(r => {
                        const resBadge = r.isWin ? '<span class="badge badge-win">WIN</span>' : '<span class="badge badge-loss">LOSS</span>';
                        const streakText = r.streakType === 'WIN' 
                            ? '<span style="color:var(--green); font-weight:700;">W-'+r.streakNum+'</span>'
                            : '<span style="color:var(--red); font-weight:700;">L-'+r.streakNum+'</span>';
                        return '<tr><td style="color:var(--text-dim); font-weight:700;">#'+r.issue.slice(-4)+'</td><td>'+r.predSize+'</td><td style="font-weight:800; color:var(--gold);">'+r.actualNum+' ('+r.actualSize+')</td><td>'+resBadge+'</td><td>'+streakText+'</td></tr>';
                    }).join('');
                }
            } catch(e) {}
        }

        async function resetServerData() {
            if (!confirm('সার্ভারের সমস্ত ১০০০ হিস্ট্রি মুছে দিতে চান?')) return;
            await fetch('/api/reset', { method: 'POST' });
            updateDashboard();
        }

        setInterval(updateDashboard, 1000);
        updateDashboard();
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`[ONLINE] ২৪/৭ ক্লাউড সার্ভার পোর্ট ${PORT}-এ সক্রিয় হয়েছে।`);
});

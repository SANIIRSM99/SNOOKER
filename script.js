const balls = [
    { name: 'Red', color: 'red', points: 1 },
    { name: 'Yellow', color: 'yellow', points: 2 },
    { name: 'Green', color: 'green', points: 3 },
    { name: 'Brown', color: 'brown', points: 4 },
    { name: 'Blue', color: 'blue', points: 5 },
    { name: 'Pink', color: 'pink', points: 6 },
    { name: 'Black', color: 'black', points: 7 },
    { name: 'Stager', color: 'grey', points: 4 }
];

let redBallsRemaining = 10;
let isRedPhase = true;
let expectingColor = false;
let currentColorIndex = 0;
let currentPlayer = 1;
let tableNumber = 1;
let totalGames = 0;
let player1Wins = 0;
let player2Wins = 0;
let totalMatchTime = 0;
let gameStartTime = 0;
let timerInterval = null;
let player1 = { name: '', score: 0, active: true, pocketCounts: {}, foulCounts: {}, p2FoulCount: 0, dp: '', lastBallColor: null };
let player2 = { name: '', score: 0, active: false, pocketCounts: {}, foulCounts: {}, p1FoulCount: 0, dp: '', lastBallColor: null };
let pendingFoulDecision = false;
let foulPlayer = null;
let gameRecords = JSON.parse(localStorage.getItem('snookerGameRecords')) || {};
let initialRedCount = 10;
let post27FoulCount = 0;
let ballPocketDetails = [];
let bestOf = 3;
let sessionGameCount = 0;
let sessionId = null;
let isFinalGame = false;
let confettiInterval = null;
let gameType = 'snooker';
let multiPlayers = [];
let multiCurrentIndex = 0;
let multiTargetScore = 100;
let multiTossAssignments = [];
let multiGameEnded = false;
let multiFinishedPlayers = [];
let syncTimer = null;

const tasBalls = [
    'White Ball',
    'Yellow',
    'Green',
    'Brown',
    'Blue',
    'Pink',
    'Black',
    'Green + Blue Mix',
    'Brown + Blue Mix',
    'Red'
];

const multiGameBalls = [
    { name: 'Red', color: 'red', points: 10 },
    { name: 'Yellow', color: 'yellow', points: 2 },
    { name: 'Green', color: 'green', points: 3 },
    { name: 'Brown', color: 'brown', points: 4 },
    { name: 'Blue', color: 'blue', points: 5 },
    { name: 'Pink', color: 'pink', points: 6 },
    { name: 'Black', color: 'black', points: 7 },
    { name: 'White Foul', color: 'grey', points: 4 }
];

let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playTone(frequency, duration = 0.12, type = 'sine', gainValue = 0.08, delay = 0) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = gainValue;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + delay;
        osc.start(start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.stop(start + duration);
    } catch (err) {
        console.error('Sound error:', err);
    }
}

function playGameSound(type) {
    if (type === 'P') {
        playTone(660, 0.09, 'triangle', 0.07);
        playTone(880, 0.12, 'triangle', 0.06, 0.08);
    } else if (type === 'F') {
        playTone(220, 0.18, 'sawtooth', 0.08);
        playTone(150, 0.18, 'sawtooth', 0.07, 0.12);
    } else if (type === 'WIN') {
        [520, 660, 780, 990].forEach((freq, index) => playTone(freq, 0.09, 'square', 0.055, index * 0.09));
        [760, 760, 760].forEach((freq, index) => playTone(freq, 0.055, 'triangle', 0.045, 0.45 + index * 0.07));
    }
}

// Initialize pocket and foul counts
function initializeCounts(player) {
    player.pocketCounts = {};
    player.foulCounts = {};
    balls.forEach(ball => {
        player.pocketCounts[ball.name] = 0;
        player.foulCounts[ball.name] = 0;
    });
    player.p2FoulCount = 0;
    player.p1FoulCount = 0;
    player.lastBallColor = null;
}

function isMultiGameMode() {
    const selected = document.getElementById('red-count')?.value;
    return selected === 'century' || selected === 'fifty';
}

function getGameLabel() {
    if (gameType === 'century') return 'Century';
    if (gameType === 'fifty') return 'Fifty';
    return `${initialRedCount} Reds`;
}

function renderMultiPlayerInputs() {
    const count = parseInt(document.getElementById('multi-player-count')?.value || '2');
    const container = document.getElementById('multi-player-inputs');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `multi-player-name-${i}`;
        input.placeholder = `Player ${i} Name`;
        container.appendChild(input);
    }
}

function toggleGameModeInputs() {
    const multiOptions = document.getElementById('multi-game-options');
    const p1 = document.getElementById('player1-name');
    const p2 = document.getElementById('player2-name');
    const p1dp = document.getElementById('player1-dp');
    const p2dp = document.getElementById('player2-dp');
    const bestOfSelect = document.getElementById('best-of');
    const multi = isMultiGameMode();

    if (multiOptions) multiOptions.classList.toggle('hidden', !multi);
    [p1, p2, p1dp, p2dp, bestOfSelect].forEach(el => {
        if (el) el.classList.toggle('hidden', multi);
    });
    if (multi) renderMultiPlayerInputs();
}

function sanitizeFirebaseKey(name) {
    return (name || 'Unknown').replace(/[.#$[\]]/g, '_');
}

function getCurrentGamePayload() {
    if (gameType === 'century' || gameType === 'fifty') {
        const current = multiPlayers[multiCurrentIndex] || {};
        return {
            gameType,
            gameLabel: getGameLabel(),
            playerCount: multiPlayers.length,
            targetScore: multiTargetScore,
            activePlayers: multiPlayers.filter(p => !p.qualified).length,
            qualifiedPlayers: multiFinishedPlayers.map(p => p.name),
            players: multiPlayers.map(p => ({ name: p.name, score: p.score, wins: p.wins || 0, qualified: !!p.qualified })),
            currentPlayer: current.name || '',
            currentPlayerIndex: multiCurrentIndex,
            tossAssignments: multiTossAssignments,
            startTime: gameStartTime ? new Date(gameStartTime).toISOString() : new Date().toISOString(),
            totalMatchTime,
            ballPocketDetails: [...ballPocketDetails],
            lastUpdate: Date.now()
        };
    }

    return {
        sessionId: sessionId,
        gameType: 'snooker',
        gameLabel: getGameLabel(),
        playerCount: 2,
        player1: { name: player1.name, score: player1.score, wins: player1Wins, dp: player1.dp || '' },
        player2: { name: player2.name, score: player2.score, wins: player2Wins, dp: player2.dp || '' },
        currentPlayer: player1.active ? player1.name : player2.name,
        redsRemaining: Math.max(0, redBallsRemaining),
        isRedPhase: isRedPhase,
        currentColorIndex: currentColorIndex,
        startTime: gameStartTime ? new Date(gameStartTime).toISOString() : new Date().toISOString(),
        totalMatchTime,
        redCount: initialRedCount,
        ballPocketDetails: [...ballPocketDetails],
        bestOf: bestOf,
        isFinal: isFinalGame,
        lastUpdate: Date.now()
    };
}

function scheduleFirebaseSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncTimer = null;
        syncGameStateToFirebase();
    }, 250);
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getPopupColor(color) {
    const colors = {
        red: '#e53e3e',
        yellow: '#ecc94b',
        green: '#48bb78',
        brown: '#8b5a2b',
        blue: '#4299e1',
        pink: '#ed64a6',
        black: '#111111',
        grey: '#808080'
    };
    return colors[color] || color || '#ffd700';
}

function showPointPopup(points, ballColor = '#ffd700', ballName = '') {
    if (!points && points !== 0) return;
    const popup = document.createElement('div');
    popup.className = 'point-popup';
    popup.style.setProperty('--popup-color', getPopupColor(ballColor));
    popup.style.setProperty('--popup-text', ballColor === 'black' ? '#ffffff' : '#111111');
    popup.innerHTML = `<span class="popup-ball-name">${ballName || 'Points'}</span><span class="popup-points">${points > 0 ? '+' + points : points}</span>`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 950);
}

function notify(message, type = 'success') {
    let layer = document.getElementById('notify-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'notify-layer';
        document.body.appendChild(layer);
    }
    const toast = document.createElement('div');
    toast.className = `notify-toast ${type}`;
    toast.textContent = message;
    layer.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
}

function confirmProfessional(message, title = 'Confirm Action') {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="confirm-modal">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="cancel-btn" type="button">Cancel</button>
                    <button class="ok-btn" type="button">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.querySelector('.cancel-btn').onclick = () => {
            backdrop.remove();
            resolve(false);
        };
        backdrop.querySelector('.ok-btn').onclick = () => {
            backdrop.remove();
            resolve(true);
        };
    });
}

function recordGameReport({ winnerName = '', loserName = '', reason = '', players = null } = {}) {
    if (!tableNumber || !db) return;
    const endDate = new Date();
    const reportGameNumber = Math.max(1, sessionGameCount || totalGames || 1);
    const safeReason = String(reason || 'game').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const reportKey = [
        String(tableNumber),
        sessionId || 'session',
        gameType,
        reportGameNumber,
        safeReason
    ].join('_');
    const report = {
        reportKey,
        gameNumber: reportGameNumber,
        tableNumber: String(tableNumber),
        gameType,
        gameLabel: getGameLabel(),
        playerCount: players ? players.length : 2,
        players: players || [
            { name: player1.name, score: player1.score },
            { name: player2.name, score: player2.score }
        ],
        winner: winnerName,
        loser: loserName,
        reason,
        startTime: gameStartTime ? new Date(gameStartTime).toISOString() : endDate.toISOString(),
        endTime: endDate.toISOString(),
        startText: gameStartTime ? new Date(gameStartTime).toLocaleString() : '',
        endText: endDate.toLocaleString(),
        durationSeconds: totalMatchTime,
        sessionId: sessionId || '',
        ballPocketDetails: [...ballPocketDetails],
        createdAt: Date.now()
    };

    db.ref(`reports/${getLocalDateKey(endDate)}/${reportKey}`).set(report).catch((err) => {
        console.error('Report save error:', err);
    });
}

function recordSessionCloseReport() {
    if (gameType !== 'snooker' || sessionGameCount <= 0) return;
    recordGameReport({
        winnerName: player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '',
        loserName: player1Wins < player2Wins ? player1.name : player2Wins < player1Wins ? player2.name : '',
        reason: 'Session closed',
        players: [
            { name: player1.name, score: player1.score, wins: player1Wins },
            { name: player2.name, score: player2.score, wins: player2Wins }
        ]
    });
}

// Update Last Ball Display
function updateLastBallDisplay(player, ballColor) {
    const lastBallDiv = document.getElementById(`player${player === player1 ? 1 : 2}-last-ball`);
    if (!lastBallDiv) return;
    if (ballColor) {
        lastBallDiv.className = `last-ball-display ball ${ballColor}`;
        lastBallDiv.classList.remove('hidden');
    } else {
        lastBallDiv.classList.add('hidden');
    }
}

// Calculate remaining points
function getRemainingPoints() {
    if (currentColorIndex >= 6) return 7;
    let remainingPoints = 0;
    for (let i = currentColorIndex + 1; i < balls.length - 1; i++) {
        remainingPoints += balls[i].points;
    }
    if (isRedPhase) remainingPoints += Math.max(0, redBallsRemaining) * balls[0].points;
    return remainingPoints;
}

// Trigger continuous confetti
function triggerConfetti() {
    if (!confettiInterval) {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const myConfetti = confetti.create(canvas, { resize: true });
        confettiInterval = setInterval(() => {
            myConfetti({
                particleCount: 50,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
                scalar: 1.2
            });
        }, 500);
    }
}

function stopConfetti() {
    if (confettiInterval) {
        clearInterval(confettiInterval);
        confettiInterval = null;
    }
}

// Format time as hh:mm:ss
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours > 0 ? hours + 'h ' : ''}${minutes > 0 || hours > 0 ? minutes + 'm ' : ''}${secs}s`;
}

// Handle exit
function handleExit() {
    if (confirm('Do you want to close the app?')) {
        resetGame(true);
        stopConfetti();
        stopTimer();
        document.getElementById('game-interface').classList.remove('show');
        document.getElementById('multi-game-interface').classList.remove('show');
        document.getElementById('records-interface').classList.remove('show');
        document.getElementById('ball-details-interface').classList.remove('show');
        document.getElementById('game-end-dialog').classList.remove('show');
        document.getElementById('toss-container').classList.remove('show');
        document.getElementById('input-form').classList.remove('hidden');
        document.getElementById('start-toss').classList.remove('hidden');
        document.getElementById('start-game').classList.add('hidden');
    }
}

// Update Lead Display
function updateLeadDisplay() {
    const lead = Math.abs(player1.score - player2.score);
    const player1Lead = document.getElementById('player1-lead');
    const player2Lead = document.getElementById('player2-lead');
    
    if (!player1Lead || !player2Lead) return;
    
    player1Lead.textContent = player1.score > player2.score ? `${lead}` : '';
    player2Lead.textContent = player2.score > player1.score ? `${lead}` : '';
}

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    initializeCounts(player1);
    initializeCounts(player2);
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('records-interface').classList.remove('show');
    document.getElementById('ball-details-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.remove('show');
    document.getElementById('toss-container').classList.remove('show');
    document.getElementById('input-form').classList.remove('hidden');
    document.getElementById('start-toss').classList.remove('hidden');
    document.getElementById('start-game').classList.add('hidden');
    updateLeadDisplay();
    document.getElementById('player1-score').textContent = `Score: ${player1.score}`;
    document.getElementById('player2-score').textContent = `Score: ${player2.score}`;
    document.getElementById('timer-display').textContent = `Total Time: ${formatTime(totalMatchTime)}`;
    document.getElementById('red-count').addEventListener('change', toggleGameModeInputs);
    document.getElementById('multi-player-count').addEventListener('change', renderMultiPlayerInputs);
    toggleGameModeInputs();
    setupIdleLock();
    if (localStorage.getItem('snookerAppLocked') === '1') {
        setTimeout(() => lockTheApp(), 100);
    }

    // Handle profile picture uploads
    document.getElementById('player1-dp').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                player1.dp = e.target.result;
                const player1DpImg = document.getElementById('player1-dp-img');
                player1DpImg.src = player1.dp;
                player1DpImg.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('player2-dp').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                player2.dp = e.target.result;
                const player2DpImg = document.getElementById('player2-dp-img');
                player2DpImg.src = player2.dp;
                player2DpImg.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
});

// Exit Buttons
document.getElementById('exit-app-input').addEventListener('click', handleExit);
document.getElementById('exit-app-game').addEventListener('click', handleExit);

// Start Toss
document.getElementById('start-toss').addEventListener('click', () => {
    if (isMultiGameMode()) {
        prepareMultiGame();
        return;
    }

    gameType = 'snooker';
    player1.name = document.getElementById('player1-name').value || 'P1';
    player2.name = document.getElementById('player2-name').value || 'P2';
    tableNumber = document.getElementById('table-number').value;
    initialRedCount = parseInt(document.getElementById('red-count').value);
    bestOf = parseInt(document.getElementById('best-of').value);
    redBallsRemaining = initialRedCount;
    ballPocketDetails = [];
    sessionGameCount = 0;
    player1Wins = 0;
    player2Wins = 0;
    sessionId = Date.now().toString();
    isFinalGame = false;
    player1.score = 0;
    player2.score = 0;
    player1.p2FoulCount = 0;
    player2.p1FoulCount = 0;

    // Update profile pictures
    const player1DpImg = document.getElementById('player1-dp-img');
    const player2DpImg = document.getElementById('player2-dp-img');
    if (player1.dp) {
        player1DpImg.src = player1.dp;
        player1DpImg.classList.remove('hidden');
    } else {
        player1DpImg.classList.add('hidden');
    }
    if (player2.dp) {
        player2DpImg.src = player2.dp;
        player2DpImg.classList.remove('hidden');
    } else {
        player2DpImg.classList.add('hidden');
    }

    const tossContainer = document.getElementById('toss-container');
    const coin = document.getElementById('coin');
    const tossResult = document.getElementById('toss-result');
    const proceedButton = document.getElementById('proceed-after-toss');
    
    if (!tossContainer || !coin || !tossResult || !proceedButton) {
        console.error('Toss container elements not found');
        return;
    }

    document.getElementById('input-form').classList.add('hidden');
    tossContainer.classList.add('show');
    coin.classList.remove('flip-heads', 'flip-tails');
    tossResult.textContent = '';
    proceedButton.classList.add('hidden');

    const toss = Math.random() < 0.5 ? 'heads' : 'tails';
    setTimeout(() => {
        coin.classList.add(`flip-${toss}`);
        tossResult.textContent = `${toss.charAt(0).toUpperCase() + toss.slice(1)}! ${toss === 'heads' ? player1.name : player2.name} starts.`;
        player1.active = toss === 'heads';
        player2.active = toss === 'tails';
        proceedButton.classList.remove('hidden');
    }, 100);
});

// Proceed After Toss
document.getElementById('proceed-after-toss').addEventListener('click', () => {
    document.getElementById('toss-container').classList.remove('show');
    document.getElementById('start-toss').classList.add('hidden');
    document.getElementById('start-game').classList.remove('hidden');
    document.getElementById('input-form').classList.remove('hidden');
});

function prepareMultiGame() {
    gameType = document.getElementById('red-count').value;
    multiTargetScore = gameType === 'century' ? 100 : 50;
    tableNumber = document.getElementById('table-number').value;
    const count = parseInt(document.getElementById('multi-player-count').value || '2');

    multiPlayers = [];
    for (let i = 1; i <= count; i++) {
        const name = document.getElementById(`multi-player-name-${i}`)?.value?.trim() || `Player ${i}`;
        multiPlayers.push({ name, score: 0, wins: 0, qualified: false, pocketCounts: {}, foulCounts: {} });
    }

    multiPlayers.forEach(player => {
        multiGameBalls.forEach(ball => {
            player.pocketCounts[ball.name] = 0;
            player.foulCounts[ball.name] = 0;
        });
    });

    multiTossAssignments = multiPlayers.map((player, index) => ({
        player: player.name,
        ball: tasBalls[index] || `Tas ${index + 1}`
    })).sort(() => Math.random() - 0.5);

    multiPlayers = multiTossAssignments.map(item => multiPlayers.find(player => player.name === item.player));
    multiCurrentIndex = 0;
    multiGameEnded = false;
    multiFinishedPlayers = [];
    totalGames = 0;
    sessionGameCount = 0;
    totalMatchTime = 0;
    ballPocketDetails = [];
    sessionId = Date.now().toString();

    document.getElementById('input-form').classList.add('hidden');
    document.getElementById('toss-container').classList.add('show');
    document.getElementById('coin').classList.remove('flip-heads', 'flip-tails');
    document.getElementById('toss-result').innerHTML = `
        ${getGameLabel()} Toss Order:<br>
        ${multiTossAssignments.map((item, index) => `${index + 1}. ${item.player} - ${item.ball}`).join('<br>')}
    `;
    document.getElementById('proceed-after-toss').classList.remove('hidden');
}

// Start Game
document.getElementById('start-game').addEventListener('click', () => {
    if (gameType === 'century' || gameType === 'fifty') {
        startMultiGame();
        return;
    }

    if (isAppLocked) {
        notify("App is locked. Please unlock first.", "warn");
        return;
    }

    const tableRef = db.ref(`tables/${tableNumber}`);

    tableRef.transaction((currentData) => {
        if (currentData && currentData.status === 'busy') {
            return;
        }

        // Ù¹ÛŒØ¨Ù„ lock Ú©Ø±Ùˆ Ø§ÙˆØ± currentGame ÚˆØ§Ù„Ùˆ
        return {
            ...(currentData || {}),
            status: "busy",
            currentGame: getCurrentGamePayload()
        };
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Transaction failed:", error);
            notify("Could not lock the table. Please try again.", "error");
            return;
        }

        if (!committed) {
            if (confirm("This table is currently busy. Unlock it and start the game?")) {
                tableRef.update({ status: "free", currentGame: null }).then(() => {
                    document.getElementById('start-game').click();
                }).catch(err => notify("Unlock problem: " + err.message, "error"));
            }
            return;
        }

        // Ú©Ø§Ù…ÛŒØ§Ø¨ â†’ Ú¯ÛŒÙ… Ø´Ø±ÙˆØ¹
        gameStartTime = new Date();
        document.getElementById('game-interface').classList.add('show');
        document.getElementById('input-form').classList.add('hidden');
        document.getElementById('player1-title').textContent = player1.name;
        document.getElementById('player2-title').textContent = player2.name;

        updateGameStatus();
        updateGameStats();
        updateTurnIndicator();
        renderBalls();
        updateLeadDisplay();
        updateLastBallDisplay(player1, null);
        updateLastBallDisplay(player2, null);
        startTimer();

        // Ù¾ÛÙ„ÛŒ Ø¨Ø§Ø± sync
        syncGameStateToFirebase();
    });
});

function startMultiGame() {
    if (isAppLocked) {
        notify("App is locked. Please unlock first.", "warn");
        return;
    }

    const tableRef = db.ref(`tables/${tableNumber}`);
    tableRef.transaction((currentData) => {
        if (currentData && currentData.status === 'busy') {
            return;
        }

        return {
            ...(currentData || {}),
            status: "busy",
            currentGame: getCurrentGamePayload()
        };
    }, (error, committed) => {
        if (error) {
            notify("Table lock failed. Try again.", "error");
            return;
        }
        if (!committed) {
            if (confirm("This table is currently busy. Unlock it and start the game?")) {
                tableRef.update({ status: "free", currentGame: null }).then(() => {
                    startMultiGame();
                }).catch(err => notify("Unlock problem: " + err.message, "error"));
            }
            return;
        }

        gameStartTime = new Date();
        document.getElementById('input-form').classList.add('hidden');
        document.getElementById('toss-container').classList.remove('show');
        document.getElementById('multi-game-interface').classList.add('show');
        renderMultiGame();
        startTimer();
        syncGameStateToFirebase();
    });
}

function renderMultiGame() {
    ensureActiveMultiIndex();
    document.getElementById('multi-table-display').textContent = `Table ${tableNumber}`;
    document.getElementById('multi-timer-display').textContent = `Total Time: ${formatTime(totalMatchTime)}`;
    document.getElementById('multi-game-title').textContent = `${getGameLabel()} - First to ${multiTargetScore}`;
    document.getElementById('multi-toss-order').textContent = multiTossAssignments.map((item, index) => `${index + 1}. ${item.player}: ${item.ball}`).join(' | ');

    const scoreboard = document.getElementById('multi-scoreboard');
    scoreboard.innerHTML = '';
    multiPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = `multi-score-card ${index === multiCurrentIndex && !player.qualified ? 'active' : ''} ${player.qualified ? 'winner' : ''}`;
        card.innerHTML = `
            <div class="multi-score-name">${player.name}</div>
            <div class="multi-score-value">${player.score}</div>
            <div>${player.qualified ? 'Qualified' : 'Playing'} | Wins: ${player.wins || 0}</div>
        `;
        scoreboard.appendChild(card);
    });

    const current = multiPlayers[multiCurrentIndex];
    document.getElementById('multi-turn-indicator').textContent = `Current Turn: ${current.name}`;
    document.getElementById('multi-active-player-name').textContent = current.name;
    document.getElementById('multi-active-player-score').textContent = `Score: ${current.score}`;

    const ballsContainer = document.getElementById('multi-balls');
    ballsContainer.innerHTML = '';
    multiGameBalls.forEach(ball => {
        const ballDiv = document.createElement('div');
        ballDiv.className = 'ball-item';
        const foulLabel = ball.name === 'White Foul' ? 'White' : ball.name;
        ballDiv.innerHTML = `
            <div class="ball ${ball.color}"></div>
            ${ball.name !== 'White Foul' ? `<button class="action-btn p-btn" data-ball="${ball.name}" data-action="P">P (${current.pocketCounts[ball.name] || 0})</button>` : ''}
            <button class="action-btn f-btn" data-ball="${ball.name}" data-action="F">F ${foulLabel} (${current.foulCounts[ball.name] || 0})</button>
            <button class="action-btn m-btn" data-ball="${ball.name}" data-action="M">M</button>
        `;
        ballsContainer.appendChild(ballDiv);
    });

    ballsContainer.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleMultiAction);
    });
}

function getMultiFoulPoints(ball) {
    if (ball.name === 'Red') return 10;
    if (ball.name === 'Yellow' || ball.name === 'Green' || ball.name === 'Brown') {
        const input = prompt('Foul points 4 to 10:', '4');
        const value = parseInt(input);
        if (isNaN(value) || value < 4 || value > 10) return null;
        return value;
    }
    if (ball.name === 'White Foul') {
        const input = prompt('White ball foul points 4 to 10:', '4');
        const value = parseInt(input);
        if (isNaN(value) || value < 4 || value > 10) return null;
        return value;
    }
    return ball.points;
}

function getActiveMultiPlayers() {
    return multiPlayers.filter(player => !player.qualified);
}

function ensureActiveMultiIndex() {
    if (!multiPlayers[multiCurrentIndex] || multiPlayers[multiCurrentIndex].qualified) {
        multiCurrentIndex = multiPlayers.findIndex(player => !player.qualified);
        if (multiCurrentIndex < 0) multiCurrentIndex = 0;
    }
}

function moveToNextMultiPlayer() {
    if (getActiveMultiPlayers().length <= 1) return;
    let guard = 0;
    do {
        multiCurrentIndex = (multiCurrentIndex + 1) % multiPlayers.length;
        guard++;
    } while (multiPlayers[multiCurrentIndex].qualified && guard <= multiPlayers.length + 1);
}

function handleMultiAction(event) {
    if (multiGameEnded) return;

    const action = event.target.dataset.action;
    const ballName = event.target.dataset.ball;
    const ball = multiGameBalls.find(item => item.name === ballName);
    const current = multiPlayers[multiCurrentIndex];
    if (!ball || !current) return;

    if (action === 'P') {
        playGameSound('P');
        current.score += ball.points;
        showPointPopup(ball.points, ball.color, ball.name);
        current.pocketCounts[ball.name] = (current.pocketCounts[ball.name] || 0) + 1;
        ballPocketDetails.push({ player: current.name, ball: `${ball.name} (${ball.points})`, isReSpotted: false });
        if (current.score >= multiTargetScore) {
            qualifyMultiPlayer(current);
            return;
        }
    } else if (action === 'F') {
        playGameSound('F');
        const foulPoints = getMultiFoulPoints(ball);
        if (foulPoints === null) {
            notify('Invalid foul points.', 'error');
            return;
        }
        current.score = Math.max(0, current.score - foulPoints);
        current.foulCounts[ball.name] = (current.foulCounts[ball.name] || 0) + 1;
        ballPocketDetails.push({ player: current.name, ball: `${ball.name} Foul (-${foulPoints})`, isReSpotted: false });
        moveToNextMultiPlayer();
    } else if (action === 'M') {
        ballPocketDetails.push({ player: current.name, ball: `${ball.name} Miss`, isReSpotted: false });
        moveToNextMultiPlayer();
    }

    renderMultiGame();
    scheduleFirebaseSync();
}

function qualifyMultiPlayer(player) {
    player.qualified = true;
    player.wins = (player.wins || 0) + 1;
    multiFinishedPlayers.push(player);
    incrementPlayerWinsAndLossesOnServer(player.name, null);

    if (getActiveMultiPlayers().length <= 1) {
        endMultiGame();
        return;
    }

    moveToNextMultiPlayer();
    renderMultiGame();
    scheduleFirebaseSync();
}

function endMultiGame() {
    multiGameEnded = true;
    totalGames++;
    sessionGameCount++;
    const loser = getActiveMultiPlayers()[0] || null;
    incrementGamesPlayedOnServer();
    if (loser) incrementPlayerWinsAndLossesOnServer(null, loser.name);
    syncGameStateToFirebase();
    stopTimer();

    const winnersText = multiFinishedPlayers.map((player, index) => `${index + 1}. ${player.name} (${player.score})`).join('<br>');
    recordGameReport({
        winnerName: multiFinishedPlayers.map(player => player.name).join(', '),
        loserName: loser ? loser.name : '',
        reason: 'Century/Fifty complete',
        players: multiPlayers.map(player => ({
            name: player.name,
            score: player.score,
            qualified: !!player.qualified
        }))
    });
    document.getElementById('game-end-message').innerHTML = `${getGameLabel()} Complete<br>Qualified/Winners:<br>${winnersText}<br><br>Loser: ${loser ? loser.name : '-'}`;
    document.getElementById('multi-game-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.add('show');
    playGameSound('WIN');
    triggerConfetti();
}

// View Records
document.getElementById('view-records').addEventListener('click', () => {
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('records-interface').classList.add('show');
    renderRecords();
});

document.getElementById('view-records-input').addEventListener('click', () => {
    document.getElementById('input-form').classList.add('hidden');
    document.getElementById('records-interface').classList.add('show');
    renderRecords();
});

// View Ball Pocket Details
document.getElementById('view-ball-details').addEventListener('click', () => {
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('ball-details-interface').classList.add('show');
    renderBallDetails(ballPocketDetails);
});

document.getElementById('multi-view-ball-details').addEventListener('click', () => {
    document.getElementById('multi-game-interface').classList.remove('show');
    document.getElementById('ball-details-interface').classList.add('show');
    renderBallDetails(ballPocketDetails);
});

document.getElementById('multi-exit-game').addEventListener('click', handleExit);

// Back to Game from Records
document.getElementById('back-to-game').addEventListener('click', () => {
    document.getElementById('records-interface').classList.remove('show');
    document.getElementById('game-interface').classList.add('show');
});

// Back to Game from Ball Details
document.getElementById('back-to-game-from-ball-details').addEventListener('click', () => {
    document.getElementById('ball-details-interface').classList.remove('show');
    if (gameType === 'century' || gameType === 'fifty') {
        document.getElementById('multi-game-interface').classList.add('show');
    } else {
        document.getElementById('game-interface').classList.add('show');
    }
});

// Clear All Sessions
document.getElementById('clear-all-sessions').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all table sessions?')) {
        gameRecords = {};
        player1Wins = 0;
        player2Wins = 0;
        totalGames = 0;
        localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
        updateGameStats();
        renderRecords();
    }
});

// Timer Functions
function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            totalMatchTime++;
            document.getElementById('timer-display').textContent = `Total Time: ${formatTime(totalMatchTime)}`;
            const multiTimer = document.getElementById('multi-timer-display');
            if (multiTimer) multiTimer.textContent = `Total Time: ${formatTime(totalMatchTime)}`;
            if (totalMatchTime % 10 === 0) scheduleFirebaseSync();
        }, 1000);
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        totalMatchTime = 0;
        document.getElementById('timer-display').textContent = `Total Time: ${formatTime(totalMatchTime)}`;
    }
}

function updateGameStatus() {
    const gameStatus = document.getElementById('game-status');
    if (!gameStatus) return;

    gameStatus.innerHTML = ''; // ØµØ§Ù Ú©Ø±Ùˆ

    if (isRedPhase) {
        const safeRedsRemaining = Math.max(0, redBallsRemaining);
        // Ø±ÛŒÚˆ ÙÛŒØ²
        gameStatus.innerHTML = `
            <div style="font-weight:bold; font-size:1.2rem; color:#ffd700; margin-bottom:8px;">
                Remaining Reds: ${safeRedsRemaining} ${expectingColor ? '<span style="color:#48bb78;">(Next: Colour)</span>' : '<span style="color:#f56565;">(Next: Red)</span>'}
            </div>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px;">
                ${Array(initialRedCount).fill().map((_, i) => `
                    <div style="
                        width:30px; height:30px; border-radius:50%;
                        background: radial-gradient(circle at 30% 30%, #ff9999, #f56565 60%, #d32f2f);
                        box-shadow: 0 3px 6px rgba(0,0,0,0.7);
                        ${i >= safeRedsRemaining ? 'opacity:0.3; transform:scale(0.8); filter:grayscale(70%);' : ''}
                    "></div>
                `).join('')}
            </div>
        `;
    } else {
        // Ú©Ù„Ø± ÙÛŒØ²
        const nextIndex = Math.min(currentColorIndex + 1, balls.length - 2);
        const nextBall = balls[nextIndex];
        let title = `Next: ${nextBall.name}`;
        if (currentColorIndex >= 6 && player1.score === player2.score) {
            title = 'Re-spotted Black';
        }

        gameStatus.innerHTML = `
            <div style="font-weight:bold; font-size:1.4rem; color:#48bb78; margin-bottom:12px;">
                ${title}
            </div>
            <div style="display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap;">
                <!-- Ø§Ú¯Ù„Ø§ Ø¨Ú‘Ø§ Ø¨Ø§Ù„ -->
                <div style="
                    width:60px; height:60px; border-radius:50%;
                    background: radial-gradient(circle at 30% 30%, #fff, ${nextBall.color} 60%);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.8);
                    border: 3px solid #fff;
                "></div>
                
                <!-- Ø¨Ø§Ù‚ÛŒ Ø¨Ú†Û’ ÛÙˆØ¦Û’ Ú©Ù„Ø±Ø² Ú†Ú¾ÙˆÙ¹Û’ Ø¨Ø§Ù„Ø² Ù…ÛŒÚº -->
                <div style="display:flex; gap:8px;">
                    ${balls.slice(nextIndex + 1, balls.length - 1).map(ball => `
                        <div style="
                            width:24px; height:24px; border-radius:50%;
                            background: ${ball.color};
                            box-shadow: 0 2px 4px rgba(0,0,0,0.6);
                            border: 1px solid #fff;
                        "></div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}
// Update Game Stats
function updateGameStats() {
    document.getElementById('game-stats').innerHTML = `Total Games: ${totalGames} | ${player1.name} Wins: ${player1Wins} | ${player2.name} Wins: ${player2Wins}`;
}

// Render Balls
function renderBalls() {
    const player1Balls = document.getElementById('player1-balls');
    const player2Balls = document.getElementById('player2-balls');
    if (!player1Balls || !player2Balls) return;

    player1Balls.innerHTML = '';
    player2Balls.innerHTML = '';

    // Ú©Ù„Ø± ÙÛŒØ² Ù…ÛŒÚº Ø±ÛŒÚˆ Ø¨Ø§Ù„ Ú©Ùˆ ÛÙ¹Ø§ Ø¯ÛŒÚºØŒ Ø¨Ø§Ù‚ÛŒ Ø³Ø¨ Ú©Ù„Ø± Ø¨Ø§Ù„Ø² Ø¯Ú©Ú¾Ø§Ø¦ÛŒÚº
    let displayBalls = isRedPhase ? balls : balls.slice(1);

    displayBalls.forEach(ball => {
        // Ø§Ú¯Ù„Ø§ Ù…ØªÙˆÙ‚Ø¹ Ø¨Ø§Ù„ Ú©ÙˆÙ† Ø³Ø§ ÛÛ’ØŸ
        const expectedBallName = isRedPhase
            ? 'Red'
            : balls[Math.min(currentColorIndex + 1, balls.length - 2)].name;

        const isExpected = ball.name === expectedBallName;

        // ÛØ± Ù¾Ù„ÛŒØ¦Ø± Ú©Û’ Ù„ÛŒÛ’ Ø¨Ø§Ù„ Ø¢Ø¦Ù¹Ù… Ø¨Ù†Ø§Ø¦ÛŒÚº
        [1, 2].forEach(playerNum => {
            const player = playerNum === 1 ? player1 : player2;
            const container = playerNum === 1 ? player1Balls : player2Balls;

            const ballDiv = document.createElement('div');
            ballDiv.className = 'ball-item';

            // Ø§Ú¯Ø± Ú©Ù„Ø± ÙÛŒØ² ÛÛ’ ØªÙˆ ØªÙ…Ø§Ù… Ú©Ù„Ø± Ø¨Ø§Ù„Ø² Ø¯Ú©Ú¾Ø§Ø¦ÛŒÚº (Ø¨Ù¹Ù† disabled ÛÙˆÚº ØªÙˆ Ø¨Ú¾ÛŒ)
            let pDisabled = true;
            let fDisabled = true;
            let mDisabled = true;

            if (player.active && !pendingFoulDecision) {
                fDisabled = false; // Foul ÛØ± ÙˆÙ‚Øª Ù…Ù…Ú©Ù† ÛÛ’ (Ø§Ú¯Ø± Ø§ÛŒÚ©Ø´Ù† ÛÙˆ)

                if (isRedPhase) {
                    if (ball.name === 'Red') {
                        pDisabled = !isExpected || expectingColor;
                        mDisabled = !isExpected;
                    } else if (expectingColor && ball.name !== 'Red' && ball.name !== 'Stager') {
                        pDisabled = false; // Ú©Ù„Ø± Ú©Ø§ Ù¾ÙˆÙ¹ Ù…Ù…Ú©Ù† ÛÛ’
                    }
                } else {
                    // Ú©Ù„Ø± ÙÛŒØ² Ù…ÛŒÚº:
                    // â†’ ØµØ±Ù expected Ú©Ù„Ø± Ù¾Ø± P Ø§ÙˆØ± M enabled
                    // â†’ Ø¨Ø§Ù‚ÛŒ Ú©Ù„Ø±Ø² Ù¾Ø± ØµØ±Ù F Ù…Ù…Ú©Ù† (Ø¨Ø§Ù‚ÛŒ disabled)
                    if (ball.name === expectedBallName) {
                        pDisabled = false;
                        mDisabled = false;
                    }
                    // Foul ÛØ± Ú©Ù„Ø± Ù¾Ø± Ù…Ù…Ú©Ù† Ø±Ú©Ú¾ÛŒÚº
                    fDisabled = false;
                }
            }

            // HTML Ø¬Ù†Ø±ÛŒÙ¹ Ú©Ø±ÛŒÚº
            if (ball.name === 'Stager') {
                ballDiv.innerHTML = `
                    <div class="ball ${ball.color}"></div>
                    <button class="action-btn f-btn" ${fDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="F">
                        F (${player.foulCounts[ball.name]})
                    </button>
                `;
            } else if (ball.name === 'Red' && isRedPhase) {
                ballDiv.innerHTML = `
                    <div class="ball ${ball.color}"></div>
                    <button class="action-btn p-btn" ${pDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="P">
                        P (${player.pocketCounts[ball.name]})
                    </button>
                    <button class="action-btn pf-btn" ${pDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="PF">
                        P + Foul
                    </button>
                    <button class="action-btn f-btn" ${fDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="F">
                        F (${player.foulCounts[ball.name]})
                    </button>
                    <button class="action-btn m-btn" ${mDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="M">
                        M
                    </button>
                `;
            } else {
                // ØªÙ…Ø§Ù… Ú©Ù„Ø± Ø¨Ø§Ù„Ø² (Yellow, Green ÙˆØºÛŒØ±Û)
                ballDiv.innerHTML = `
                    <div class="ball ${ball.color}"></div>
                    <button class="action-btn p-btn" ${pDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="P">
                        P (${player.pocketCounts[ball.name]})
                    </button>
                    <button class="action-btn f-btn" ${fDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="F">
                        F (${player.foulCounts[ball.name]})
                    </button>
                    <button class="action-btn m-btn" ${mDisabled ? 'disabled' : ''} 
                            data-player="${playerNum}" data-ball="${ball.name}" data-action="M">
                        M
                    </button>
                `;
            }

            container.appendChild(ballDiv);
        });
    });

    // Ø§ÛŒÙˆÙ†Ù¹ Ù„Ø³Ù¹Ù†Ø±Ø² Ù„Ú¯Ø§Ø¦ÛŒÚº
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleAction);
    });

    // Loser Ø¨Ù¹Ù† Ú©Ù†Ù¹Ø±ÙˆÙ„
    document.getElementById('player1-loser-btn').disabled = !player1.active || pendingFoulDecision;
    document.getElementById('player2-loser-btn').disabled = !player2.active || pendingFoulDecision;

    // Foul ÚˆÛŒØ³ÛŒÚ˜Ù† Ú©Û’ Ø¨Ù¹Ù†
    document.getElementById('force-play-again-btn').classList.add('hidden');
    document.getElementById('take-turn-btn').classList.add('hidden');

    if (pendingFoulDecision) {
        const opponentName = foulPlayer === 1 ? player2.name : player1.name;
        const currentPlayerName = foulPlayer === 1 ? player1.name : player2.name;
        document.getElementById('force-play-again-btn').classList.remove('hidden');
        document.getElementById('take-turn-btn').classList.remove('hidden');
        document.getElementById('force-play-again-btn').textContent = `${opponentName}, force ${currentPlayerName} to play again?`;
        document.getElementById('take-turn-btn').textContent = `${opponentName}, take your turn?`;
    }

    // Ø¨ÛØª Ø¶Ø±ÙˆØ±ÛŒ: Ø³Ù¹ÛŒÙ¹Ø³ Ø¨Ú¾ÛŒ Ø§Ù¾ ÚˆÛŒÙ¹ Ú©Ø±ÛŒÚº
    updateGameStatus();
}
// End Game when a player concedes
function endGameAsLoser(playerId) {
    totalGames++;
    sessionGameCount++;
    const loser = playerId === 1 ? player1 : player2;
    const winner = playerId === 1 ? player2 : player1;
    if (playerId === 1) player2Wins++;
    else player1Wins++;
    
    if (!gameRecords[tableNumber]) gameRecords[tableNumber] = [];
    gameRecords[tableNumber].push({
        player1: { name: player1.name, score: player1.score, dp: player1.dp },
        player2: { name: player2.name, score: player2.score, dp: player2.dp },
        winner: winner.name,
        loser: loser.name,
        startTime: gameStartTime.toLocaleString(),
        endTime: new Date().toLocaleString(),
        redCount: initialRedCount,
        pointDifference: Math.abs(player1.score - player2.score),
        ballPocketDetails: [...ballPocketDetails],
        sessionId: sessionId,
        bestOf: bestOf,
        isFinal: isFinalGame,
        champion: isFinalGame ? winner.name : (sessionGameCount >= bestOf ? (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-') : null)
    });
    localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
    incrementGamesPlayedOnServer();
    incrementPlayerWinsAndLossesOnServer(winner.name, loser.name);
    recordGameReport({ winnerName: winner.name, loserName: loser.name, reason: 'Concession' });
    syncCompletedGameToFirebase();
    
    updateGameStats();
    let message = `${player1.name}: ${player1.score}, ${player2.name}: ${player2.score}. Winner: ${winner.name} (Lost by ${loser.name} via concession). Game was ${initialRedCount} Reds`;
    if (isFinalGame || sessionGameCount >= bestOf) {
        const champion = isFinalGame ? winner.name : (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-');
        if (champion !== '-') message += `<br>Congratulations ðŸ‘‘ ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
    }
    
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.add('show');
    playGameSound('WIN');
    triggerConfetti();
    updateLeadDisplay();
}

// Handle Force Play Again
document.getElementById('force-play-again-btn').addEventListener('click', () => {
    pendingFoulDecision = false;
    if (foulPlayer === 1) {
        player1.active = true;
        player2.active = false;
    } else {
        player1.active = false;
        player2.active = true;
    }
    if (isRedPhase) expectingColor = false;
    document.getElementById('foul-message').classList.add('hidden');
   updateGameStatus();   // â† ÛŒÛ Ù„Ø§Ø¦Ù† ÛØ± Ø§ÛŒÚ©Ø´Ù† Ú©Û’ Ø¨Ø¹Ø¯ Ù„Ø§Ø²Ù…ÛŒ ÛÙˆ
renderBalls();
updateLeadDisplay();
});

// Handle Take Turn
document.getElementById('take-turn-btn').addEventListener('click', () => {
    pendingFoulDecision = false;
    if (foulPlayer === 1) {
        player1.active = false;
        player2.active = true;
    } else {
        player1.active = true;
        player2.active = false;
    }
    if (isRedPhase) expectingColor = false;
    document.getElementById('foul-message').classList.add('hidden');
    renderBalls();
    updateLeadDisplay();
});

// Handle Game End Options
document.getElementById('play-again').addEventListener('click', () => {
    stopConfetti();
    if (gameType === 'century' || gameType === 'fifty') {
        multiPlayers.forEach(player => {
            player.score = 0;
            player.qualified = false;
            multiGameBalls.forEach(ball => {
                player.pocketCounts[ball.name] = 0;
                player.foulCounts[ball.name] = 0;
            });
        });
        multiCurrentIndex = 0;
        multiGameEnded = false;
        multiFinishedPlayers = [];
        ballPocketDetails = [];
        gameStartTime = new Date();
        totalMatchTime = 0;
        document.getElementById('game-end-dialog').classList.remove('show');
        document.getElementById('multi-game-interface').classList.add('show');
        renderMultiGame();
        startTimer();
        syncGameStateToFirebase();
        return;
    }

    if (isFinalGame || sessionGameCount >= bestOf) {
        document.getElementById('game-end-dialog').classList.remove('show');
        document.getElementById('input-form').classList.remove('hidden');
        resetGame(true);
        document.getElementById('start-toss').classList.remove('hidden');
        document.getElementById('start-game').classList.add('hidden');
        stopTimer();
    } else {
        resetGame();
        document.getElementById('game-end-dialog').classList.remove('show');
        document.getElementById('game-interface').classList.add('show');
    }
    updateLeadDisplay();
});

document.getElementById('declare-final').addEventListener('click', () => {
    isFinalGame = true;
    const winner = player1.score > player2.score ? player1 : player2;
    gameRecords[tableNumber][gameRecords[tableNumber].length - 1].isFinal = true;
    gameRecords[tableNumber][gameRecords[tableNumber].length - 1].champion = winner.name;
    localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
    
    let message = `${player1.name}: ${player1.score}, ${player2.name}: ${player2.score}. Winner: ${winner.name}. Game was ${initialRedCount} Reds`;
    message += `<br>Congratulations ðŸ‘‘ ${winner.name} - Session Champion (${player1Wins}-${player2Wins})`;
    
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-end-dialog').classList.add('show');
    document.getElementById('game-interface').classList.remove('show');
    playGameSound('WIN');
    triggerConfetti();
    updateLeadDisplay();
    
});

document.getElementById('close-session').addEventListener('click', async () => {
    if (await confirmProfessional("The table will become free, pending cash collection will stay on the server, and this app will lock.", "Close Session?")) {
        
        // 1. Ù¹Ø§Ø¦Ù…Ø± Ø§ÙˆØ± Ú©Ù†ÙÛŒÙ¹ÛŒ Ø¨Ù†Ø¯ Ú©Ø±Ùˆ
        stopConfetti();
        stopTimer();

        // 2. ØªÙ…Ø§Ù… UI Ú†Ú¾Ù¾Ø§ Ø¯Ùˆ
        document.getElementById('game-end-dialog').classList.remove('show');
        document.getElementById('game-interface').classList.remove('show');
        document.getElementById('input-form').classList.add('hidden');       // hidden Ú©Ø±Ùˆ (remove Ù…Øª Ú©Ø±Ùˆ)
        document.getElementById('start-toss').classList.add('hidden');
        document.getElementById('start-game').classList.add('hidden');
        document.getElementById('records-interface')?.classList.add('hidden');
        document.getElementById('ball-details-interface')?.classList.add('hidden');

        recordSessionCloseReport();
        markTableClosedForCashCollection();

        // 3. Ø³ÛŒØ´Ù† Ø±ÛŒ Ø³ÛŒÙ¹ Ú©Ø±Ùˆ
        player1Wins = 0;
        player2Wins = 0;
        sessionGameCount = 0;
        totalGames = 0;                    // optional
        updateGameStats();
        updateLeadDisplay();

        // 5. Ø§ÛŒÙ¾ Ú©Ùˆ Ù„Ø§Ú© Ú©Ø±Ùˆ (ÛŒÛ Ø³Ø¨ Ø³Û’ Ø§ÛÙ… ÛÛ’)
        lockTheApp();

        // optional: ØªÙ…Ø§Ù… Ù„ÙˆÚ©Ù„ Ø±ÛŒÚ©Ø§Ø±Úˆ ØµØ§Ù Ú©Ø±Ùˆ Ø§Ú¯Ø± Ú†Ø§ÛÙˆ
        // gameRecords = {};
        // localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
    }
});

// Reset Game
function resetGame(closeSession = false) {
    redBallsRemaining = initialRedCount;
    isRedPhase = true;
    expectingColor = false;
    currentColorIndex = 0;
    currentPlayer = 1;
    player1.score = 0;
    player2.score = 0;
    player1.active = true;
    player2.active = false;
    initializeCounts(player1);
    initializeCounts(player2);
    post27FoulCount = 0;
    pendingFoulDecision = false;
    foulPlayer = null;
    ballPocketDetails = [];

    // âœ… ÛŒÛ Ù„Ø§Ø¦Ù† Ø§Ø¨ Ø´Ø±Ø· Ø³Û’ Ú†Ù„Ø§Ø¦ÛŒ Ø¬Ø§Ø¦Û’ Ú¯ÛŒ
    if (closeSession) {
        isFinalGame = false;
        player1.dp = '';
        player2.dp = '';
        document.getElementById('player1-dp-img').classList.add('hidden');
        document.getElementById('player2-dp-img').classList.add('hidden');
        document.getElementById('player1-dp').value = '';
        document.getElementById('player2-dp').value = '';
        totalMatchTime = 0;
        document.getElementById('timer-display').textContent = `Total Time: ${formatTime(totalMatchTime)}`;
    }

    if (!closeSession) {
        gameStartTime = new Date();
    }

    document.getElementById('player1-score').textContent = `Score: ${player1.score}`;
    document.getElementById('player2-score').textContent = `Score: ${player2.score}`;
    updateGameStatus();
    updateTurnIndicator();
    renderBalls();
    updateLastBallDisplay(player1, null);
    updateLastBallDisplay(player2, null);
    updateLeadDisplay();
}

// Render Records
function renderRecords() {
    const recordsTable = document.getElementById('records-table');
    recordsTable.innerHTML = '';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = `
        <tr>
            <th>Table</th>
            <th>Session</th>
            <th>Player Names</th>
            <th>Game Number</th>
            <th>Time From</th>
            <th>Time To</th>
            <th>Winner</th>
            <th>Loser</th>
            <th>Reds</th>
            <th>Point Difference</th>
            <th>Champion</th>
            <th>Ball Details</th>
        </tr>
    `;
    table.appendChild(thead);

    let totalGamesCheck = 0;
    let p1WinsCheck = 0;
    let p2WinsCheck = 0;

    for (let tableNum = 1; tableNum <= 15; tableNum++) {
        if (gameRecords[tableNum]) {
            const sessions = {};
            gameRecords[tableNum].forEach((record, index) => {
                if (!sessions[record.sessionId]) {
                    sessions[record.sessionId] = { games: [], bestOf: record.bestOf, champion: record.champion };
                }
                sessions[record.sessionId].games.push({ ...record, index });
            });

            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                session.games.forEach((record, gameIndex) => {
                    totalGamesCheck++;
                    if (record.winner === player1.name) p1WinsCheck++;
                    if (record.winner === player2.name) p2WinsCheck++;
                    const championDisplay = record.champion ? `Congratulations ðŸ‘‘ ${record.champion}` : '-';
                    const row = document.createElement('tr');
                    const player1Dp = record.player1.dp ? `<img src="${record.player1.dp}" alt="${record.player1.name} DP" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 4px;" />` : '';
                    const player2Dp = record.player2.dp ? `<img src="${record.player2.dp}" alt="${record.player2.name} DP" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 4px;" />` : '';
                    row.innerHTML = `
                        <td>${tableNum}</td>
                        <td>${sessionId}</td>
                        <td>${player1Dp}${record.player1.name} (${record.player1.score}) vs ${player2Dp}${record.player2.name} (${record.player2.score})</td>
                        <td>${gameIndex + 1}</td>
                        <td>${record.startTime}</td>
                        <td>${record.endTime}</td>
                        <td>${record.winner}</td>
                        <td>${record.loser}</td>
                        <td>${record.redCount}</td>
                        <td>${record.pointDifference}</td>
                        <td>${championDisplay}</td>
                        <td><button class="view-game-ball-details" data-table="${tableNum}" data-index="${record.index}">View Ball Details</button></td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }
    }

    if (tbody.children.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="12">No records available.</td>`;
        tbody.appendChild(row);
    } else {
        if (totalGames !== totalGamesCheck || player1Wins !== p1WinsCheck || player2Wins !== p2WinsCheck) {
            totalGames = totalGamesCheck;
            player1Wins = p1WinsCheck;
            player2Wins = p2WinsCheck;
            updateGameStats();
        }
    }

    table.appendChild(tbody);
    recordsTable.appendChild(table);

    document.querySelectorAll('.view-game-ball-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const tableNum = btn.dataset.table;
            const index = parseInt(btn.dataset.index);
            const record = gameRecords[tableNum][index];
            document.getElementById('records-interface').classList.remove('show');
            document.getElementById('ball-details-interface').classList.add('show');
            renderBallDetails(record.ballPocketDetails);
        });
    });
}

// Render Ball Pocket Details
function renderBallDetails(details) {
    const ballDetailsTable = document.getElementById('ball-details-table');
    ballDetailsTable.innerHTML = '';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = `
        <tr>
            <th>Ball Sequence #</th>
            <th>Player</th>
            <th>Ball Potted</th>
        </tr>
    `;
    table.appendChild(thead);

    if (!details || details.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="3">No balls potted yet.</td>`;
        tbody.appendChild(row);
    } else {
        details.forEach((detail, index) => {
            const row = document.createElement('tr');
            const baseBallName = detail.ball.split(' ')[0];
            const ballData = balls.find(b => b.name === baseBallName);
            const ballColor = ballData ? ballData.color : 'grey';
            const ballDisplay = `<span class="ball ${ballColor}" style="display: inline-block; vertical-align: middle; margin-right: 4px;"></span>${detail.ball}${detail.isReSpotted ? ' (Re-spotted)' : ''}`;
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${detail.player}</td>
                <td>${ballDisplay}</td>
            `;
            tbody.appendChild(row);
        });
    }

    table.appendChild(tbody);
    ballDetailsTable.appendChild(table);
}

// Handle Point, Foul, Miss
function handleAction(event) {
    const player = event.target.dataset.player;
    const ball = event.target.dataset.ball;
    const action = event.target.dataset.action;

    const ballData = balls.find(b => b.name === ball);
    const foulMessage = document.getElementById('foul-message');
    const remainingPoints = getRemainingPoints();

    if (!ballData) return;
    if (player === '1' && !player1.active || player === '2' && !player2.active) return;
    if (pendingFoulDecision) return;

    foulMessage.classList.add('hidden');

    const currentPlayerObj = player === '1' ? player1 : player2;
    const opponentPlayerObj = player === '1' ? player2 : player1;

    if (action === 'P' || action === 'PF') playGameSound('P');
    if (action === 'F') playGameSound('F');

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //     Ù†ÛŒØ§ ÙÛŒÚ†Ø±: P + Foul (Red)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'PF' && ball === 'Red' && isRedPhase && !expectingColor) {
        if (redBallsRemaining <= 0) return;
        const foulPointsInput = prompt(
            `${currentPlayerObj.name}, red was potted but foul also happened.\nEnter foul points (4 to 7):`,
            '4'
        );

        const foulPoints = parseInt(foulPointsInput);

        if (isNaN(foulPoints) || foulPoints < 4 || foulPoints > 7) {
            notify('Invalid number. Please enter a number between 4 and 7.', 'error');
            return;
        }

        // ÙØ§Ø¤Ù„ Ø±ÛŒÚ©Ø§Ø±Úˆ
        currentPlayerObj.foulCounts[ball]++;
        opponentPlayerObj.score += foulPoints;

        // Ø±ÛŒÚˆ Ú©Ù… ÛÙˆÚ¯ÛŒØŒ Ù¾ÙˆØ§Ø¦Ù†Ù¹Ø³ Ù†ÛÛŒÚº Ù…Ù„ÛŒÚº Ú¯ÛŒ
        redBallsRemaining = Math.max(0, redBallsRemaining - 1);

        // Ø¨Ø§Ù„ ÚˆÛŒÙ¹ÛŒÙ„Ø² Ù…ÛŒÚº Ù†ÙˆÙ¹ Ú©Ø±ÛŒÚº
        ballPocketDetails.push({
            player: currentPlayerObj.name,
            ball: `Red #${initialRedCount - redBallsRemaining} (P + Foul ${foulPoints})`,
            isReSpotted: false
        });

        // Foul decision Ù…ÙˆÚˆ
        pendingFoulDecision = true;
        foulPlayer = parseInt(player);

        foulMessage.textContent =
            `${opponentPlayerObj.name}, ${currentPlayerObj.name} potted red but also fouled (${foulPoints} points). Choose the next action.`;
        foulMessage.classList.remove('hidden');

        // 3 ÙØ§Ø¤Ù„ Ú†ÛŒÚ© (Ø§Ú¯Ø± Ø¢Ù¾ Ø§Ø³ØªØ¹Ù…Ø§Ù„ Ú©Ø± Ø±ÛÛ’ ÛÛŒÚº)
        if (player1.score - player2.score >= 27 && player2.score === 0 && remainingPoints >= 27) {
            if (player2.active) {
                player2.p1FoulCount++;
                if (player2.p1FoulCount >= 3) {
                    endGameDueToThreeFouls(1);
                    return;
                }
            }
        } else if (player2.score - player1.score >= 27 && player1.score === 0 && remainingPoints >= 27) {
            if (player1.active) {
                player1.p2FoulCount++;
                if (player1.p2FoulCount >= 3) {
                    endGameDueToThreeFouls(2);
                    return;
                }
            }
        }

        document.getElementById('player1-score').textContent = `Score: ${player1.score}`;
        document.getElementById('player2-score').textContent = `Score: ${player2.score}`;
        updateGameStatus();
        updateTurnIndicator();
        renderBalls();
        updateLeadDisplay();
        return;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //     Stager Foul (ÙˆÛŒØ³Ø§ ÛÛŒ Ø±Ú©Ú¾Ø§)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (ball === 'Stager' && action === 'F') {
        const foulPointsInput = prompt(`${currentPlayerObj.name}, enter foul points for Stager (4-7):`, '4');
        const foulPoints = parseInt(foulPointsInput);
        if (isNaN(foulPoints) || foulPoints < 4 || foulPoints > 7) {
            notify('Invalid foul points. Please enter a number between 4 and 7.', 'error');
            return;
        }
        pendingFoulDecision = true;
        foulPlayer = parseInt(player);
        currentPlayerObj.foulCounts[ball]++;
        opponentPlayerObj.score += foulPoints;
        foulMessage.textContent = `${opponentPlayerObj.name}, ${currentPlayerObj.name} fouled on Stager. Foul of ${foulPoints} points. Decide action?`;
        foulMessage.classList.remove('hidden');

        // 3 ÙØ§Ø¤Ù„ Ú†ÛŒÚ© (ÙˆÛŒØ³Ø§ ÛÛŒ)
        if (player1.score - player2.score >= 27 && player2.score === 0 && remainingPoints >= 27) {
            if (player2.active) {
                player2.p1FoulCount++;
                if (player2.p1FoulCount >= 3) {
                    endGameDueToThreeFouls(1);
                    return;
                }
            }
        } else if (player2.score - player1.score >= 27 && player1.score === 0 && remainingPoints >= 27) {
            if (player1.active) {
                player1.p2FoulCount++;
                if (player1.p2FoulCount >= 3) {
                    endGameDueToThreeFouls(2);
                    return;
                }
            }
        }

        if (!isRedPhase && currentColorIndex < 6 && player1.score === 27 && player2.score === 0 && remainingPoints >= 27) {
            if (player2.active) {
                player2.p1FoulCount++;
                if (player2.p1FoulCount >= 3) {
                    endGameDueToThreeFouls(1);
                    return;
                }
            }
        }

        document.getElementById('player1-score').textContent = `Score: ${player1.score}`;
        document.getElementById('player2-score').textContent = `Score: ${player2.score}`;
        updateGameStatus();
        updateTurnIndicator();
        renderBalls();
        updateLeadDisplay();
        return;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //     Ø¨Ø§Ù‚ÛŒ Ù¾ÙˆØ±Ø§ Ø±ÛŒÚˆ ÙÛŒØ² Ø§ÙˆØ± Ú©Ù„Ø± ÙÛŒØ² ÙˆÛŒØ³Ø§ ÛÛŒ
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    if (isRedPhase) {
        const expectedBall = balls[0];
        if (ball === expectedBall.name && action === 'P') {
            if (expectingColor) {
                pendingFoulDecision = true;
                foulPlayer = parseInt(player);
                let foulPoints = 4;
                currentPlayerObj.foulCounts[ball]++;
                opponentPlayerObj.score += foulPoints;
                foulMessage.textContent = `${opponentPlayerObj.name}, ${currentPlayerObj.name} potted Red after a color. Foul of ${foulPoints} points. Decide action?`;
                foulMessage.classList.remove('hidden');
            } else {
                if (redBallsRemaining <= 0) return;
                redBallsRemaining = Math.max(0, redBallsRemaining - 1);
                updateGameStatus();   // âœ… ÛŒÛ missing ØªÚ¾ÛŒ
                updateHeaderScores(); // (optional but recommended)
                currentPlayerObj.score += ballData.points;
                showPointPopup(ballData.points, ballData.color, ballData.name);
                currentPlayerObj.pocketCounts[ball]++;
                currentPlayerObj.lastBallColor = ballData.color;
                updateLastBallDisplay(currentPlayerObj, ballData.color);
                ballPocketDetails.push({ player: currentPlayerObj.name, ball: `Red #${initialRedCount - redBallsRemaining}`, isReSpotted: false });
                expectingColor = true;
                renderBalls();
            }
        } else if (expectingColor && action === 'P' && ball !== 'Red') {
            currentPlayerObj.score += ballData.points;
            showPointPopup(ballData.points, ballData.color, ballData.name);
            currentPlayerObj.pocketCounts[ball]++;
            currentPlayerObj.lastBallColor = ballData.color;
            updateLastBallDisplay(currentPlayerObj, ballData.color);
            ballPocketDetails.push({ player: currentPlayerObj.name, ball: ball, isReSpotted: false });
            expectingColor = false;
        } else if (action === 'F') {
            pendingFoulDecision = true;
            foulPlayer = parseInt(player);
            let foulPoints = ballData.points >= 4 ? ballData.points : 4;
            currentPlayerObj.foulCounts[ball]++;
            opponentPlayerObj.score += foulPoints;
            foulMessage.textContent = `${opponentPlayerObj.name}, ${currentPlayerObj.name} fouled on ${ball} ${expectingColor ? 'after a red' : 'before potting a red'}. Foul of ${foulPoints} points. Decide action?`;
            foulMessage.classList.remove('hidden');

            if (player1.score - player2.score >= 27 && player2.score === 0 && remainingPoints >= 27) {
                if (player2.active) {
                    player2.p1FoulCount++;
                    if (player2.p1FoulCount >= 3) {
                        endGameDueToThreeFouls(1);
                        return;
                    }
                }
            } else if (player2.score - player1.score >= 27 && player1.score === 0 && remainingPoints >= 27) {
                if (player1.active) {
                    player1.p2FoulCount++;
                    if (player1.p2FoulCount >= 3) {
                        endGameDueToThreeFouls(2);
                        return;
                    }
                }
            }
        } else if (action === 'M') {
            expectingColor = false;
            player1.active = !player1.active;
            player2.active = !player2.active;
            const nextPlayerSection = player1.active ? 'player1-section' : 'player2-section';
            document.getElementById(nextPlayerSection).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (redBallsRemaining <= 0 && !expectingColor) {
            isRedPhase = false;
            currentColorIndex = 0;
        }
    } else {
        const expectedBall = balls[Math.min(currentColorIndex + 1, balls.length - 2)];
        if (ball === expectedBall.name && action === 'P') {
            currentPlayerObj.score += ballData.points;
            showPointPopup(ballData.points, ballData.color, ballData.name);
            currentPlayerObj.pocketCounts[ball]++;
            currentPlayerObj.lastBallColor = ballData.color;
            updateLastBallDisplay(currentPlayerObj, ballData.color);
            const isReSpotted = currentColorIndex >= 6 && player1.score === player2.score;
            ballPocketDetails.push({ player: currentPlayerObj.name, ball: ball + (isReSpotted ? ' (Re-spotted)' : ''), isReSpotted: isReSpotted });

            if (currentColorIndex >= 6 && player1.score === player2.score) {
                currentColorIndex = 6;
                player1.active = !player1.active;
                player2.active = !player2.active;
                const nextPlayerSection = player1.active ? 'player1-section' : 'player2-section';
                document.getElementById(nextPlayerSection).scrollIntoView({ behavior: 'smooth', block: 'start' });
                renderBalls();
                updateGameStatus();
                updateTurnIndicator();
                updateLeadDisplay();
                return;
            }

            if (currentColorIndex < 6) currentColorIndex++;
        } else if (action === 'F') {
            pendingFoulDecision = true;
            foulPlayer = parseInt(player);
            let foulPoints = Math.max(4, ballData.points);
            currentPlayerObj.foulCounts[ball]++;
            opponentPlayerObj.score += foulPoints;
            foulMessage.textContent = `${opponentPlayerObj.name}, ${currentPlayerObj.name} fouled on ${ball}${ball === expectedBall.name ? '' : ` instead of ${expectedBall.name}`}. Foul of ${foulPoints} points. Decide action?`;
            foulMessage.classList.remove('hidden');

            if (currentColorIndex < 6 && player1.score === 27 && player2.score === 0 && remainingPoints >= 27) {
                if (player2.active) {
                    player2.p1FoulCount++;
                    if (player2.p1FoulCount >= 3) {
                        endGameDueToThreeFouls(1);
                        return;
                    }
                }
            }
            if (currentColorIndex < 6 && player2.score === 27 && player1.score === 0 && remainingPoints >= 27) {
                if (player1.active) {
                    player1.p2FoulCount++;
                    if (player1.p2FoulCount >= 3) {
                        endGameDueToThreeFouls(2);
                        return;
                    }
                }
            }

            if (currentColorIndex >= 6) currentColorIndex = 6;
        } else if (action === 'M') {
            player1.active = !player1.active;
            player2.active = !player2.active;
            const nextPlayerSection = player1.active ? 'player1-section' : 'player2-section';
            document.getElementById(nextPlayerSection).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (currentColorIndex >= 6 && action === 'P' && player1.score !== player2.score) {
            totalGames++;
            sessionGameCount++;
            const winner = player1.score > player2.score ? player1 : player2;
            const loser = player1.score < player2.score ? player1 : player2;
            if (player1.score > player2.score) player1Wins++;
            else if (player2.score > player1.score) player2Wins++;

            if (!gameRecords[tableNumber]) gameRecords[tableNumber] = [];
            gameRecords[tableNumber].push({
                player1: { name: player1.name, score: player1.score, dp: player1.dp },
                player2: { name: player2.name, score: player2.score, dp: player2.dp },
                winner: winner.name,
                loser: loser.name,
                startTime: gameStartTime.toLocaleString(),
                endTime: new Date().toLocaleString(),
                redCount: initialRedCount,
                pointDifference: Math.abs(player1.score - player2.score),
                ballPocketDetails: [...ballPocketDetails],
                sessionId: sessionId,
                bestOf: bestOf,
                isFinal: isFinalGame,
                champion: isFinalGame ? winner.name : (sessionGameCount >= bestOf ? (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-') : null)
            });

            let message = `${player1.name}: ${player1.score}, ${player2.name}: ${player2.score}. Winner: ${winner.name} (Lost by ${loser.name}). Game was ${initialRedCount} Reds`;
            if (isFinalGame || sessionGameCount >= bestOf) {
                const champion = isFinalGame ? winner.name : (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-');
                if (champion !== '-') message += `<br>Congratulations ðŸ‘‘ ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
            }

            localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
            incrementGamesPlayedOnServer();
            incrementPlayerWinsAndLossesOnServer(winner.name, loser.name);
            recordGameReport({ winnerName: winner.name, loserName: loser.name, reason: 'Frame complete' });
            syncCompletedGameToFirebase();
            updateGameStats();
            document.getElementById('game-end-message').innerHTML = message;
            document.getElementById('game-interface').classList.remove('show');
            document.getElementById('game-end-dialog').classList.add('show');
            playGameSound('WIN');
            triggerConfetti();
            updateLeadDisplay();
            return;
        }
    }

    document.getElementById('p1-box').classList.toggle('active', player1.active);
document.getElementById('p2-box').classList.toggle('active', player2.active);

document.getElementById('p1-box').classList.toggle('losing', player1.score < player2.score);
document.getElementById('p2-box').classList.toggle('losing', player2.score < player1.score);

    updateTurnIndicator();
    renderBalls();
    updateLeadDisplay();
    updateHeaderScores();
    scheduleFirebaseSync();

}


// Handle I Am Loser
document.getElementById('player1-loser-btn').addEventListener('click', () => {
    confirmProfessional(`${player1.name}, are you sure you want to concede this game?`, 'Concede Game?').then(ok => {
        if (!ok) return;
        endGameAsLoser(1);
    });
});

document.getElementById('player2-loser-btn').addEventListener('click', () => {
    confirmProfessional(`${player2.name}, are you sure you want to concede this game?`, 'Concede Game?').then(ok => {
        if (!ok) return;
        endGameAsLoser(2);
    });
});

// Update Turn Indicator
function updateTurnIndicator() {
    document.getElementById('turn-indicator').textContent = `Current Turn: ${player1.active ? player1.name : player2.name}`;
}

// Sync Scores to Server
document.getElementById('sync-scores').addEventListener('click', async () => {
    const syncMessage = document.getElementById('sync-message');
    syncMessage.textContent = 'Syncing...';
    try {
        const response = await fetch('http://localhost:3000/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player1: { name: player1.name, score: player1.score, wins: player1Wins, dp: player1.dp },
                player2: { name: player2.name, score: player2.score, wins: player2Wins, dp: player2.dp },
                redBallsRemaining: Math.max(0, redBallsRemaining),
                isRedPhase: isRedPhase,
                currentColorIndex: currentColorIndex,
                tableNumber: tableNumber,
                totalGames: totalGames,
                totalMatchTime: totalMatchTime,
                redCount: initialRedCount,
                ballPocketDetails: [...ballPocketDetails],
                sessionId: sessionId,
                bestOf: bestOf,
                isFinal: isFinalGame
            })
        });
        if (!response.ok) throw new Error('Failed to sync scores');
        syncMessage.textContent = 'Scores synced successfully!';
    } catch (error) {
        syncMessage.textContent = 'Error syncing scores: ' + error.message;
    }
    updateLeadDisplay();
});

// New function to end game due to 3 fouls
function endGameDueToThreeFouls(winnerId) {
 incrementGamesPlayedOnServer();
    totalGames++;
    sessionGameCount++;
    const winner = winnerId === 1 ? player1 : player2;
    const loser = winnerId === 1 ? player2 : player1;
    if (winnerId === 1) player1Wins++;
    else player2Wins++;

    if (!gameRecords[tableNumber]) gameRecords[tableNumber] = [];
    gameRecords[tableNumber].push({
        player1: { name: player1.name, score: player1.score, dp: player1.dp },
        player2: { name: player2.name, score: player2.score, dp: player2.dp },
        winner: winner.name,
        loser: loser.name,
        startTime: gameStartTime.toLocaleString(),
        endTime: new Date().toLocaleString(),
        redCount: initialRedCount,
        pointDifference: Math.abs(player1.score - player2.score),
        ballPocketDetails: [...ballPocketDetails],
        sessionId: sessionId,
        bestOf: bestOf,
        isFinal: isFinalGame,
        champion: isFinalGame ? winner.name : (sessionGameCount >= bestOf ? (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-') : null)
    });

    let message = `${player1.name}: ${player1.score}, ${player2.name}: ${player2.score}. Winner: ${winner.name} (Lost by ${loser.name} after 3 fouls). Game was ${initialRedCount} Reds`;
    if (isFinalGame || sessionGameCount >= bestOf) {
        const champion = isFinalGame ? winner.name : (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-');
        if (champion !== '-') message += `<br>Congratulations ðŸ‘‘ ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
    }

    localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
    incrementPlayerWinsAndLossesOnServer(winner.name, loser.name);
    recordGameReport({ winnerName: winner.name, loserName: loser.name, reason: 'Three fouls' });
    syncCompletedGameToFirebase();
    updateGameStats();
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.add('show');
    playGameSound('WIN');
    triggerConfetti();
    updateLeadDisplay();
}

function updateHeaderScores() {
    document.getElementById('p1-name').textContent = player1.name;
    document.getElementById('p2-name').textContent = player2.name;

    document.getElementById('p1-score-big').textContent = player1.score;
    document.getElementById('p2-score-big').textContent = player2.score;

    updateLeadDisplay();
}

function updateLeadDisplay() {
    const lead = Math.abs(player1.score - player2.score);

    const p1Lead = document.getElementById('player1-lead');
    const p2Lead = document.getElementById('player2-lead');

    p1Lead.textContent = '';
    p2Lead.textContent = '';

    if (player1.score > player2.score) {
        p1Lead.textContent = `LEAD +${lead}`;
    } 
    else if (player2.score > player1.score) {
        p2Lead.textContent = `LEAD +${lead}`;
    }
}


function renderRemainingReds() {
    const container = document.getElementById('remaining-reds-container');
    const statusText = document.getElementById('status-text');
    
    if (!container || !statusText) return;

    if (isRedPhase) {
        const safeRedsRemaining = Math.max(0, redBallsRemaining);
        // Ø±ÛŒÚˆ ÙÛŒØ² Ù…ÛŒÚº Ø¨Ø§Ù„Ø² Ø¯Ú©Ú¾Ø§Ø¤
        statusText.textContent = `Remaining Reds: ${safeRedsRemaining}`;
        
        container.innerHTML = ''; // Ù¾Ø±Ø§Ù†Û’ Ø¨Ø§Ù„Ø² ÛÙ¹Ø§Ø¤
        
        for (let i = 0; i < initialRedCount; i++) {
            const ball = document.createElement('div');
            ball.className = 'red-ball-3d';
            
            // Ø¬Ùˆ Ø±ÛŒÚˆØ² Ù¾Ú©Ù¹ ÛÙˆ Ú†Ú©Û’ ÛÛŒÚº Ø§Ù† Ú©Ùˆ pocketed Ú©Ù„Ø§Ø³ Ù„Ú¯Ø§Ø¤
            if (i >= safeRedsRemaining) {
                ball.classList.add('pocketed');
            }
            
            container.appendChild(ball);
        }
    } else {
        // Ú©Ù„Ø± ÙÛŒØ² Ù…ÛŒÚº ØµØ±Ù Ø§Ú¯Ù„Ø§ Ú©Ù„Ø± Ø¯Ú©Ú¾Ø§Ø¤
        const nextBall = balls[Math.min(currentColorIndex + 1, balls.length - 2)];
        let text = `Next: ${nextBall.name}`;
        
        if (currentColorIndex >= 6 && player1.score === player2.score) {
            text += ' (Re-spotted Black)';
        }
        
        statusText.textContent = text;
        container.innerHTML = ''; // Ø±ÛŒÚˆ Ø¨Ø§Ù„Ø² ÛÙ¹Ø§ Ø¯Ùˆ
    }
}

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDjF_POrbldRLFGTYqbhVB7DO2f_PVNIiU",
  authDomain: "snooker-13eba.firebaseapp.com",
  databaseURL: "https://snooker-13eba-default-rtdb.firebaseio.com",
  projectId: "snooker-13eba",
  storageBucket: "snooker-13eba.firebasestorage.app",
  messagingSenderId: "798005790037",
  appId: "1:798005790037:web:70222de563a0803b285bdc",
  measurementId: "G-ME8ZK3K0RV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();


function syncGameStateToFirebase() {
    if (!tableNumber) return;

    db.ref(`tables/${tableNumber}`).update({
        status: "busy",
        currentGame: getCurrentGamePayload()
    }).catch((err) => {
        console.error("Firebase sync error:", err);
    });
}

function incrementPlayerWinsAndLossesOnServer(winnerName, loserName) {
    if (!tableNumber) return;
    const tableRef = db.ref(`tables/${tableNumber}`);

    if (winnerName) {
        tableRef.child(`totalPlayerWins/${sanitizeFirebaseKey(winnerName)}`)
            .transaction(count => (count || 0) + 1);
    }

    if (loserName) {
        tableRef.child(`totalPlayerLosses/${sanitizeFirebaseKey(loserName)}`)
            .transaction(count => (count || 0) + 1);
    }
}

function incrementPlayerWins(winnerName) {
    incrementPlayerWinsAndLossesOnServer(winnerName, null);
}

function releaseTableAndRecordWin(winnerName = null) {
    if (!tableNumber) return;

    db.ref(`tables/${tableNumber}`).update({
        status: "free",
        currentGame: null
    });

    if (winnerName) {
        const safeName = winnerName.replace(/[.#$[\]]/g, '_'); // sanitize key
        db.ref(`tables/${tableNumber}/totalPlayerWins/${safeName}`)
          .transaction((count) => (count || 0) + 1);
    }

    // optional: global stats Ø¨Ú¾ÛŒ Ø¨Ú‘Ú¾Ø§ Ø³Ú©ØªÛ’ ÛÙˆ Ø§Ú¯Ø± Ú†Ø§ÛÛŒÚº
}

// Ù¹ÛŒØ¨Ù„ Ú©Ùˆ Ù…Ú©Ù…Ù„ Ø·ÙˆØ± Ù¾Ø± free / unlock Ú©Ø±ØªØ§ ÛÛ’
function unlockTable() {
    if (!tableNumber) return;

    const tableRef = db.ref(`tables/${tableNumber}`);

    tableRef.update({
        status: "free",
        currentGame: null   // Ù…ÙˆØ¬ÙˆØ¯Û Ú¯ÛŒÙ… Ú©Ø§ ÚˆÛŒÙ¹Ø§ ÛÙ¹Ø§ Ø¯ÛŒÚº
    })
    .then(() => {
        console.log(`Ù¹ÛŒØ¨Ù„ ${tableNumber} Ø§Ø¨ free ÛÛ’`);
    })
    .catch((err) => {
        console.error("Ù¹ÛŒØ¨Ù„ unlock Ú©Ø±Ù†Û’ Ù…ÛŒÚº Ù…Ø³Ø¦Ù„Û:", err);
    });
}

function syncCompletedGameToFirebase() {
    if (!tableNumber) return;
    db.ref(`tables/${tableNumber}`).update({
        currentGame: {
            ...getCurrentGamePayload(),
            completed: true,
            pendingCashRequired: true
        }
    }).catch((err) => {
        console.error("Firebase completed sync error:", err);
    });
}

function markTableClosedForCashCollection() {
    if (!tableNumber) return;
    const tableRef = db.ref(`tables/${tableNumber}`);
    const localSessionGames = Math.max(sessionGameCount || 0, totalGames || 0);

    tableRef.transaction((data) => {
        data = data || {};
        const serverGames = Number(data.gamesPlayed || 0);
        const pendingGames = Math.max(serverGames, localSessionGames);
        data.status = "free";
        data.currentGame = null;
        data.gamesPlayed = pendingGames;
        data.pendingGames = pendingGames;
        data.pendingCashRequired = pendingGames > 0;
        data.sessionClosedAt = new Date().toISOString();
        return data;
    }).catch((err) => {
        console.error("Cash collection mark error:", err);
    });
}

function incrementGamesPlayedOnServer() {
    if (!tableNumber) return;

    // ÚˆÙ¾Ù„ÛŒÚ©ÛŒÙ¹ Ø±ÙˆÚ©Ù†Û’ Ú©Ø§ Ø³Ø§Ø¯Û ÙÙ„Ú¯
    if (window.isGameCounting) return;
    window.isGameCounting = true;

    db.ref(`tables/${tableNumber}`).transaction((data) => {
        if (!data) return data;
        data.gamesPlayed = Number(data.gamesPlayed || 0) + 1;
        data.pendingGames = Number(data.pendingGames || 0) + 1;
        data.pendingCashRequired = Number(data.pendingGames || 0) > 0;
        return data;
    }).then(() => {
        console.log(`Ù¹ÛŒØ¨Ù„ ${tableNumber} Ú©ÛŒ Ú¯ÛŒÙ… Ø´Ù…Ø§Ø± ÛÙˆØ¦ÛŒ`);
    }).catch(err => {
        console.error("gamesPlayed error:", err);
    });

    // 3 Ø³ÛŒÚ©Ù†Úˆ Ø¨Ø¹Ø¯ ÙÙ„Ú¯ Ø±ÛŒ Ø³ÛŒÙ¹ (Ø§Ú¯Ù„ÛŒ Ú¯ÛŒÙ… Ú©Û’ Ù„ÛŒÛ’)
    setTimeout(() => {
        window.isGameCounting = false;
    }, 3000);
}


let isAppLocked = false;
let lockCodeAnswer = null;  // ØµØ­ÛŒØ­ Ø¬ÙˆØ§Ø¨ Ø¬Ùˆ ÛŒÙˆØ²Ø± Ø¯Ø±Ø¬ Ú©Ø±Û’ Ú¯Ø§
let idleLockTimer = null;
const IDLE_LOCK_MS = 5 * 60 * 1000;

function isGameActivityRunning() {
    return document.getElementById('game-interface')?.classList.contains('show') ||
        document.getElementById('multi-game-interface')?.classList.contains('show') ||
        document.getElementById('toss-container')?.classList.contains('show') ||
        document.getElementById('game-end-dialog')?.classList.contains('show');
}

function resetIdleLockTimer() {
    if (idleLockTimer) clearTimeout(idleLockTimer);
    idleLockTimer = setTimeout(() => {
        if (!isAppLocked && !isGameActivityRunning()) {
            lockTheApp(true);
        }
    }, IDLE_LOCK_MS);
}

function setupIdleLock() {
    ['click', 'keydown', 'touchstart', 'mousemove'].forEach(eventName => {
        document.addEventListener(eventName, resetIdleLockTimer, { passive: true });
    });
    resetIdleLockTimer();
}

// Ù„Ø§Ú© Ø§Ø³Ú©Ø±ÛŒÙ† Ø¯Ú©Ú¾Ø§Ù†Û’ Ú©Ø§ ÙÙ†Ú©Ø´Ù†
function lockTheApp(isIdleLock = false) {
    if (isAppLocked) return; // Ù¾ÛÙ„Û’ Ø³Û’ Ù„Ø§Ú© ÛÙˆ ØªÙˆ Ø¯ÙˆØ¨Ø§Ø±Û Ù†Û Ù„Ú¯Ø§Ø¤

    isAppLocked = true;
    localStorage.setItem('snookerAppLocked', '1');

    // ØªÙ…Ø§Ù… Ù…Ù…Ú©Ù†Û UI Ú†Ú¾Ù¾Ø§Ø¤
    const allSections = [
        'input-form', 'game-interface', 'records-interface', 
        'ball-details-interface', 'game-end-dialog', 'toss-container', 'multi-game-interface'
    ];
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Ù„Ø§Ú© Ø§Ø³Ú©Ø±ÛŒÙ† Ø¨Ù†Ø§Ø¤
    const lockScreen = document.createElement('div');
    lockScreen.id = 'lock-screen';
    lockScreen.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.98); color: white; display: flex;
        flex-direction: column; justify-content: center; align-items: center;
        z-index: 9999; font-family: Arial, sans-serif; text-align: center;
        backdrop-filter: blur(8px);
    `;

    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    lockCodeAnswer = randomNum * 2;

    lockScreen.innerHTML = `
        <h1 style="color: #ff4444; font-size: 3.5rem; margin-bottom: 25px;">App Locked</h1>
        <p style="font-size: 1.5rem; margin-bottom: 30px; max-width: 90%;">
            ${isIdleLock ? 'No activity detected. App locked automatically.' : 'Session close ho chuka hai.'}<br><br>
            Unlock code ke liye counter par contact karein:<br>
            <strong style="font-size: 3.5rem; color: #ffd700; margin: 15px 0;">${randomNum}</strong><br><br>
            Answer yahan likhein:
        </p>
        <input type="number" id="unlock-input" placeholder="Enter answer" 
               style="padding: 18px; font-size: 2rem; width: 220px; text-align: center; 
               border-radius: 10px; border: 2px solid #ffd700; background: #111; color: white;">
        <button id="unlock-btn" style="margin-top: 25px; padding: 15px 40px; font-size: 1.5rem; 
               background: #2a9d8f; color: white; border: none; border-radius: 10px; cursor: pointer;">
            Unlock
        </button>
        <p id="unlock-error" style="color: #ff8787; margin-top: 20px; font-size: 1.4rem; display: none;">
            Wrong answer. Try again.
        </p>
    `;

    document.body.appendChild(lockScreen);

    // Ø§Ù† Ù„Ø§Ú© Ù„Ø§Ø¬Ú©
    document.getElementById('unlock-btn').onclick = () => {
        const input = document.getElementById('unlock-input');
        const userAnswer = parseInt(input.value);

        if (userAnswer === lockCodeAnswer) {
            lockScreen.remove();
            isAppLocked = false;
            localStorage.removeItem('snookerAppLocked');
            document.getElementById('input-form').classList.remove('hidden');
            notify("App unlocked. Start a new session.", "success");
        } else {
            document.getElementById('unlock-error').style.display = 'block';
            input.value = ''; // ØºÙ„Ø· ÛÙˆÙ†Û’ Ù¾Ø± Ø®Ø§Ù„ÛŒ Ú©Ø± Ø¯Ùˆ
            input.focus();
        }
    };
}

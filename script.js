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

// Sound effects
const sounds = {
    P: new Audio('good_shot.mp3'),
    F: new Audio('oh_no.mp3'),
    M: new Audio('best_of_luck.mp3')
};

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
    if (isRedPhase) remainingPoints += redBallsRemaining * balls[0].points;
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

// Start Game
document.getElementById('start-game').addEventListener('click', () => {
    if (!tableNumber) {
        alert("ٹیبل نمبر منتخب کریں");
        return;
    }

    const tableRef = db.ref(`tables/${tableNumber}`);

    tableRef.transaction((currentData) => {
        // اگر ٹیبل پہلے سے busy ہے تو روک دیں
        if (currentData && currentData.status === 'busy') {
            alert("یہ ٹیبل پہلے سے استعمال میں ہے! دوسرا ٹیبل منتخب کریں۔");
            return; // transaction rollback
        }

        // ٹیبل lock کرو اور currentGame ڈالو
        return {
            status: "busy",
            currentGame: {
                sessionId: sessionId,
                player1: { name: player1.name, score: 0, dp: player1.dp || '' },
                player2: { name: player2.name, score: 0, dp: player2.dp || '' },
                redsRemaining: redBallsRemaining,
                isRedPhase: true,
                currentColorIndex: 0,
                startTime: new Date().toISOString(),
                lastUpdate: Date.now()
            },
            gamesPlayed: firebase.database.ServerValue.increment(1)
        };
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Transaction failed:", error);
            alert("ٹیبل لاک کرنے میں مسئلہ آیا۔ دوبارہ کوشش کریں۔");
            return;
        }

        if (!committed) {
            alert("ٹیبل کسی اور نے استعمال کر لیا!");
            return;
        }

        // کامیاب → گیم شروع
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

        // پہلی بار sync
        syncGameStateToFirebase();
    });
});

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

// Back to Game from Records
document.getElementById('back-to-game').addEventListener('click', () => {
    document.getElementById('records-interface').classList.remove('show');
    document.getElementById('game-interface').classList.add('show');
});

// Back to Game from Ball Details
document.getElementById('back-to-game-from-ball-details').addEventListener('click', () => {
    document.getElementById('ball-details-interface').classList.remove('show');
    document.getElementById('game-interface').classList.add('show');
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

    gameStatus.innerHTML = ''; // صاف کرو

    if (isRedPhase) {
        // ریڈ فیز
        gameStatus.innerHTML = `
            <div style="font-weight:bold; font-size:1.2rem; color:#ffd700; margin-bottom:8px;">
                Remaining Reds: ${redBallsRemaining} ${expectingColor ? '<span style="color:#48bb78;">(Next: Colour)</span>' : '<span style="color:#f56565;">(Next: Red)</span>'}
            </div>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px;">
                ${Array(initialRedCount).fill().map((_, i) => `
                    <div style="
                        width:30px; height:30px; border-radius:50%;
                        background: radial-gradient(circle at 30% 30%, #ff9999, #f56565 60%, #d32f2f);
                        box-shadow: 0 3px 6px rgba(0,0,0,0.7);
                        ${i >= redBallsRemaining ? 'opacity:0.3; transform:scale(0.8); filter:grayscale(70%);' : ''}
                    "></div>
                `).join('')}
            </div>
        `;
    } else {
        // کلر فیز
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
                <!-- اگلا بڑا بال -->
                <div style="
                    width:60px; height:60px; border-radius:50%;
                    background: radial-gradient(circle at 30% 30%, #fff, ${nextBall.color} 60%);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.8);
                    border: 3px solid #fff;
                "></div>
                
                <!-- باقی بچے ہوئے کلرز چھوٹے بالز میں -->
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

    // کلر فیز میں ریڈ بال کو ہٹا دیں، باقی سب کلر بالز دکھائیں
    let displayBalls = isRedPhase ? balls : balls.slice(1);

    displayBalls.forEach(ball => {
        // اگلا متوقع بال کون سا ہے؟
        const expectedBallName = isRedPhase
            ? 'Red'
            : balls[Math.min(currentColorIndex + 1, balls.length - 2)].name;

        const isExpected = ball.name === expectedBallName;

        // ہر پلیئر کے لیے بال آئٹم بنائیں
        [1, 2].forEach(playerNum => {
            const player = playerNum === 1 ? player1 : player2;
            const container = playerNum === 1 ? player1Balls : player2Balls;

            const ballDiv = document.createElement('div');
            ballDiv.className = 'ball-item';

            // اگر کلر فیز ہے تو تمام کلر بالز دکھائیں (بٹن disabled ہوں تو بھی)
            let pDisabled = true;
            let fDisabled = true;
            let mDisabled = true;

            if (player.active && !pendingFoulDecision) {
                fDisabled = false; // Foul ہر وقت ممکن ہے (اگر ایکشن ہو)

                if (isRedPhase) {
                    if (ball.name === 'Red') {
                        pDisabled = !isExpected || expectingColor;
                        mDisabled = !isExpected;
                    } else if (expectingColor && ball.name !== 'Red' && ball.name !== 'Stager') {
                        pDisabled = false; // کلر کا پوٹ ممکن ہے
                    }
                } else {
                    // کلر فیز میں:
                    // → صرف expected کلر پر P اور M enabled
                    // → باقی کلرز پر صرف F ممکن (باقی disabled)
                    if (ball.name === expectedBallName) {
                        pDisabled = false;
                        mDisabled = false;
                    }
                    // Foul ہر کلر پر ممکن رکھیں
                    fDisabled = false;
                }
            }

            // HTML جنریٹ کریں
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
                // تمام کلر بالز (Yellow, Green وغیرہ)
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

    // ایونٹ لسٹنرز لگائیں
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleAction);
    });

    // Loser بٹن کنٹرول
    document.getElementById('player1-loser-btn').disabled = !player1.active || pendingFoulDecision;
    document.getElementById('player2-loser-btn').disabled = !player2.active || pendingFoulDecision;

    // Foul ڈیسیژن کے بٹن
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

    // بہت ضروری: سٹیٹس بھی اپ ڈیٹ کریں
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
    
    updateGameStats();
    let message = `${player1.name}: ${player1.score}, ${player2.name}: ${player2.score}. Winner: ${winner.name} (Lost by ${loser.name} via concession). Game was ${initialRedCount} Reds`;
    if (isFinalGame || sessionGameCount >= bestOf) {
        const champion = isFinalGame ? winner.name : (player1Wins > player2Wins ? player1.name : player2Wins > player1Wins ? player2.name : '-');
        if (champion !== '-') message += `<br>Congratulations 👑 ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
    }
    
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.add('show');
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
   updateGameStatus();   // ← یہ لائن ہر ایکشن کے بعد لازمی ہو
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
    message += `<br>Congratulations 👑 ${winner.name} - Session Champion (${player1Wins}-${player2Wins})`;
    
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-end-dialog').classList.add('show');
    document.getElementById('game-interface').classList.remove('show');
    triggerConfetti();
    updateLeadDisplay();
    
});

document.getElementById('close-session').addEventListener('click', () => {
    stopConfetti();
    document.getElementById('game-end-dialog').classList.remove('show');
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('input-form').classList.remove('hidden');
    resetGame(true);
    document.getElementById('start-toss').classList.remove('hidden');
    document.getElementById('start-game').classList.add('hidden');
   // session ری سیٹ
        player1Wins = 0;
        player2Wins = 0;
        sessionGameCount = 0;
        updateGameStats();
    stopTimer();
    updateLeadDisplay();
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

    // ✅ یہ لائن اب شرط سے چلائی جائے گی
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
                    const championDisplay = record.champion ? `Congratulations 👑 ${record.champion}` : '-';
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

    if (sounds[action]) {
        sounds[action].play().catch(error => console.error('Error playing sound:', error));
    }

    // ──────────────────────────────
    //     نیا فیچر: P + Foul (Red)
    // ──────────────────────────────
    if (action === 'PF' && ball === 'Red' && isRedPhase && !expectingColor) {
        const foulPointsInput = prompt(
            `${currentPlayerObj.name}، ریڈ پوکیٹ ہوئی لیکن فاؤل بھی ہوا\nفاؤل پوائنٹس (4 سے 7):`,
            '4'
        );

        const foulPoints = parseInt(foulPointsInput);

        if (isNaN(foulPoints) || foulPoints < 4 || foulPoints > 7) {
            alert('غلط نمبر! براہ مہربانی 4 سے 7 کے درمیان درج کریں۔');
            return;
        }

        // فاؤل ریکارڈ
        currentPlayerObj.foulCounts[ball]++;
        opponentPlayerObj.score += foulPoints;

        // ریڈ کم ہوگی، پوائنٹس نہیں ملیں گی
        redBallsRemaining--;

        // بال ڈیٹیلز میں نوٹ کریں
        ballPocketDetails.push({
            player: currentPlayerObj.name,
            ball: `Red #${initialRedCount - redBallsRemaining} (P + Foul ${foulPoints})`,
            isReSpotted: false
        });

        // Foul decision موڈ
        pendingFoulDecision = true;
        foulPlayer = parseInt(player);

        foulMessage.textContent = 
            `${opponentPlayerObj.name}، ${currentPlayerObj.name} نے ریڈ پوٹ کی مگر فاؤل بھی کیا (${foulPoints} پوائنٹس)۔ فیصلہ کریں؟`;
        foulMessage.classList.remove('hidden');

        // 3 فاؤل چیک (اگر آپ استعمال کر رہے ہیں)
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

    // ──────────────────────────────
    //     Stager Foul (ویسا ہی رکھا)
    // ──────────────────────────────
    if (ball === 'Stager' && action === 'F') {
        const foulPointsInput = prompt(`${currentPlayerObj.name}, enter foul points for Stager (4-7):`, '4');
        const foulPoints = parseInt(foulPointsInput);
        if (isNaN(foulPoints) || foulPoints < 4 || foulPoints > 7) {
            alert('Invalid foul points. Please enter a number between 4 and 7.');
            return;
        }
        pendingFoulDecision = true;
        foulPlayer = parseInt(player);
        currentPlayerObj.foulCounts[ball]++;
        opponentPlayerObj.score += foulPoints;
        foulMessage.textContent = `${opponentPlayerObj.name}, ${currentPlayerObj.name} fouled on Stager. Foul of ${foulPoints} points. Decide action?`;
        foulMessage.classList.remove('hidden');

        // 3 فاؤل چیک (ویسا ہی)
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

    // ──────────────────────────────
    //     باقی پورا ریڈ فیز اور کلر فیز ویسا ہی
    // ──────────────────────────────

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
                redBallsRemaining--;
                updateGameStatus();   // ✅ یہ missing تھی
updateHeaderScores(); // (optional but recommended)
                currentPlayerObj.score += ballData.points;
                currentPlayerObj.pocketCounts[ball]++;
                currentPlayerObj.lastBallColor = ballData.color;
                updateLastBallDisplay(currentPlayerObj, ballData.color);
                ballPocketDetails.push({ player: currentPlayerObj.name, ball: `Red #${initialRedCount - redBallsRemaining}`, isReSpotted: false });
                expectingColor = true;
                renderBalls();
            }
        } else if (expectingColor && action === 'P' && ball !== 'Red') {
            currentPlayerObj.score += ballData.points;
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

        if (redBallsRemaining === 0 && !expectingColor) {
            isRedPhase = false;
            currentColorIndex = 0;
        }
    } else {
        const expectedBall = balls[Math.min(currentColorIndex + 1, balls.length - 2)];
        if (ball === expectedBall.name && action === 'P') {
            currentPlayerObj.score += ballData.points;
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
                if (champion !== '-') message += `<br>Congratulations 👑 ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
            }

            localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
            updateGameStats();
            document.getElementById('game-end-message').innerHTML = message;
            document.getElementById('game-interface').classList.remove('show');
            document.getElementById('game-end-dialog').classList.add('show');
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

}


// Handle I Am Loser
document.getElementById('player1-loser-btn').addEventListener('click', () => {
    if (confirm(`${player1.name}, are you sure you want to concede the game?`)) {
        endGameAsLoser(1);
incrementGamesPlayedOnServer();
    }
});

document.getElementById('player2-loser-btn').addEventListener('click', () => {
    if (confirm(`${player2.name}, are you sure you want to concede the game?`)) {
        endGameAsLoser(2);
incrementGamesPlayedOnServer();
    }
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
                redBallsRemaining: redBallsRemaining,
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
        if (champion !== '-') message += `<br>Congratulations 👑 ${champion} - Session Champion (${player1Wins}-${player2Wins})`;
    }

    localStorage.setItem('snookerGameRecords', JSON.stringify(gameRecords));
    updateGameStats();
    document.getElementById('game-end-message').innerHTML = message;
    document.getElementById('game-interface').classList.remove('show');
    document.getElementById('game-end-dialog').classList.add('show');
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
        // ریڈ فیز میں بالز دکھاؤ
        statusText.textContent = `Remaining Reds: ${redBallsRemaining}`;
        
        container.innerHTML = ''; // پرانے بالز ہٹاؤ
        
        for (let i = 0; i < initialRedCount; i++) {
            const ball = document.createElement('div');
            ball.className = 'red-ball-3d';
            
            // جو ریڈز پکٹ ہو چکے ہیں ان کو pocketed کلاس لگاؤ
            if (i >= redBallsRemaining) {
                ball.classList.add('pocketed');
            }
            
            container.appendChild(ball);
        }
    } else {
        // کلر فیز میں صرف اگلا کلر دکھاؤ
        const nextBall = balls[Math.min(currentColorIndex + 1, balls.length - 2)];
        let text = `Next: ${nextBall.name}`;
        
        if (currentColorIndex >= 6 && player1.score === player2.score) {
            text += ' (Re-spotted Black)';
        }
        
        statusText.textContent = text;
        container.innerHTML = ''; // ریڈ بالز ہٹا دو
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

    db.ref(`tables/${tableNumber}/currentGame`).update({
        player1: { name: player1.name, score: player1.score, dp: player1.dp },
        player2: { name: player2.name, score: player2.score, dp: player2.dp },
        redsRemaining: redBallsRemaining,
        isRedPhase: isRedPhase,
        currentColorIndex: currentColorIndex,
        lastUpdate: Date.now()
    }).catch((err) => {
        console.error("Firebase sync error:", err);
    });
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

    // optional: global stats بھی بڑھا سکتے ہو اگر چاہیں
}

// ٹیبل کو مکمل طور پر free / unlock کرتا ہے
function unlockTable() {
    if (!tableNumber) return;

    const tableRef = db.ref(`tables/${tableNumber}`);

    tableRef.update({
        status: "free",
        currentGame: null   // موجودہ گیم کا ڈیٹا ہٹا دیں
    })
    .then(() => {
        console.log(`ٹیبل ${tableNumber} اب free ہے`);
    })
    .catch((err) => {
        console.error("ٹیبل unlock کرنے میں مسئلہ:", err);
    });
}

document.getElementById('player1-loser-btn').addEventListener('click', () => {
    if (confirm(`${player1.name}, کیا آپ واقعی ہار مان رہے ہیں؟`)) {
        const winnerName = player2.name;
        // ... آپ کا موجودہ endGameAsLoser(1) والا کوڈ اگر ہے ...
                       // ← یہ لائن ڈالیں
        // اگر آپ ونر کی win count بڑھانا چاہتے ہیں تو:
        incrementPlayerWins(winnerName);
    }
});

document.getElementById('player2-loser-btn').addEventListener('click', () => {
    if (confirm(`${player2.name}, کیا آپ واقعی ہار مان رہے ہیں؟`)) {
        const winnerName = player1.name;
        // ... endGameAsLoser(2) والا کوڈ ...
                       // ← یہ لائن ڈالیں
        incrementPlayerWins(winnerName);
    }
});


// ہر گیم ختم ہونے پر سرور پر gamesPlayed +1 (صرف ایک بار)
function incrementGamesPlayedOnServer() {
    if (!tableNumber) return;

    // ڈپلیکیٹ روکنے کا سادہ فلگ
    if (window.isGameCounting) return;
    window.isGameCounting = true;

    db.ref(`tables/${tableNumber}`).transaction((data) => {
        if (!data) return data;
        data.gamesPlayed = (data.gamesPlayed || 0) + 1;
        return data;
    }).then(() => {
        console.log(`ٹیبل ${tableNumber} کی گیم شمار ہوئی`);
    }).catch(err => {
        console.error("gamesPlayed error:", err);
    });

    // 3 سیکنڈ بعد فلگ ری سیٹ (اگلی گیم کے لیے)
    setTimeout(() => {
        window.isGameCounting = false;
    }, 3000);
}

// Tic Tac Toe Game Logic

// Game state variables
let currentPlayer = 'X';
let startingPlayer = 'X'; // Track starting player for offline alternating rounds
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true; // Enabled by default for local offline play
let scores = {
    X: 0,
    O: 0,
    draws: 0
};
const winTarget = 5;

// Winning combinations
const winningCombinations = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Diagonal top-left to bottom-right
    [2, 4, 6]  // Diagonal top-right to bottom-left
];

// DOM elements
const cells = document.querySelectorAll('.cell');
const currentPlayerElement = document.getElementById('currentPlayer');
const gameStatusElement = document.getElementById('gameStatus');
const resetButton = document.getElementById('resetBtn');
const clearScoreButton = document.getElementById('clearScoreBtn');
const scoreXElement = document.getElementById('scoreX');
const scoreOElement = document.getElementById('scoreO');
const scoreDrawElement = document.getElementById('scoreDraw');

// Multiplayer DOM elements
const onlineActionsPanel = document.getElementById('onlineActionsPanel');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const createPanel = document.getElementById('createPanel');
const joinPanel = document.getElementById('joinPanel');
const createNameInput = document.getElementById('createNameInput');
const joinNameInput = document.getElementById('joinNameInput');
const createActionBtn = document.getElementById('createActionBtn');
const joinActionBtn = document.getElementById('joinActionBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomStatusElement = document.getElementById('roomStatus');
const roomCodeBox = document.getElementById('roomCodeBox');
const roomCodeLabel = document.getElementById('roomCodeLabel');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const connectedPlayersBox = document.getElementById('connectedPlayersBox');
const connectedPlayers = document.getElementById('connectedPlayers');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const chatBox = document.getElementById('chatBox');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const lobbySubtitle = document.getElementById('lobbySubtitle');

// Server connection badge selectors
const serverStatusText = document.getElementById('serverStatusText');
const serverStatusIndicator = document.getElementById('serverStatusIndicator');
const onlineCountContainer = document.getElementById('onlineCountContainer');
const onlineCountValue = document.getElementById('onlineCountValue');
const onlineCountSeparator = document.getElementById('onlineCountSeparator');

// Multiplayer state variables
let socket = null;
let roomCode = null;
let playerId = null; // 0 for X (creator), 1 for O (joiner)
let isMultiplayer = false; // Starts in local play mode by default
let isServerConnected = false;
let myName = 'Player';

// Initialize the game
function initializeGame() {
    // Add event listeners to cells
    cells.forEach((cell, index) => {
        cell.addEventListener('click', () => handleCellClick(index));
    });

    // Add event listeners to controls buttons
    resetButton.addEventListener('click', () => {
        if (isMultiplayer) {
            if (socket && socket.readyState === WebSocket.OPEN && roomCode) {
                socket.send(JSON.stringify({ type: 'reset-game', roomCode }));
            }
        } else {
            startNewRound();
        }
    });

    clearScoreButton.addEventListener('click', () => {
        if (isMultiplayer) {
            if (socket && socket.readyState === WebSocket.OPEN && roomCode) {
                socket.send(JSON.stringify({ type: 'clear-scores', roomCode }));
            }
        } else {
            clearScores();
        }
    });

    // Update display
    updateDisplay();
}

// Handle cell click
function handleCellClick(index) {
    console.log(`[Cell Click] Index: ${index}, isMultiplayer: ${isMultiplayer}, playerId: ${playerId}, currentPlayer: ${currentPlayer}, gameActive: ${gameActive}`);
    
    if (isMultiplayer) {
        if (!roomCode || playerId === null || !gameActive) {
            console.log(`[Cell Click] Blocked: roomCode=${roomCode}, playerId=${playerId}, gameActive=${gameActive}`);
            return;
        }
        
        // Enforce whose turn it is
        const isMyTurn = (Number(playerId) === 0 && currentPlayer === 'X') || (Number(playerId) === 1 && currentPlayer === 'O');
        if (!isMyTurn) {
            console.log(`[Cell Click] Blocked: Not your turn. PlayerId: ${playerId}, Current Turn: ${currentPlayer}`);
            return;
        }

        if (gameBoard[index] !== '') {
            console.log(`[Cell Click] Blocked: Cell ${index} is already taken.`);
            return;
        }

        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log(`[Cell Click] Sending make-move to server for cell ${index}`);
            socket.send(JSON.stringify({
                type: 'make-move',
                roomCode,
                playerId: Number(playerId),
                index
            }));
        } else {
            console.log(`[Cell Click] Blocked: WebSocket is not open.`);
        }
        return;
    }

    // Offline / Local Mode Logic
    if (gameBoard[index] !== '' || !gameActive) {
        return;
    }

    makeMove(index);
    checkGameResult();
    if (gameActive) {
        switchPlayer();
    }
}

// Make a move locally (offline)
function makeMove(index) {
    gameBoard[index] = currentPlayer;
    const cell = cells[index];
    
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer.toLowerCase());
    cell.classList.add('disabled');
    
    cell.style.transform = 'scale(1.1)';
    setTimeout(() => {
        cell.style.transform = 'scale(1)';
    }, 150);
}

// Switch current player locally (offline)
function switchPlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateCurrentPlayerDisplay();
}

// Check game result locally (offline)
function checkGameResult() {
    let winner = checkWinner();
    
    if (winner) {
        handleWin(winner);
    } else if (checkDraw()) {
        handleDraw();
    }
}

// Check for winner
function checkWinner() {
    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        
        if (gameBoard[a] && 
            gameBoard[a] === gameBoard[b] && 
            gameBoard[a] === gameBoard[c]) {
            
            highlightWinningCells(combination);
            return gameBoard[a];
        }
    }
    return null;
}

// Check for draw
function checkDraw() {
    return gameBoard.every(cell => cell !== '') && !checkWinner();
}

// Find winning combination (used in multiplayer sync)
function findWinningCombination(board) {
    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return combination;
        }
    }
    return null;
}

// Handle win locally (offline)
function handleWin(winner) {
    gameActive = false;
    scores[winner]++;
    updateScoreDisplay();
    updateGameStats(winner);
    
    if (scores[winner] >= winTarget) {
        gameStatusElement.textContent = `🏆 Player ${winner} Wins the Match! 🏆`;
        gameStatusElement.classList.add('winner');
    } else {
        gameStatusElement.textContent = `🎉 Player ${winner} Wins! 🎉`;
        gameStatusElement.classList.add('winner');
    }
    
    cells.forEach(cell => {
        cell.classList.add('disabled');
    });
    
    celebrateWin();

    if (scores[winner] < winTarget) {
        setTimeout(() => {
            startNewRound();
        }, 1400);
    }
}

// Handle draw locally (offline)
function handleDraw() {
    gameActive = false;
    scores.draws++;
    updateScoreDisplay();
    updateGameStats('draw');
    
    gameStatusElement.textContent = "🤝 It's a Draw! 🤝";
    gameStatusElement.classList.add('draw');
    
    cells.forEach(cell => {
        cell.classList.add('disabled');
    });

    setTimeout(() => {
        startNewRound();
    }, 1400);
}

// Highlight winning cells
function highlightWinningCells(combination) {
    combination.forEach(index => {
        cells[index].classList.add('winning-cell');
    });
}

// Celebrate win with animation
function celebrateWin() {
    const gameContainer = document.querySelector('.game-container');
    gameContainer.style.animation = 'celebration 1s ease-in-out';
    
    setTimeout(() => {
        gameContainer.style.animation = '';
    }, 1000);
}

// Start a fresh match locally (offline)
function startNewMatch() {
    currentPlayer = 'X';
    startingPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    scores = {
        X: 0,
        O: 0,
        draws: 0
    };
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
    });
    
    gameStatusElement.textContent = 'New match started!';
    gameStatusElement.classList.remove('winner', 'draw');
    
    updateDisplay();
    
    const boardElement = document.querySelector('.game-board');
    boardElement.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
        boardElement.style.animation = '';
    }, 500);
}

// Start the next round locally (offline)
function startNewRound() {
    // Alternate starting player
    startingPlayer = startingPlayer === 'X' ? 'O' : 'X';
    currentPlayer = startingPlayer;
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
    });
    
    gameStatusElement.textContent = `Round started! Player ${startingPlayer} goes first.`;
    gameStatusElement.classList.remove('winner', 'draw');
    
    updateDisplay();
    
    const boardElement = document.querySelector('.game-board');
    boardElement.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
        boardElement.style.animation = '';
    }, 500);
}

// Clear all scores locally (offline)
function clearScores() {
    scores = {
        X: 0,
        O: 0,
        draws: 0
    };
    updateScoreDisplay();
    startNewMatch();

    const scoreBoard = document.querySelector('.score-board');
    scoreBoard.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
        scoreBoard.style.animation = '';
    }, 500);
}

// Update current player display
function updateCurrentPlayerDisplay() {
    currentPlayerElement.textContent = currentPlayer;
    currentPlayerElement.style.color = currentPlayer === 'X' ? '#e74c3c' : '#3498db';
}

// Update score display
function updateScoreDisplay() {
    scoreXElement.textContent = scores.X;
    scoreOElement.textContent = scores.O;
    scoreDrawElement.textContent = scores.draws;
    
    [scoreXElement, scoreOElement, scoreDrawElement].forEach(element => {
        element.style.animation = 'bounce 0.3s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 300);
    });
}

// Update all displays
function updateDisplay() {
    updateCurrentPlayerDisplay();
    updateScoreDisplay();
}

// Add bounce animation to CSS dynamically
const bounceKeyframes = `
    @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
`;

const style = document.createElement('style');
style.textContent = bounceKeyframes;
document.head.appendChild(style);

// Add keyboard support
document.addEventListener('keydown', (event) => {
    // Press 'R' to reset game
    if (event.key.toLowerCase() === 'r') {
        if (isMultiplayer) {
            if (socket && socket.readyState === WebSocket.OPEN && roomCode) {
                socket.send(JSON.stringify({ type: 'reset-game', roomCode }));
            }
        } else {
            startNewMatch();
        }
    }
    
    // Press number keys 1-9 to make moves
    const keyNumber = parseInt(event.key);
    if (keyNumber >= 1 && keyNumber <= 9) {
        const cellIndex = keyNumber - 1;
        handleCellClick(cellIndex);
    }
});

// Add visual feedback for hover effects
function addHoverEffects() {
    cells.forEach((cell, index) => {
        cell.addEventListener('mouseenter', () => {
            if (gameBoard[index] === '' && gameActive) {
                if (isMultiplayer) {
                    const isMyTurn = (playerId === 0 && currentPlayer === 'X') || (playerId === 1 && currentPlayer === 'O');
                    if (!isMyTurn) return;
                }
                cell.style.background = 'rgba(255, 255, 255, 0.95)';
                cell.textContent = currentPlayer;
                cell.style.opacity = '0.5';
                cell.classList.add(currentPlayer.toLowerCase());
            }
        });
        
        cell.addEventListener('mouseleave', () => {
            if (gameBoard[index] === '' && gameActive) {
                cell.style.background = '';
                cell.textContent = '';
                cell.style.opacity = '';
                cell.classList.remove('x', 'o');
            }
        });
    });
}

// Add game statistics tracking
let gameStats = {
    totalGames: 0,
    xWins: 0,
    oWins: 0,
    draws: 0
};

// Update stats when game ends
function updateGameStats(result) {
    gameStats.totalGames++;
    if (result === 'X') gameStats.xWins++;
    else if (result === 'O') gameStats.oWins++;
    else gameStats.draws++;
    
    try {
        localStorage.setItem('ticTacToeStats', JSON.stringify(gameStats));
    } catch (e) {
        console.log('Could not save game statistics');
    }
}

// Load stats from localStorage on page load
function loadGameStats() {
    try {
        const savedStats = localStorage.getItem('ticTacToeStats');
        if (savedStats) {
            gameStats = JSON.parse(savedStats);
        }
    } catch (e) {
        console.log('Could not load game statistics');
    }
}

// --- WebSocket / Multiplayer ---

function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('Connected to WebSocket server');
        isServerConnected = true;
        serverStatusText.textContent = 'Online';
        serverStatusIndicator.className = 'status-indicator green';
        roomStatusElement.textContent = 'Connected to server. Select a game mode.';
        
        // Auto-rejoin session if it exists in sessionStorage
        const savedRoomCode = sessionStorage.getItem('roomCode');
        const savedPlayerId = sessionStorage.getItem('playerId');
        const savedName = sessionStorage.getItem('myName');
        
        if (savedRoomCode && savedPlayerId !== null && savedName) {
            myName = savedName;
            socket.send(JSON.stringify({
                type: 'rejoin-room',
                roomCode: savedRoomCode,
                playerId: parseInt(savedPlayerId),
                name: savedName
            }));
        }
    };
    
    socket.onclose = () => {
        console.log('Disconnected from WebSocket server');
        isServerConnected = false;
        serverStatusText.textContent = 'Offline';
        serverStatusIndicator.className = 'status-indicator red';
        roomStatusElement.textContent = 'Server disconnected. Reconnecting...';
        if (onlineCountContainer && onlineCountSeparator) {
            onlineCountContainer.classList.add('hidden');
            onlineCountSeparator.classList.add('hidden');
        }
        setTimeout(connectWebSocket, 3000);
    };
    
    socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        isServerConnected = false;
        serverStatusText.textContent = 'Offline';
        serverStatusIndicator.className = 'status-indicator red';
        if (onlineCountContainer && onlineCountSeparator) {
            onlineCountContainer.classList.add('hidden');
            onlineCountSeparator.classList.add('hidden');
        }
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'online-count':
                    if (onlineCountContainer && onlineCountSeparator && onlineCountValue) {
                        onlineCountValue.textContent = data.count;
                        onlineCountContainer.classList.remove('hidden');
                        onlineCountSeparator.classList.remove('hidden');
                    }
                    break;
                    
                case 'room-created':
                    roomCode = data.roomCode;
                    playerId = data.playerId; // 0
                    isMultiplayer = true;
                    
                    // Save metadata to sessionStorage
                    sessionStorage.setItem('roomCode', roomCode);
                    sessionStorage.setItem('playerId', playerId);
                    sessionStorage.setItem('myName', myName);
                    
                    showLobbyActiveState();
                    roomStatusElement.textContent = 'Room created. Share the code to play!';
                    roomCodeLabel.textContent = roomCode;
                    break;
                    
                case 'room-joined':
                    roomCode = data.roomCode;
                    playerId = data.playerId; // 1 or 0
                    isMultiplayer = true;
                    
                    // Save metadata to sessionStorage
                    sessionStorage.setItem('roomCode', roomCode);
                    sessionStorage.setItem('playerId', playerId);
                    sessionStorage.setItem('myName', myName);
                    
                    showLobbyActiveState();
                    roomStatusElement.textContent = 'Joined room successfully!';
                    roomCodeLabel.textContent = roomCode;
                    break;
                    
                case 'room-not-found':
                    alert('Room code not found. Please double-check.');
                    roomStatusElement.textContent = 'Room not found.';
                    // Clear sessionStorage so player does not loop rejoin requests
                    sessionStorage.removeItem('roomCode');
                    sessionStorage.removeItem('playerId');
                    sessionStorage.removeItem('myName');
                    window.location.reload();
                    break;
                    
                case 'room-full':
                    alert('This room is full. Please create a new one.');
                    roomStatusElement.textContent = 'Room is full.';
                    break;
                    
                case 'room-state':
                    handleRoomStateUpdate(data);
                    break;
                    
                case 'chat-message':
                    appendChatMessage(data.name, data.message);
                    break;
            }
        } catch (err) {
            console.error('Error processing server message:', err);
        }
    };
}

function showLobbyActiveState() {
    onlineActionsPanel.classList.add('hidden');
    createPanel.classList.add('hidden');
    joinPanel.classList.add('hidden');
    
    roomCodeBox.classList.remove('hidden');
    connectedPlayersBox.classList.remove('hidden');
    chatBox.classList.remove('hidden');
    lobbySubtitle.textContent = 'Multiplayer Session Active';
}

function handleRoomStateUpdate(room) {
    console.log('[Room State Update] Players list:', room.players, 'Your playerId:', playerId);
    
    // 1. Sync players list
    connectedPlayers.innerHTML = '';
    room.players.forEach(p => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-tag player-${Number(p.id) === 0 ? 'x' : 'o'}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.name + (Number(p.id) === Number(playerId) ? ' (You)' : '');
        
        const markSpan = document.createElement('span');
        markSpan.className = 'player-mark';
        markSpan.textContent = Number(p.id) === 0 ? 'X' : 'O';
        
        playerDiv.appendChild(nameSpan);
        playerDiv.appendChild(markSpan);
        connectedPlayers.appendChild(playerDiv);
    });
    
    // 2. Sync Board UI
    gameBoard = room.board;
    cells.forEach((cell, index) => {
        cell.textContent = gameBoard[index];
        cell.className = 'cell';
        if (gameBoard[index] !== '') {
            cell.classList.add(gameBoard[index].toLowerCase(), 'disabled');
        }
    });
    
    // 3. Sync Scores
    scores = room.scores;
    updateScoreDisplay();
    
    // 4. Turn & game state enforcement
    currentPlayer = room.currentPlayer;
    updateCurrentPlayerDisplay();
    
    gameStatusElement.classList.remove('winner', 'draw');
    
    if (room.status === 'waiting') {
        gameActive = false;
        gameStatusElement.textContent = 'Waiting for opponent to connect...';
    } else if (room.status === 'playing') {
        gameActive = true;
        
        const isMyTurn = (playerId === 0 && currentPlayer === 'X') || (playerId === 1 && currentPlayer === 'O');
        if (isMyTurn) {
            gameStatusElement.textContent = 'Your turn!';
            gameStatusElement.style.color = '#ffd700';
        } else {
            gameStatusElement.textContent = `Opponent's turn (${currentPlayer})...`;
            gameStatusElement.style.color = '#fff';
        }
    } else if (room.status.startsWith('win-')) {
        gameActive = false;
        const winner = room.status.split('-')[1];
        
        const winningCombination = findWinningCombination(gameBoard);
        if (winningCombination) {
            highlightWinningCells(winningCombination);
        }
        
        const isIWin = (playerId === 0 && winner === 'X') || (playerId === 1 && winner === 'O');
        if (isIWin) {
            gameStatusElement.textContent = `🏆 You Won the Round! 🏆`;
            celebrateWin();
        } else {
            gameStatusElement.textContent = `💀 Opponent (${winner}) Won! 💀`;
        }
        gameStatusElement.classList.add('winner');
        
        // Auto check target wins
        if (scores[winner] >= winTarget) {
            gameStatusElement.textContent = `👑 Match Won by Player ${winner}! 👑`;
        } else {
            // Auto reset round after 2 seconds (only host triggers to avoid duplicate requests)
            if (playerId === 0) {
                setTimeout(() => {
                    socket.send(JSON.stringify({ type: 'reset-game', roomCode }));
                }, 2000);
            }
        }
    } else if (room.status === 'draw') {
        gameActive = false;
        gameStatusElement.textContent = "🤝 It's a Draw! 🤝";
        gameStatusElement.classList.add('draw');
        
        if (playerId === 0) {
            setTimeout(() => {
                socket.send(JSON.stringify({ type: 'reset-game', roomCode }));
            }, 2000);
        }
    }
}

function appendChatMessage(author, message) {
    const isSelf = author === myName;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isSelf ? 'self' : 'other'}`;
    
    const authorSpan = document.createElement('span');
    authorSpan.className = 'msg-author';
    authorSpan.textContent = author;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    
    msgDiv.appendChild(authorSpan);
    msgDiv.appendChild(textSpan);
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !roomCode) return;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'chat-message',
            roomCode,
            name: myName,
            message
        }));
        chatInput.value = '';
    }
}

// Initialize components and WebSockets when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing game...');
    
    loadGameStats();
    initializeGame();
    addHoverEffects();
    
    // Connect to WebSocket server
    connectWebSocket();
    
    // Back navigation listeners
    const backToOnlineBtns = document.querySelectorAll('.back-to-online-btn');
    backToOnlineBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            createPanel.classList.add('hidden');
            joinPanel.classList.add('hidden');
            onlineActionsPanel.classList.remove('hidden');
            lobbySubtitle.textContent = 'Create a room or join with a code to play with a friend.';
        });
    });

    createRoomBtn.addEventListener('click', () => {
        onlineActionsPanel.classList.add('hidden');
        createPanel.classList.remove('hidden');
        roomStatusElement.textContent = 'Enter name to create your room.';
    });
    
    joinRoomBtn.addEventListener('click', () => {
        onlineActionsPanel.classList.add('hidden');
        joinPanel.classList.remove('hidden');
        roomStatusElement.textContent = 'Enter name and code to join.';
    });
    
    // Create Room action
    createActionBtn.addEventListener('click', () => {
        const name = createNameInput.value.trim();
        if (!name) {
            alert('Please enter your name.');
            return;
        }
        myName = name;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'create-room',
                name: myName
            }));
        } else {
            alert('Not connected to server yet. Please wait...');
        }
    });
    
    // Join Room action
    joinActionBtn.addEventListener('click', () => {
        const name = joinNameInput.value.trim();
        const code = roomCodeInput.value.trim().toUpperCase();
        if (!name) {
            alert('Please enter your name.');
            return;
        }
        if (!code) {
            alert('Please enter room code.');
            return;
        }
        myName = name;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'join-room',
                roomCode: code,
                name: myName
            }));
        } else {
            alert('Not connected to server yet. Please wait...');
        }
    });
    
    // Copy room code
    copyRoomCodeBtn.addEventListener('click', () => {
        if (!roomCode) return;
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                const origText = copyRoomCodeBtn.textContent;
                copyRoomCodeBtn.textContent = '✅';
                setTimeout(() => {
                    copyRoomCodeBtn.textContent = origText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy room code:', err);
            });
    });
    
    // Leave / Exit room or local mode
    leaveRoomBtn.addEventListener('click', () => {
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerId');
        sessionStorage.removeItem('myName');
        window.location.reload();
    });

    // Send chat message
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
});
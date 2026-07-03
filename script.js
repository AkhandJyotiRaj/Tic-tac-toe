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
const lobbyCard = document.getElementById('lobbyCard');
const roomDetailsCard = document.getElementById('roomDetailsCard');
const onlineActionsPanel = document.getElementById('onlineActionsPanel');
const playAIBtn = document.getElementById('playAIBtn');
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
let isVsComputer = false; // Tracks if playing against Computer AI
let isComputerThinking = false; // Blocks user clicks during AI turn
let roundCount = 1; // Track local round number
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

    if (isVsComputer) {
        // Enforce user turn (User is always X in AI mode) and block clicks if computer is thinking
        if (currentPlayer !== 'X' || isComputerThinking) return;

        makeMove(index);
        checkGameResult();
        
        if (gameActive) {
            switchPlayer();
            isComputerThinking = true;
            gameStatusElement.textContent = 'Computer is thinking...';
            setTimeout(makeComputerMove, 600);
        }
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

// Computer AI move logic
function makeComputerMove() {
    if (!isVsComputer || !isComputerThinking) return;

    let move = null;

    // 90% chance to play casual, 10% chance to play smart (makes it super easy)
    let playSmart = Math.random() >= 0.90;

    // Force casual if computer already has a round win
    if (scores && scores.O >= 1) {
        playSmart = false;
    }

    if (playSmart) {
        // 1. Find winning move for AI (O)
        move = findWinningOrBlockingMove('O');
        if (move === null) {
            // 2. Find blocking move for Player (X)
            move = findWinningOrBlockingMove('X');
        }
    }

    // Fallback selection of empty cells
    if (move === null) {
        // Collect all empty cells
        let emptyCells = [];
        gameBoard.forEach((val, idx) => {
            if (val === '') emptyCells.push(idx);
        });

        // If computer already won 1 round, avoid picking any empty cell that completes a win!
        if (scores && scores.O >= 1 && emptyCells.length > 1) {
            const nonWinningCells = emptyCells.filter(idx => !wouldMoveWin(idx, 'O'));
            if (nonWinningCells.length > 0) {
                emptyCells = nonWinningCells;
            }
        }

        // Choose any random cell from the allowed empty cells list (makes starting moves completely random)
        if (emptyCells.length > 0) {
            move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
    }

    if (move !== null) {
        makeMove(move);
        checkGameResult();
        isComputerThinking = false;
        if (gameActive) {
            switchPlayer();
            gameStatusElement.textContent = 'Your turn!';
        }
    } else {
        isComputerThinking = false;
    }
}

// Helper to check if a specific move would win the game for a symbol
function wouldMoveWin(index, symbol) {
    // Temporarily apply symbol
    gameBoard[index] = symbol;
    
    // Check if it satisfies any winning combinations
    let isWin = false;
    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            isWin = true;
            break;
        }
    }
    
    // Restore state
    gameBoard[index] = '';
    return isWin;
}

function findWinningOrBlockingMove(symbol) {
    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        const values = [gameBoard[a], gameBoard[b], gameBoard[c]];
        
        const countSymbol = values.filter(v => v === symbol).length;
        const countEmpty = values.filter(v => v === '').length;
        
        if (countSymbol === 2 && countEmpty === 1) {
            if (gameBoard[a] === '') return a;
            if (gameBoard[b] === '') return b;
            if (gameBoard[c] === '') return c;
        }
    }
    return null;
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
    
    clearHoverPreviews();
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
    
    clearHoverPreviews();
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
    const gameContainer = document.querySelector('.board-card');
    if (gameContainer) {
        gameContainer.style.animation = 'celebration 1s ease-in-out';
        setTimeout(() => {
            gameContainer.style.animation = '';
        }, 1000);
    }
}

// Clear any pending mouseenter hover preview values
function clearHoverPreviews() {
    cells.forEach((cell, index) => {
        if (gameBoard[index] === '') {
            cell.style.background = '';
            cell.style.opacity = '';
            cell.textContent = '';
            cell.classList.remove('x', 'o');
        }
    });
}

// Start a fresh match locally (offline)
function startNewMatch() {
    currentPlayer = 'X';
    startingPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    roundCount = 1;
    scores = {
        X: 0,
        O: 0,
        draws: 0
    };
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
        cell.style.background = '';
        cell.style.opacity = '';
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
    roundCount++;
    // Alternate starting player
    startingPlayer = startingPlayer === 'X' ? 'O' : 'X';
    currentPlayer = startingPlayer;
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
        cell.style.background = '';
        cell.style.opacity = '';
    });
    
    gameStatusElement.classList.remove('winner', 'draw');
    updateDisplay();
    
    gameActive = true;
    if (isVsComputer) {
        if (currentPlayer === 'O') {
            gameStatusElement.textContent = 'Round started! Computer is thinking...';
            isComputerThinking = true;
            setTimeout(makeComputerMove, 700);
        } else {
            gameStatusElement.textContent = 'Round started! Your turn (Player X).';
            isComputerThinking = false;
        }
    } else {
        gameStatusElement.textContent = `Round started! Player ${startingPlayer} goes first.`;
    }
    
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

    const scoreBoard = document.querySelector('.scoreboard-card');
    if (scoreBoard) {
        scoreBoard.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => {
            scoreBoard.style.animation = '';
        }, 500);
    }
}

// Update current player display
function updateCurrentPlayerDisplay() {
    if (currentPlayerElement) {
        currentPlayerElement.textContent = currentPlayer;
        currentPlayerElement.style.color = currentPlayer === 'X' ? '#38bdf8' : '#f43f5e';
    }
    
    const turnMark = document.getElementById('turnMarkIndicator');
    const turnText = document.getElementById('turnText');
    const turnSubText = document.getElementById('turnSubText');
    
    if (turnMark) {
        turnMark.textContent = currentPlayer;
        // In original theme, Player X is Cyan (#38bdf8) and Player O is Red/Pink (#f43f5e)
        turnMark.style.color = currentPlayer === 'X' ? '#38bdf8' : '#f43f5e';
    }
    
    if (turnText) {
        if (isMultiplayer) {
            const isMyTurn = (Number(playerId) === 0 && currentPlayer === 'X') || (Number(playerId) === 1 && currentPlayer === 'O');
            if (isMyTurn) {
                turnText.textContent = "YOUR TURN";
                if (turnSubText) turnSubText.textContent = "Make your move on the board";
            } else {
                turnText.textContent = "OPPONENT'S TURN";
                if (turnSubText) turnSubText.textContent = "Waiting for opponent's move...";
            }
        } else if (isVsComputer) {
            if (currentPlayer === 'X') {
                turnText.textContent = "YOUR TURN";
                if (turnSubText) turnSubText.textContent = "Make your move on the board";
            } else {
                turnText.textContent = "COMPUTER'S TURN";
                if (turnSubText) turnSubText.textContent = "Computer is choosing a move...";
            }
        } else {
            // Local offline
            turnText.textContent = `PLAYER ${currentPlayer}'S TURN`;
            if (turnSubText) turnSubText.textContent = "Make your move on the board";
        }
    }
}

// Update game info card in sidebar
function updateGameInfoDisplay() {
    const infoMode = document.getElementById('infoMode');
    const infoRound = document.getElementById('infoRound');
    
    if (infoMode) {
        if (isMultiplayer) {
            infoMode.textContent = 'Multiplayer';
        } else if (isVsComputer) {
            infoMode.textContent = 'vs Computer';
        } else {
            infoMode.textContent = 'Local Offline';
        }
    }
    
    if (infoRound) {
        infoRound.textContent = roundCount;
    }
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
    updateGameInfoDisplay();
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
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
    if (lobbyCard) lobbyCard.classList.add('hidden');
    if (roomDetailsCard) roomDetailsCard.classList.remove('hidden');
    
    onlineActionsPanel.classList.add('hidden');
    createPanel.classList.add('hidden');
    joinPanel.classList.add('hidden');
    
    roomCodeBox.classList.remove('hidden');
    connectedPlayersBox.classList.remove('hidden');
    chatBox.classList.remove('hidden');
    lobbySubtitle.textContent = 'Multiplayer Session Active';

    // Enable Chat inputs in dashboard
    if (chatInput) {
        chatInput.removeAttribute('disabled');
        chatInput.placeholder = 'Type a message...';
    }
    if (sendChatBtn) {
        sendChatBtn.removeAttribute('disabled');
    }
    // Remove placeholder in chat
    if (chatMessages) {
        const placeholder = chatMessages.querySelector('.chat-placeholder');
        if (placeholder) {
            chatMessages.innerHTML = '';
        }
    }
}

function handleRoomStateUpdate(room) {
    console.log('[Room State Update] Players list:', room.players, 'Your playerId:', playerId);
    
    // Sync Room Code label in the active Room Details card
    if (room.roomCode) {
        roomCode = room.roomCode;
        if (roomCodeLabel) roomCodeLabel.textContent = roomCode;
        if (roomCodeBox) roomCodeBox.classList.remove('hidden');
    }
    
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
    
    // 4. Turn & game state enforcement
    currentPlayer = room.currentPlayer;
    
    // Update all display elements (scores, turn indicators, game mode status)
    updateDisplay();
    
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
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'chat-header';
    
    const authorSpan = document.createElement('span');
    authorSpan.className = 'chat-author';
    authorSpan.textContent = author;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-time';
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    timeSpan.textContent = `${hours}:${minutes} ${ampm}`;
    
    headerDiv.appendChild(authorSpan);
    headerDiv.appendChild(timeSpan);
    
    const textDiv = document.createElement('div');
    textDiv.className = 'chat-text';
    textDiv.textContent = message;
    
    msgDiv.appendChild(headerDiv);
    msgDiv.appendChild(textDiv);
    
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
    
    
    // Play against AI
    playAIBtn.addEventListener('click', () => {
        isMultiplayer = false;
        isVsComputer = true;
        gameActive = true;
        
        if (lobbyCard) lobbyCard.classList.add('hidden');
        if (roomDetailsCard) roomDetailsCard.classList.remove('hidden');
        
        onlineActionsPanel.classList.add('hidden');
        lobbySubtitle.textContent = 'Single Player AI Mode Active';
        roomStatusElement.textContent = 'Playing against Computer AI.';
        
        // Show exit option in players box
        connectedPlayersBox.classList.remove('hidden');
        connectedPlayers.innerHTML = `
            <div class="player-tag player-x"><span style="font-weight:bold;">Player X (You)</span><span class="player-mark">X</span></div>
            <div class="player-tag player-o"><span style="font-weight:bold;">Computer (AI)</span><span class="player-mark">O</span></div>
        `;
        leaveRoomBtn.textContent = 'Exit AI Mode';
        leaveRoomBtn.style.background = 'rgba(255,255,255,0.15)';
        
        startNewMatch();
    });

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

    // Theme Toggle Handler
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    
    // Load theme from localStorage (Default is dark matching screenshot)
    const savedTheme = localStorage.getItem('gameTheme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    } else {
        document.body.classList.remove('light-theme');
        if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('gameTheme', isLight ? 'light' : 'dark');
            if (themeToggleIcon) {
                themeToggleIcon.textContent = isLight ? '🌙' : '☀️';
            }
        });
    }
});
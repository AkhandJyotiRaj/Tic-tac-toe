// Tic Tac Toe Game Logic

// Game state variables
let currentPlayer = 'X';
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;
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

// Initialize the game
function initializeGame() {
    // Add event listeners to cells
    cells.forEach((cell, index) => {
        cell.addEventListener('click', () => handleCellClick(index));
    });

    // Add event listeners to buttons
    resetButton.addEventListener('click', startNewMatch);
    clearScoreButton.addEventListener('click', clearScores);

    // Update display
    updateDisplay();
}

// Handle cell click
function handleCellClick(index) {
    // Check if cell is already filled or game is not active
    if (gameBoard[index] !== '' || !gameActive) {
        return;
    }

    // Make move
    makeMove(index);
    
    // Check for winner or draw
    checkGameResult();
    
    // Switch player if game is still active
    if (gameActive) {
        switchPlayer();
    }
}

// Make a move
function makeMove(index) {
    gameBoard[index] = currentPlayer;
    const cell = cells[index];
    
    // Add player class and text
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer.toLowerCase());
    cell.classList.add('disabled');
    
    // Add animation effect
    cell.style.transform = 'scale(1.1)';
    setTimeout(() => {
        cell.style.transform = 'scale(1)';
    }, 150);
}

// Switch current player
function switchPlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateCurrentPlayerDisplay();
}

// Check game result
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
            
            // Highlight winning cells
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

// Handle win
function handleWin(winner) {
    gameActive = false;
    scores[winner]++;
    updateScoreDisplay();
    
    // Check if this player reached the match target
    if (scores[winner] >= winTarget) {
        gameStatusElement.textContent = `🏆 Player ${winner} Wins the Match! 🏆`;
        gameStatusElement.classList.add('winner');
    } else {
        // Show win message with emojis
        gameStatusElement.textContent = `🎉 Player ${winner} Wins! 🎉`;
        gameStatusElement.classList.add('winner');
    }
    
    // Disable all cells
    cells.forEach(cell => {
        cell.classList.add('disabled');
    });
    
    // Play win sound effect (visual feedback)
    celebrateWin();

    // If the match is not finished yet, start a new round automatically after a short delay
    if (scores[winner] < winTarget) {
        setTimeout(() => {
            startNewRound();
        }, 1400);
    }
}

// Handle draw
function handleDraw() {
    gameActive = false;
    scores.draws++;
    updateScoreDisplay();
    
    gameStatusElement.textContent = "🤝 It's a Draw! 🤝";
    gameStatusElement.classList.add('draw');
    
    // Disable all cells
    cells.forEach(cell => {
        cell.classList.add('disabled');
    });

    // Start a new round automatically after a short delay
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
    // Add celebration animation to the game container
    const gameContainer = document.querySelector('.game-container');
    gameContainer.style.animation = 'celebration 1s ease-in-out';
    
    setTimeout(() => {
        gameContainer.style.animation = '';
    }, 1000);
}

// Start a fresh match (reset scores and board)
function startNewMatch() {
    currentPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    scores = {
        X: 0,
        O: 0,
        draws: 0
    };
    
    // Reset cells
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
    });
    
    // Reset status for a fresh match
    gameStatusElement.textContent = 'New game started!';
    gameStatusElement.classList.remove('winner', 'draw');
    
    // Update display
    updateDisplay();
    
    // Add reset animation
    const boardElement = document.querySelector('.game-board');
    boardElement.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
        boardElement.style.animation = '';
    }, 500);
}

// Start the next round without resetting scores
function startNewRound() {
    currentPlayer = 'X';
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    
    // Reset cells
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'disabled', 'winning-cell');
    });
    
    // Reset status for a fresh round
    gameStatusElement.textContent = 'Round started!';
    gameStatusElement.classList.remove('winner', 'draw');
    
    // Update display
    updateDisplay();
    
    // Add reset animation
    const boardElement = document.querySelector('.game-board');
    boardElement.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
        boardElement.style.animation = '';
    }, 500);
}

// Clear all scores
function clearScores() {
    scores = {
        X: 0,
        O: 0,
        draws: 0
    };
    updateScoreDisplay();

    // Also reset the current game so a fresh round starts
    startNewMatch();

    // Add clear animation (trigger after reset so both animate independently)
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
    
    // Add bounce effect to updated scores
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

// Add the keyframes to the document
const style = document.createElement('style');
style.textContent = bounceKeyframes;
document.head.appendChild(style);

// Enhanced user experience features

// Add keyboard support
document.addEventListener('keydown', (event) => {
    // Press 'R' to reset game
    if (event.key.toLowerCase() === 'r') {
        resetGame();
    }
    
    // Press number keys 1-9 to make moves
    const keyNumber = parseInt(event.key);
    if (keyNumber >= 1 && keyNumber <= 9) {
        const cellIndex = keyNumber - 1;
        handleCellClick(cellIndex);
    }
});

// Add visual feedback for hover effects (encapsulated into a function)
function addHoverEffects() {
    cells.forEach((cell, index) => {
        cell.addEventListener('mouseenter', () => {
            if (gameBoard[index] === '' && gameActive) {
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
    
    // Store stats in localStorage if available
    try {
        localStorage.setItem('ticTacToeStats', JSON.stringify(gameStats));
    } catch (e) {
        // localStorage not available or quota exceeded
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
        // localStorage not available or invalid data
        console.log('Could not load game statistics');
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing game...');
    
    loadGameStats();
    initializeGame();
    addHoverEffects();
    gameStatusElement.textContent = 'Ready to play!';
    
    // Add welcome message
    console.log('🎮 Tic Tac Toe Game Loaded!');
    console.log('💡 Pro Tips:');
    console.log('• Press "R" to reset the game');
    console.log('• Press number keys 1-9 to make moves');
    console.log('• Hover over cells to preview your move');
    
    // Test button functionality
    setTimeout(() => {
        const testReset = document.getElementById('resetBtn');
        const testClear = document.getElementById('clearScoreBtn');
        
        if (testReset) {
            console.log('✅ Reset button found and ready');
        } else {
            console.error('❌ Reset button not found');
        }
        
        if (testClear) {
            console.log('✅ Clear score button found and ready');
        } else {
            console.error('❌ Clear score button not found');
        }
    }, 100);
});
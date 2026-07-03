const express = require('express');
const http = require('http');
const net = require('net');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = new Map();

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function createRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      players: [null, null],
      board: Array(9).fill(''),
      currentPlayer: 'X',
      startingPlayer: 'X',
      status: 'waiting',
      scores: { X: 0, O: 0, draws: 0 }
    });
  }
  return rooms.get(code);
}

function checkWinner(board) {
  for (let combination of winningCombinations) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function checkDraw(board) {
  return board.every(cell => cell !== '') && !checkWinner(board);
}

function broadcastRoom(room, code) {
  const payload = JSON.stringify({
    type: 'room-state',
    roomCode: code,
    players: room.players.map((p, idx) => p ? { name: p.name, id: idx } : null).filter(Boolean),
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    scores: room.scores
  });

  room.players.forEach(player => {
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  });
}

function broadcastOnlineCount(wss) {
  const payload = JSON.stringify({
    type: 'online-count',
    count: wss.clients.size
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function attachSocketHandlers(wss) {
  wss.on('connection', (ws) => {
    broadcastOnlineCount(wss);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'create-room') {
          let code = createRoomCode();
          while (rooms.has(code)) {
            code = createRoomCode();
          }
          const room = getRoom(code);
          room.players[0] = { ws, name: msg.name || 'Player 1' };
          ws.send(JSON.stringify({ type: 'room-created', roomCode: code, playerId: 0 }));
          broadcastRoom(room, code);
        }

        if (msg.type === 'join-room') {
          if (!rooms.has(msg.roomCode)) {
            ws.send(JSON.stringify({ type: 'room-not-found' }));
            return;
          }

          const room = rooms.get(msg.roomCode);
          if (room.players[1] === null) {
            room.players[1] = { ws, name: msg.name || 'Player 2' };
            room.status = 'playing';
            ws.send(JSON.stringify({ type: 'room-joined', roomCode: msg.roomCode, playerId: 1 }));
            broadcastRoom(room, msg.roomCode);
          } else if (room.players[0] === null) {
            room.players[0] = { ws, name: msg.name || 'Player 1' };
            room.status = 'playing';
            ws.send(JSON.stringify({ type: 'room-joined', roomCode: msg.roomCode, playerId: 0 }));
            broadcastRoom(room, msg.roomCode);
          } else {
            ws.send(JSON.stringify({ type: 'room-full' }));
          }
        }

        if (msg.type === 'rejoin-room') {
          if (!rooms.has(msg.roomCode)) {
            ws.send(JSON.stringify({ type: 'room-not-found' }));
            return;
          }

          const room = rooms.get(msg.roomCode);
          const playerId = msg.playerId;

          if (playerId === 0 || playerId === 1) {
            room.players[playerId] = { ws, name: msg.name };
            
            // If both players are now connected, resume the game
            if (room.players[0] !== null && room.players[1] !== null) {
              room.status = 'playing';
            }
            
            ws.send(JSON.stringify({ type: 'room-joined', roomCode: msg.roomCode, playerId }));
            broadcastRoom(room, msg.roomCode);
          } else {
            ws.send(JSON.stringify({ type: 'room-full' }));
          }
        }

        if (msg.type === 'make-move') {
          console.log(`[make-move] Room: ${msg.roomCode}, PlayerId: ${msg.playerId}, Index: ${msg.index}`);
          const room = getRoom(msg.roomCode);
          if (!room) {
            console.log(`[make-move] Room not found: ${msg.roomCode}`);
            return;
          }
          if (room.status !== 'playing') {
            console.log(`[make-move] Blocked: Room status is not playing (status is: ${room.status})`);
            return;
          }
          const player = room.players[msg.playerId];
          if (!player) {
            console.log(`[make-move] Blocked: Player not found for index: ${msg.playerId}`);
            return;
          }
          if (player.ws !== ws) {
            console.log(`[make-move] Blocked: WebSocket mismatch. Expected Player ${msg.playerId} connection.`);
            return;
          }

          if (room.board[msg.index] !== '') {
            console.log(`[make-move] Blocked: Cell ${msg.index} already filled.`);
            return;
          }
          if (room.currentPlayer !== (msg.playerId === 0 ? 'X' : 'O')) {
            console.log(`[make-move] Blocked: Turn mismatch. Current player turn is: ${room.currentPlayer}`);
            return;
          }

          room.board[msg.index] = room.currentPlayer;
          console.log(`[make-move] Set board[${msg.index}] = ${room.currentPlayer}`);
          
          const winner = checkWinner(room.board);
          if (winner) {
            room.status = 'win-' + winner;
            room.scores[winner]++;
            console.log(`[make-move] Winner found: ${winner}. New scores: X=${room.scores.X}, O=${room.scores.O}`);
          } else if (checkDraw(room.board)) {
            room.status = 'draw';
            room.scores.draws++;
            console.log(`[make-move] Draw game. Draws count: ${room.scores.draws}`);
          } else {
            room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            console.log(`[make-move] Next turn: ${room.currentPlayer}`);
          }
          broadcastRoom(room, msg.roomCode);
        }

        if (msg.type === 'reset-game') {
          const room = getRoom(msg.roomCode);
          if (!room) return;
          room.board = Array(9).fill('');
          
          // Alternate the starting player for the next round!
          room.startingPlayer = room.startingPlayer === 'X' ? 'O' : 'X';
          room.currentPlayer = room.startingPlayer;
          console.log(`[reset-game] Next round starting player: ${room.startingPlayer}`);

          const numPlayers = room.players.filter(Boolean).length;
          room.status = numPlayers === 2 ? 'playing' : 'waiting';
          broadcastRoom(room, msg.roomCode);
        }

        if (msg.type === 'clear-scores') {
          const room = getRoom(msg.roomCode);
          if (!room) return;
          room.board = Array(9).fill('');
          room.startingPlayer = 'X';
          room.currentPlayer = 'X';
          room.scores = { X: 0, O: 0, draws: 0 };
          const numPlayers = room.players.filter(Boolean).length;
          room.status = numPlayers === 2 ? 'playing' : 'waiting';
          broadcastRoom(room, msg.roomCode);
        }

        if (msg.type === 'chat-message') {
          const room = getRoom(msg.roomCode);
          if (!room) return;
          room.players.forEach(player => {
            if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
              player.ws.send(JSON.stringify({
                type: 'chat-message',
                name: msg.name,
                message: msg.message
              }));
            }
          });
        }
      } catch (err) {
        console.error(err);
      }
    });

    ws.on('close', () => {
      for (const [code, room] of rooms.entries()) {
        let disconnected = false;
        for (let i = 0; i < 2; i++) {
          if (room.players[i] && room.players[i].ws === ws) {
            room.players[i] = null;
            disconnected = true;
          }
        }
        if (room.players[0] === null && room.players[1] === null) {
          rooms.delete(code);
        } else if (disconnected) {
          room.status = 'waiting';
          room.board = Array(9).fill('');
          room.startingPlayer = 'X';
          room.currentPlayer = 'X';
          broadcastRoom(room, code);
        }
      }
      broadcastOnlineCount(wss);
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });
}

async function startServer(port) {
  const availablePort = await isPortAvailable(port);
  if (!availablePort) {
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
    return startServer(port + 1);
  }

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  attachSocketHandlers(wss);

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer(Number(process.env.PORT) || 5001).catch((error) => {
  console.error(error);
});

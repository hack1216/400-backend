// ============================================================
// 400 UNO — BACKEND SERVER
// ============================================================

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const {
  createDeck, shuffleDeck, dealCards, cardId, parseCardId,
  determineTrickWinner, calculateScores, getValidCards,
  VALID_BIDS, BID_REQUIRED_TRICKS,
} = require('./gameLogic');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── ROOM STORE ──────────────────────────────────────────────
// rooms[roomCode] = { players:[{id,name,seat}], state: GameState }
const rooms = {};

// ─── HELPERS ─────────────────────────────────────────────────
function getRoomForSocket(socketId) {
  for (const [code, room] of Object.entries(rooms)) {
    if (room.players.some(p => p.id === socketId)) return { code, room };
  }
  return null;
}

function getPlayerInRoom(room, socketId) {
  return room.players.find(p => p.id === socketId);
}

function createGameState(players) {
  const deck = shuffleDeck(createDeck());
  const hands = dealCards(deck);

  // Assign hands to players by seat order
  const playerHands = {};
  const bids = {};
  const tricksWon = {};
  const totalScores = {};

  players.forEach((p, i) => {
    playerHands[p.id] = hands[i];
    bids[p.id] = null;
    tricksWon[p.id] = 0;
    totalScores[p.id] = 0;
  });

  const leadPlayer = players[Math.floor(Math.random() * 4)].id;

  return {
    phase: 'bidding',          // bidding | playing | roundEnd
    hands: playerHands,
    bids,
    tricksWon,
    totalScores,
    currentTrick: [],          // [{playerId, card}]
    trickLeader: leadPlayer,
    currentPlayer: leadPlayer,
    leadSuit: null,
    completedTricks: [],       // [{cards, winner}]
    roundScores: {},
    trickCount: 0,
  };
}

// Build per-player view of state (hide opponent hands)
function buildPlayerView(state, socketId, players) {
  const seat = players.findIndex(p => p.id === socketId);
  const teammateSeat = seat % 2 === 0 ? seat + 1 : seat - 1; // 0↔1, 2↔3... wait teams are 0&1 vs 2&3
  // Teams: seats 0,1 = Team A; seats 2,3 = Team B
  const teamA = [0, 1];
  const teamB = [2, 3];
  const myTeam = teamA.includes(seat) ? teamA : teamB;
  const teammateSeatIdx = myTeam.find(s => s !== seat);
  const teammateId = players[teammateSeatIdx]?.id;

  const visibleHands = {};
  players.forEach((p, i) => {
    if (p.id === socketId || p.id === teammateId) {
      visibleHands[p.id] = state.hands[p.id];
    } else {
      // Show card count only
      visibleHands[p.id] = (state.hands[p.id] || []).map(() => ({ hidden: true }));
    }
  });

  const validCards = state.phase === 'playing' && state.currentPlayer === socketId
    ? getValidCards(state.hands[socketId] || [], state.leadSuit).map(cardId)
    : [];

  return {
    phase: state.phase,
    hands: visibleHands,
    bids: state.bids,
    tricksWon: state.tricksWon,
    totalScores: state.totalScores,
    currentTrick: state.currentTrick,
    trickLeader: state.trickLeader,
    currentPlayer: state.currentPlayer,
    leadSuit: state.leadSuit,
    completedTricks: state.completedTricks,
    roundScores: state.roundScores,
    trickCount: state.trickCount,
    validCards,
    myId: socketId,
    players: players.map((p, i) => ({ id: p.id, name: p.name, seat: i, team: teamA.includes(i) ? 'A' : 'B' })),
    teammateId,
  };
}

function broadcastState(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.state) return;
  room.players.forEach(p => {
    const view = buildPlayerView(room.state, p.id, room.players);
    io.to(p.id).emit('gameState', view);
  });
}

// ─── REST ENDPOINTS ───────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/create-room', (_, res) => {
  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  rooms[code] = { players: [], state: null };
  res.json({ code });
});

app.get('/room/:code', (req, res) => {
  const room = rooms[req.params.code];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ playerCount: room.players.length, started: !!room.state });
});

// ─── SOCKET.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // JOIN ROOM
  socket.on('joinRoom', ({ roomCode, playerName }, cb) => {
    const room = rooms[roomCode];
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.players.length >= 4) return cb?.({ error: 'Room is full' });
    if (room.state) return cb?.({ error: 'Game already started' });

    const seat = room.players.length;
    room.players.push({ id: socket.id, name: playerName || `Player ${seat + 1}`, seat });
    socket.join(roomCode);

    console.log(`[Room ${roomCode}] ${playerName} joined (seat ${seat})`);

    io.to(roomCode).emit('playerJoined', {
      players: room.players.map((p, i) => ({
        id: p.id, name: p.name, seat: i,
        team: [0,1].includes(i) ? 'A' : 'B'
      })),
      playerCount: room.players.length,
    });

    cb?.({ ok: true, seat, playerId: socket.id });
  });

  // START GAME
  socket.on('startGame', ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.players.length !== 4) return cb?.({ error: 'Need 4 players' });
    if (room.state) return cb?.({ error: 'Already started' });

    room.state = createGameState(room.players);
    console.log(`[Room ${roomCode}] Game started`);

    broadcastState(roomCode);
    cb?.({ ok: true });
  });

  // PLACE BID
  socket.on('placeBid', ({ roomCode, bid }, cb) => {
    const room = rooms[roomCode];
    if (!room?.state) return cb?.({ error: 'No game' });
    const state = room.state;
    if (state.phase !== 'bidding') return cb?.({ error: 'Not bidding phase' });
    if (!VALID_BIDS.includes(Number(bid))) return cb?.({ error: 'Invalid bid' });

    state.bids[socket.id] = Number(bid);
    console.log(`[Room ${roomCode}] ${socket.id} bid ${bid}`);

    // Check if all bids placed
    const allBid = room.players.every(p => state.bids[p.id] !== null);
    if (allBid) {
      state.phase = 'playing';
    }

    broadcastState(roomCode);
    cb?.({ ok: true });
  });

  // PLAY CARD
  socket.on('playCard', ({ roomCode, cardStr }, cb) => {
    const room = rooms[roomCode];
    if (!room?.state) return cb?.({ error: 'No game' });
    const state = room.state;
    if (state.phase !== 'playing') return cb?.({ error: 'Not playing phase' });
    if (state.currentPlayer !== socket.id) return cb?.({ error: 'Not your turn' });

    const card = parseCardId(cardStr);
    const hand = state.hands[socket.id];
    const idx = hand.findIndex(c => cardId(c) === cardStr);
    if (idx === -1) return cb?.({ error: 'Card not in hand' });

    // Validate follow-suit
    const valid = getValidCards(hand, state.leadSuit).map(cardId);
    if (!valid.includes(cardStr)) return cb?.({ error: 'Must follow suit' });

    // Remove card from hand
    hand.splice(idx, 1);

    // Set lead suit on first card
    if (state.currentTrick.length === 0) {
      state.leadSuit = card.suit;
    }

    state.currentTrick.push({ playerId: socket.id, card });
    console.log(`[Room ${roomCode}] ${socket.id} played ${cardStr}`);

    // If 4 cards played, resolve trick
    if (state.currentTrick.length === 4) {
      const winnerId = determineTrickWinner(state.currentTrick, state.leadSuit);
      state.tricksWon[winnerId] = (state.tricksWon[winnerId] || 0) + 1;
      state.completedTricks.push({
        cards: [...state.currentTrick],
        winner: winnerId,
        leadSuit: state.leadSuit,
        trickNum: state.trickCount + 1,
      });
      state.trickCount++;

      io.to(roomCode).emit('trickComplete', {
        trick: state.currentTrick,
        winner: winnerId,
        winnerName: room.players.find(p => p.id === winnerId)?.name,
      });

      state.currentTrick = [];
      state.leadSuit = null;
      state.trickLeader = winnerId;
      state.currentPlayer = winnerId;

      // Check if round over
      if (state.trickCount === 13) {
        // Calculate scores
        state.roundScores = calculateScores(state.bids, state.tricksWon);
        room.players.forEach(p => {
          state.totalScores[p.id] = (state.totalScores[p.id] || 0) + state.roundScores[p.id];
        });
        state.phase = 'roundEnd';
      }
    } else {
      // Move to next player clockwise
      const seats = room.players.map(p => p.id);
      const idx2 = seats.indexOf(state.currentPlayer);
      state.currentPlayer = seats[(idx2 + 1) % 4];
    }

    broadcastState(roomCode);
    cb?.({ ok: true });
  });

  // NEW ROUND
  socket.on('newRound', ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.state) return cb?.({ error: 'No game' });
    if (room.state.phase !== 'roundEnd') return cb?.({ error: 'Round not over' });

    const prevTotals = { ...room.state.totalScores };
    room.state = createGameState(room.players);
    // Carry over total scores
    room.players.forEach(p => {
      room.state.totalScores[p.id] = prevTotals[p.id] || 0;
    });

    broadcastState(roomCode);
    cb?.({ ok: true });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const found = getRoomForSocket(socket.id);
    if (found) {
      const { code, room } = found;
      io.to(code).emit('playerLeft', { playerId: socket.id });
    }
  });
});

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`400 UNO Server running on port ${PORT}`);
});

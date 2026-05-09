// ============================================================
// 400 UNO — GAME LOGIC
// ============================================================

const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J,12=Q,13=K,14=A
const TRUMP_SUIT = 'H';
const VALID_BIDS = [2, 3, 4, 10, 12];

// Required tricks per bid
const BID_REQUIRED_TRICKS = { 2: 2, 3: 3, 4: 4, 10: 5, 12: 6 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealCards(deck) {
  const hands = [[], [], [], []];
  deck.forEach((card, i) => {
    hands[i % 4].push(card);
  });
  // Sort each hand
  return hands.map(hand =>
    hand.sort((a, b) => {
      const sOrder = ['H', 'D', 'C', 'S'];
      if (a.suit !== b.suit) return sOrder.indexOf(a.suit) - sOrder.indexOf(b.suit);
      return b.rank - a.rank;
    })
  );
}

function cardId(card) {
  return `${card.rank}${card.suit}`;
}

function parseCardId(id) {
  const suit = id.slice(-1);
  const rank = parseInt(id.slice(0, -1));
  return { suit, rank };
}

// Determine trick winner (0-indexed player positions in trickCards array)
function determineTrickWinner(trickCards, leadSuit) {
  // trickCards: [{playerId, card}, ...]
  let winner = trickCards[0];
  for (let i = 1; i < trickCards.length; i++) {
    const challenger = trickCards[i];
    if (beats(challenger.card, winner.card, leadSuit)) {
      winner = challenger;
    }
  }
  return winner.playerId;
}

function beats(challenger, current, leadSuit) {
  const cTrump = challenger.suit === TRUMP_SUIT;
  const curTrump = current.suit === TRUMP_SUIT;

  if (cTrump && !curTrump) return true;
  if (!cTrump && curTrump) return false;
  if (cTrump && curTrump) return challenger.rank > current.rank;

  // Both non-trump
  if (challenger.suit === leadSuit && current.suit !== leadSuit) return true;
  if (challenger.suit !== leadSuit && current.suit === leadSuit) return false;
  if (challenger.suit === leadSuit && current.suit === leadSuit) return challenger.rank > current.rank;
  return false;
}

function calculateScores(bids, tricksWon) {
  const scores = {};
  for (const pid of Object.keys(bids)) {
    const bid = bids[pid];
    const required = BID_REQUIRED_TRICKS[bid];
    const won = tricksWon[pid] || 0;
    if (won >= required) {
      scores[pid] = bid;
    } else {
      scores[pid] = -bid;
    }
  }
  return scores;
}

// Get valid cards a player can play given led suit and their hand
function getValidCards(hand, leadSuit) {
  if (!leadSuit) return hand; // Leading - any card valid
  const suitCards = hand.filter(c => c.suit === leadSuit);
  if (suitCards.length > 0) return suitCards;
  return hand; // No suit match - play anything
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
  cardId,
  parseCardId,
  determineTrickWinner,
  calculateScores,
  getValidCards,
  VALID_BIDS,
  BID_REQUIRED_TRICKS,
  TRUMP_SUIT,
};

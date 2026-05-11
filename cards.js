
const SC_HAND = 3;
const SC_PILE = 4;
const SC_MINI = 2;
const CW = 25, CH = 36;
const PW = CW * SC_HAND;
const PH = CH * SC_HAND;

const GLYPH = {
  '3': [[0,1,1,0],[0,0,0,1],[0,1,1,0],[0,0,0,1],[0,1,1,0]],
  '4': [[1,0,1,0],[1,0,1,0],[1,1,1,1],[0,0,1,0],[0,0,1,0]],
  '5': [[1,1,1,0],[1,0,0,0],[1,1,1,0],[0,0,0,1],[1,1,1,0]],
  '6': [[0,1,1,0],[1,0,0,0],[1,1,1,0],[1,0,0,1],[0,1,1,0]],
  '7': [[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0]],
  '8': [[0,1,1,0],[1,0,0,1],[0,1,1,0],[1,0,0,1],[0,1,1,0]],
  '9': [[0,1,1,0],[1,0,0,1],[0,1,1,1],[0,0,0,1],[0,1,1,0]],
  '0': [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  '1': [[0,1,0,0],[1,1,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  '2': [[0,1,1,0],[0,0,0,1],[0,1,1,0],[1,0,0,0],[1,1,1,1]],
  'A': [[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  'J': [[0,1,1,1],[0,0,1,0],[0,0,1,0],[1,0,1,0],[0,1,1,0]],
  'Q': [[0,1,1,0],[1,0,0,1],[1,0,1,1],[1,0,0,1],[0,1,1,1]],
  'K': [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
};

const DIAMOND = [
  [0,0,0,0,1,0,0,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,0,0,1,0,0,0,0],
];
const SPADE = [
  [0,0,0,0,1,0,0,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
];
const HEART = [
  [0,1,1,0,0,0,1,1,0],
  [1,1,1,1,0,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,0,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
];
const CLUB = [
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,0,1,1,1,0,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0],
];
const STAR = [
  [0,0,0,0,1,0,0,0,0],
  [0,0,0,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1],
  [0,0,1,1,1,1,1,0,0],
  [0,0,1,0,1,0,1,0,0],
  [0,1,0,0,1,0,0,1,0],
  [1,0,0,0,0,0,0,0,1],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
];
const SUIT_MAPS = { '♦': DIAMOND, '♠': SPADE, '♥': HEART, '♣': CLUB, '★': STAR };

const DIAMOND_S = [
  [0,0,1,0,0],
  [0,1,1,1,0],
  [1,1,1,1,1],
  [0,1,1,1,0],
  [0,0,1,0,0],
];
const SPADE_S = [
  [0,0,1,0,0],
  [0,1,1,1,0],
  [1,1,1,1,1],
  [0,0,1,0,0],
  [0,1,1,1,0],
];
const HEART_S = [
  [0,1,0,1,0],
  [1,1,1,1,1],
  [1,1,1,1,1],
  [0,1,1,1,0],
  [0,0,1,0,0],
];
const CLUB_S = [
  [0,0,1,0,0],
  [0,1,1,1,0],
  [0,0,1,0,0],
  [1,1,1,1,1],
  [0,0,1,0,0],
];
const STAR_S = [
  [0,0,1,0,0],
  [1,1,1,1,1],
  [0,1,1,1,0],
  [0,1,0,1,0],
  [1,0,0,0,1],
];
const SUIT_MAPS_S = { '♦': DIAMOND_S, '♠': SPADE_S, '♥': HEART_S, '♣': CLUB_S, '★': STAR_S };

function drawMiniSuit(ctx, suit, x, y, px, col) {
  const m = SUIT_MAPS_S[suit] || DIAMOND_S;
  ctx.fillStyle = col;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      if (m[r][c]) ctx.fillRect(x + c*px, y + r*px, px, px);
}

function isRed(s) { return s === '♥' || s === '♦'; }

function drawGlyph(ctx, ch, x, y, px, col) {
  const g = GLYPH[ch];
  if (!g) return;
  ctx.fillStyle = col;
  for (let r = 0; r < g.length; r++)
    for (let c = 0; c < g[r].length; c++)
      if (g[r][c]) ctx.fillRect(x + c * px, y + r * px, px, px);
}

function drawRank(ctx, rk, x, y, px, col) {
  if (rk === '10') {
    drawGlyph(ctx, '1', x,          y, px, col);
    drawGlyph(ctx, '0', x + 4 * px, y, px, col);
  } else {
    drawGlyph(ctx, rk, x, y, px, col);
  }
}

function drawSuit(ctx, suit, cx, cy, px, col) {
  const m  = SUIT_MAPS[suit] || DIAMOND;
  const ox = cx - Math.floor(9 * px / 2);
  const oy = cy - Math.floor(9 * px / 2);
  ctx.fillStyle = col;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (m[r] && m[r][c]) ctx.fillRect(ox + c * px, oy + r * px, px, px);
}

function _drawCardInto(ctx, card, sc, w, h) {
  if (card.r === 'JK') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, 0, w, sc);      ctx.fillRect(0, h - sc, w, sc);
    ctx.fillRect(0, 0, sc, h);      ctx.fillRect(w - sc, 0, sc, h);
    drawGlyph(ctx, 'J', sc * 2, sc * 2, sc, '#880000');
    drawGlyph(ctx, 'K', sc * 2, sc * 9, sc, '#222222');
    drawSuit(ctx, '★', Math.floor(w / 2), Math.floor(h / 2), Math.floor(sc * 2.5), '#cc8800');
    drawGlyph(ctx, 'J', w - sc * 6, h - sc * 16, sc, '#880000');
    drawGlyph(ctx, 'K', w - sc * 6, h - sc * 9,  sc, '#222222');
    return;
  }
  const col = isRed(card.s) ? '#8b0000' : '#1a1a1a';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(0, 0, w, sc);     ctx.fillRect(0, h - sc, w, sc);
  ctx.fillRect(0, 0, sc, h);     ctx.fillRect(w - sc, 0, sc, h);
  const rk = card.r;
  drawRank(ctx, rk, sc * 2, sc * 2, sc, col);
  const suitPx = Math.round(sc * 2.5);
  drawSuit(ctx, card.s, Math.floor(w / 2), Math.floor(h / 2), suitPx, col);
  const rkW = rk === '10' ? 8 : 4;
  drawRank(ctx, rk, w - rkW * sc - sc * 2, h - sc * 2 - sc * 6, sc, col);
}

const _cardSrcCache = new Map();
function _getCardSource(card, sc) {
  const key = card.r + card.s + ':' + sc;
  let src = _cardSrcCache.get(key);
  if (src) return src;
  const w = CW * sc, h = CH * sc;
  src = document.createElement('canvas');
  src.width = w; src.height = h;
  _drawCardInto(src.getContext('2d'), card, sc, w, h);
  _cardSrcCache.set(key, src);
  return src;
}

function makeCard(card, sc) {
  const w = CW * sc, h = CH * sc;
  const src = _getCardSource(card, sc);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}

const _backCache = new Map();
function _getBackSource(sc) {
  let src = _backCache.get(sc);
  if (src) return src;
  const w = CW * sc, h = CH * sc;
  src = document.createElement('canvas');
  src.width = w; src.height = h;
  const ctx = src.getContext('2d');
  ctx.fillStyle = '#1a0820'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#cc2266';
  ctx.fillRect(0, 0, w, sc);    ctx.fillRect(0, h - sc, w, sc);
  ctx.fillRect(0, 0, sc, h);    ctx.fillRect(w - sc, 0, sc, h);
  ctx.fillStyle = '#660033';
  ctx.fillRect(sc, sc, w - 2*sc, sc);    ctx.fillRect(sc, h - 2*sc, w - 2*sc, sc);
  ctx.fillRect(sc, sc, sc, h - 2*sc);    ctx.fillRect(w - 2*sc, sc, sc, h - 2*sc);
  ctx.fillStyle = '#3d0a25';
  for (let y = sc*3; y < h - sc*2; y += sc*4)
    for (let x = sc*3; x < w - sc*2; x += sc*4) {
      ctx.fillRect(x, y, sc, sc);
      ctx.fillRect(x + sc*2, y + sc*2, sc, sc);
    }
  _backCache.set(sc, src);
  return src;
}

function makeBack(sc) {
  const w = CW * sc, h = CH * sc;
  const src = _getBackSource(sc);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}

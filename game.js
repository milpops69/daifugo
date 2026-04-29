// ============================================================
//  game.js — DaiFugo game logic v8
// ============================================================

const SUITS_ARR  = ['♠','♥','♦','♣'];
const RANKS_ARR  = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const STR = {};
RANKS_ARR.forEach((r,i) => STR[r] = i);
STR['JK'] = 13;

const NAMES       = ['Вы','Бот 1','Бот 2','Бот 3'];

const JP_NAMES = [
  'Хару','Сора','Рэй','Кай','Юки','Аки','Нори','Тоши',
  'Мику','Сэн','Дайки','Рику','Мако','Кэн','Ная','Рин',
  'Асахи','Кота','Яма','Миу','Тая','Сэйя','Фуми','Тора'
];
// Each entry: emoji shown by default; PNG replaces it if the file exists
const AVATARS = [
  { src: 'av1.jpg', emoji: '🦦' },
  { src: 'av2.jpg', emoji: '🐕' },
  { src: 'av3.jpg', emoji: '🐈‍⬛' },
  { src: 'av4.jpg', emoji: '🐈' },
  { src: 'av5.jpg', emoji: '🐹' },
];
const RANK_NAMES  = ['Миллиардер','Миллионер','Бедняк','Нищий'];
const RANK_POINTS = [3,2,1,0];
const RCLS        = ['rb0','rb1','rb2','rb3'];
const RCLR        = ['#ff4499','#dd22aa','#ffcc44','#ff3366'];

let totalScores = [0,0,0,0];
let gamesPlayed = 0;
let prevRankings = null;

// ── SOUND ENGINE ──────────────────────────────────────────
const AC = (typeof AudioContext !== 'undefined') ? new AudioContext() : null;

function beep(freq, dur, type = 'square', vol = 0.12, delay = 0) {
  if (!AC) return;
  if (AC.state === 'suspended') AC.resume();
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.connect(g); g.connect(AC.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, AC.currentTime + delay);
  g.gain.setValueAtTime(vol, AC.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + delay + dur);
  o.start(AC.currentTime + delay);
  o.stop(AC.currentTime + delay + dur);
}

function sndSelect()     { beep(520, 0.04, 'square', 0.09); }
function sndDeselect()   { beep(380, 0.04, 'square', 0.08); }
function sndError()      { beep(140, 0.12, 'sawtooth', 0.16); beep(110, 0.1, 'sawtooth', 0.13, 0.11); }
function sndCard()       { beep(440, 0.06, 'square', 0.12); beep(660, 0.04, 'square', 0.07, 0.05); }
function sndPass()       { beep(220, 0.18, 'sawtooth', 0.07); }
function sndClear()      { beep(330, 0.1, 'square', 0.1); beep(220, 0.1, 'square', 0.08, 0.09); }
function sndWin() {
  const m = [
    [523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.18],
    [880, 0.10], [1047, 0.10], [1319, 0.30]
  ];
  let t = 0;
  m.forEach(([f, d]) => { beep(f, d, 'square', 0.16, t); t += d * 0.85; });
}
function sndLose() {
  const m = [
    [392, 0.16], [330, 0.16], [262, 0.16], [196, 0.30],
    [165, 0.34]
  ];
  let t = 0;
  m.forEach(([f, d]) => { beep(f, d, 'sawtooth', 0.13, t); t += d * 0.92; });
}
function sndRevolution() { [300,400,500,700,900].forEach((f,i) => beep(f, 0.18, 'square', 0.14, i*0.06)); }
function sndExchange()   { beep(660, 0.08, 'square', 0.1); beep(880, 0.08, 'square', 0.1, 0.1); }
function sndHover()      { beep(720, 0.025, 'square', 0.05); }
function sndClick()      { beep(960, 0.04, 'square', 0.09); beep(640, 0.05, 'square', 0.06, 0.03); }

function sndCardHover() {
  // soft triangle pluck — distinctly different from button hover
  beep(1320, 0.018, 'triangle', 0.05);
  beep(990,  0.04,  'triangle', 0.035, 0.018);
}

// Wire UI sounds — applies to buttons, back arrows, and player cards
document.addEventListener('mouseover', e => {
  const t = e.target.closest && e.target.closest('.px-btn,.sm-btn,.act-btn,.rules-back-btn,.mp-av');
  if (t && !t.disabled && t._hoverSnd !== true) {
    t._hoverSnd = true;
    sndHover();
    t.addEventListener('mouseleave', () => { t._hoverSnd = false; }, { once: true });
  }
  const cw = e.target.closest && e.target.closest('#hcards .card-wrap');
  if (cw && cw._hoverSnd !== true) {
    cw._hoverSnd = true;
    sndCardHover();
    cw.addEventListener('mouseleave', () => { cw._hoverSnd = false; }, { once: true });
  }
}, true);
document.addEventListener('mousedown', e => {
  const t = e.target.closest && e.target.closest('.px-btn,.sm-btn,.act-btn,.rules-back-btn,.mp-av');
  if (t && !t.disabled) sndClick();
}, true);

// ── HELPERS ───────────────────────────────────────────────
function myPlayer() { return (typeof MP !== 'undefined' && MP.active) ? MP.seat : 0; }

// Display position 0 = bottom (self); 1 = left sidebot; 2 = top strip; 3 = right sidebot.
// In MP, guest (seat=1) sees host (seat=0) in the left sidebot.
function displayOf(seat) {
  const mp = myPlayer();
  if (seat === mp) return 0;
  if (mp === 0) return seat;
  if (seat === 0) return 1;
  return seat;
}
function seatOf(disp) {
  const mp = myPlayer();
  if (disp === 0) return mp;
  if (mp === 0) return disp;
  if (disp === 1) return 0;
  return disp;
}

function cardStr(r, rev) {
  return r === 'JK' ? 14 : rev ? (12 - STR[r]) : STR[r];
}

function mkDeck() {
  const d = [];
  for (const s of SUITS_ARR)
    for (const r of RANKS_ARR)
      d.push({r, s, id: r+s, sel: false});
  d.push({r:'JK', s:'★', id:'JK1', sel:false});
  d.push({r:'JK', s:'★', id:'JK2', sel:false});
  return d;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length-1; i > 0; i--) {
    const j = 0|(Math.random()*(i+1));
    [b[i],b[j]] = [b[j],b[i]];
  }
  return b;
}

let G = {};
let GAME_GEN = 0;
let focusIdx = 0;
function gameAlive(gen) { return gen === GAME_GEN && G && !G.aborted; }

// ── NAV ──────────────────────────────────────────────────
function goTitle() {
  // Abort any in-flight game: invalidate timers, clear state, kill flying cards
  GAME_GEN++;
  if (G) G.aborted = true;
  G = { hands:[[],[],[],[]], currentCombo:null, pile:[], revolution:false,
        turn:0, passCount:0, finished:[], rankings:[], gameOver:true, busy:false,
        aborted:true };
  document.querySelectorAll('.toast').forEach(t => t.remove());
  document.querySelectorAll('.pas-bubble').forEach(b => b.remove());
  // remove flying card canvases stuck mid-animation
  document.querySelectorAll('body > canvas').forEach(c => c.remove());
  clearAllPas();
  document.getElementById('overlay').classList.add('h');
  document.getElementById('exchange-overlay').classList.add('h');
  if (typeof mpLeave === 'function') mpLeave();
  show('title');
}
function goRules()  { show('rules'); }
function goGame()   { show('game'); newGame(); }
function goOnline() {
  show('online');
  const w = document.getElementById('mp-waiting');
  if (w) w.style.display = 'none';
}
function show(id)   {
  ['title','rules','game','online'].forEach(s =>
    document.getElementById(s).classList.toggle('off', s !== id));
}

// title card decoration
(function() {
  const el = document.getElementById('title-cards');
  [{r:'A',s:'♠'},{r:'K',s:'♥'},{r:'JK',s:'★'},{r:'A',s:'♦'},{r:'K',s:'♣'}]
    .forEach(c => el.appendChild(makeCard(c, SC_HAND)));
})();

// title pixel background animation — always running
(function(){
  const cv = document.getElementById('title-bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const PALETTE = ['#ff4499','#dd22aa','#ffcc44','#ff88cc','#cc2266','#882266','#44ff88','#66e0ff'];
  const PIX = 8;
  let W = 0, H = 0, cols = 0, rows = 0;
  const cells = [];

  function ensureCells(){
    cols = Math.ceil(W / PIX) || 1;
    rows = Math.ceil(H / PIX) || 1;
    while (cells.length < 160) {
      cells.push({
        x: (Math.random()*cols)|0,
        y: (Math.random()*rows)|0,
        c: PALETTE[(Math.random()*PALETTE.length)|0],
        t: Math.random()*Math.PI*2,
        sp: 0.02 + Math.random()*0.06,
        life: 60 + (Math.random()*180)|0
      });
    }
  }

  function fit(){
    const w = cv.clientWidth  || window.innerWidth;
    const h = cv.clientHeight || window.innerHeight;
    if (w !== W || h !== H) {
      W = w; H = h;
      cv.width = W; cv.height = H;
      cols = Math.ceil(W / PIX) || 1;
      rows = Math.ceil(H / PIX) || 1;
    }
    ensureCells();
  }
  window.addEventListener('resize', fit);

  function tick(){
    fit();
    if (W && H) {
      ctx.clearRect(0,0,W,H);
      cells.forEach(p => {
        p.t += p.sp; p.life--;
        if (p.life <= 0 || p.x >= cols || p.y >= rows){
          p.x = (Math.random()*cols)|0;
          p.y = (Math.random()*rows)|0;
          p.c = PALETTE[(Math.random()*PALETTE.length)|0];
          p.life = 60 + (Math.random()*180)|0;
        }
        ctx.globalAlpha = (Math.sin(p.t)*0.5 + 0.5) * 0.55;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x*PIX, p.y*PIX, PIX, PIX);
      });
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (document.getElementById('game').classList.contains('off')) return;
  if (!document.getElementById('exchange-overlay').classList.contains('h')) return;
  const mp = myPlayer();
  const hand = (G.hands && G.hands[mp]) || [];

  if (e.code === 'ArrowLeft') {
    if (!hand.length) return;
    e.preventDefault();
    focusIdx = (focusIdx - 1 + hand.length) % hand.length;
    sndCardHover();
    render();
    return;
  }
  if (e.code === 'ArrowRight') {
    if (!hand.length) return;
    e.preventDefault();
    focusIdx = (focusIdx + 1) % hand.length;
    sndCardHover();
    render();
    return;
  }

  if (G.gameOver || G.busy) return;
  if (G.turn !== mp || G.finished.includes(mp)) return;

  if (e.code === 'ArrowUp') {
    if (!hand.length) return;
    e.preventDefault();
    if (focusIdx >= hand.length) focusIdx = hand.length - 1;
    if (!hand[focusIdx].sel) { hand[focusIdx].sel = true; sndSelect(); render(); }
    return;
  }
  if (e.code === 'ArrowDown') {
    if (!hand.length) return;
    e.preventDefault();
    if (focusIdx >= hand.length) focusIdx = hand.length - 1;
    if (hand[focusIdx].sel) { hand[focusIdx].sel = false; sndDeselect(); render(); }
    return;
  }
  if (e.code === 'Space' || e.key === 'p' || e.key === 'п') {
    e.preventDefault();
    playerPass();
  } else if (e.code === 'Enter') {
    e.preventDefault();
    playerPlaySelected();
  }
});

// ── NEW GAME ──────────────────────────────────────────────
function newGame() {
  document.getElementById('overlay').classList.add('h');
  document.getElementById('exchange-overlay').classList.add('h');
  clearAllPas();
  assignBotPersonalities();

  for (let i = 1; i <= 3; i++) {
    const rb = document.getElementById('rb-' + i);
    if (rb) { rb.className = 'chip-badge'; rb.textContent = ''; rb.style.display = 'none'; }
    const rb2 = document.getElementById('brb-' + i);
    if (rb2) { rb2.className = 'bot-rbadge'; rb2.textContent = ''; rb2.style.display = 'none'; }
  }
  updateScoreDisplay();

  const deck = shuffle(mkDeck());
  const hands = [[],[],[],[]];
  deck.forEach((c,i) => hands[i%4].push(c));
  hands.forEach(h => h.sort((a,b) => STR[a.r]-STR[b.r]));

  if (prevRankings && prevRankings.length === 4) {
    showExchange(hands, prevRankings);
    return;
  }

  startGameWithHands(hands);
}

function startGameWithHands(hands) {
  let start = hands.findIndex(h => h.some(c => c.r==='3' && c.s==='♠'));
  if (start < 0) start = 0;

  focusIdx = 0;
  GAME_GEN++;
  G = {
    hands, currentCombo: null, pile: [],
    revolution: false, turn: start,
    passCount: 0, finished: [], rankings: [],
    gameOver: false, busy: false, aborted: false,
    roundNum: gamesPlayed + 1
  };

  render();
  if (G.turn !== myPlayer()) schedBot();
}

// ── CARD EXCHANGE ─────────────────────────────────────────
let pendingHands = null;
let exchangeGiving = [];   // cards player will give
let exchangeReceiving = []; // cards player will receive
let exchangeMode = null;   // 'give2', 'give1', 'receive', null

function showExchange(hands, rankings) {
  pendingHands = hands;
  exchangeGiving = [];
  exchangeReceiving = [];
  exchangeMode = null;

  const byRank = {};
  rankings.forEach(({player, rank}) => byRank[rank] = player);
  const p0 = byRank[0]; // Богач
  const p3 = byRank[3]; // Нищий
  const p1 = byRank[1]; // Богатый
  const p2 = byRank[2]; // Бедняк

  // Bots auto-exchange; player participates
  if (p0 === 0) {
    // Player is Богач — must give away 2 cards (choose any)
    exchangeMode = 'give2';
    exchangeReceiving = hands[p3].slice(-2).map(c => ({...c}));
    // Remove those from bot's hand
    exchangeReceiving.forEach(card => {
      const i = hands[p3].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p3].splice(i, 1);
    });
    // Bot p1 gives 1 worst to p2, p2 gives 1 best to p1
    doAutoExchange(hands, p1, p2, 1);
  } else if (p3 === 0) {
    // Player is Нищий — must give 2 best cards (forced)
    exchangeMode = 'receive';
    exchangeGiving = hands[0].slice(-2).map(c => ({...c}));
    exchangeGiving.forEach(card => {
      const i = hands[0].findIndex(c => c.id === card.id);
      if (i >= 0) hands[0].splice(i, 1);
    });
    exchangeReceiving = hands[p0].slice(0, 2).map(c => ({...c}));
    exchangeReceiving.forEach(card => {
      const i = hands[p0].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p0].splice(i, 1);
    });
    hands[p0].push(...exchangeGiving.map(c => ({...c, sel:false})));
    hands[0].push(...exchangeReceiving.map(c => ({...c, sel:false})));
    doAutoExchange(hands, p1, p2, 1);
    exchangeMode = 'viewonly';
  } else if (p1 === 0) {
    // Player is Богатый — give 1 worst card
    exchangeMode = 'give1';
    exchangeReceiving = hands[p2].slice(-1).map(c => ({...c}));
    exchangeReceiving.forEach(card => {
      const i = hands[p2].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p2].splice(i, 1);
    });
    doAutoExchange(hands, p0, p3, 2);
  } else {
    // Player is Бедняк — give 1 best card (forced)
    exchangeMode = 'viewonly';
    exchangeGiving = hands[0].slice(-1).map(c => ({...c}));
    exchangeGiving.forEach(card => {
      const i = hands[0].findIndex(c => c.id === card.id);
      if (i >= 0) hands[0].splice(i, 1);
    });
    exchangeReceiving = hands[p1].slice(0, 1).map(c => ({...c}));
    exchangeReceiving.forEach(card => {
      const i = hands[p1].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p1].splice(i, 1);
    });
    hands[p1].push(...exchangeGiving.map(c => ({...c, sel:false})));
    hands[0].push(...exchangeReceiving.map(c => ({...c, sel:false})));
    doAutoExchange(hands, p0, p3, 2);
  }

  renderExchangeUI(rankings);
  document.getElementById('exchange-overlay').classList.remove('h');
}

function doAutoExchange(hands, rich, poor, count) {
  const give = hands[rich].slice(0, count).map(c => ({...c}));
  const recv = hands[poor].slice(-count).map(c => ({...c}));
  give.forEach(card => {
    const i = hands[rich].findIndex(c => c.id === card.id);
    if (i >= 0) hands[rich].splice(i, 1);
  });
  recv.forEach(card => {
    const i = hands[poor].findIndex(c => c.id === card.id);
    if (i >= 0) hands[poor].splice(i, 1);
  });
  hands[rich].push(...recv.map(c => ({...c, sel:false})));
  hands[poor].push(...give.map(c => ({...c, sel:false})));
}

function renderExchangeUI(rankings) {
  const byRank = {};
  rankings.forEach(({player, rank}) => byRank[rank] = player);
  const p0 = byRank[0];

  const title = document.getElementById('ex-title');
  const body  = document.getElementById('ex-body');
  const hand  = document.getElementById('ex-hand');
  const btn   = document.getElementById('ex-btn');

  if (exchangeMode === 'give2') {
    title.textContent = '◈ ОБМЕН КАРТАМИ ◈';
    body.innerHTML = '<span style="color:#ffcc44">Вы — Миллиардер!</span> Выберите 2 карты для передачи Нищему.<br><span style="color:#ff88cc">Получаете:</span> ' +
      exchangeReceiving.map(c => c.r + c.s).join(', ');
    btn.textContent = '✓ ПОДТВЕРДИТЬ';
    btn.disabled = true;
    renderExchangeHand();
  } else if (exchangeMode === 'give1') {
    title.textContent = '◈ ОБМЕН КАРТАМИ ◈';
    body.innerHTML = '<span style="color:#dd22aa">Вы — Миллионер!</span> Выберите 1 карту для передачи Бедняку.<br><span style="color:#ff88cc">Получаете:</span> ' +
      exchangeReceiving.map(c => c.r + c.s).join(', ');
    btn.textContent = '✓ ПОДТВЕРДИТЬ';
    btn.disabled = true;
    renderExchangeHand();
  } else {
    // viewonly
    const rank0 = rankings.findIndex(r => r.player === 0);
    const rankName = RANK_NAMES[rank0];
    const clr = RCLR[rank0];
    title.textContent = '◈ ОБМЕН КАРТАМИ ◈';
    body.innerHTML = `<span style="color:${clr}">Вы — ${rankName}.</span><br>` +
      (exchangeGiving.length ? 'Отдали: ' + exchangeGiving.map(c => c.r+c.s).join(', ') + '<br>' : '') +
      (exchangeReceiving.length ? '<span style="color:#ff88cc">Получили: ' + exchangeReceiving.map(c => c.r+c.s).join(', ') + '</span>' : '');
    btn.textContent = '▶ НАЧАТЬ ИГРУ';
    btn.disabled = false;
    hand.innerHTML = '';
  }
}

function renderExchangeHand() {
  const hand = document.getElementById('ex-hand');
  hand.innerHTML = '';
  const need = exchangeMode === 'give2' ? 2 : 1;
  pendingHands[0].forEach((c, i) => {
    const wrap = document.createElement('div');
    const isSelected = c.exSel;
    wrap.className = 'ex-card-wrap' + (isSelected ? ' ex-sel' : '');
    wrap.appendChild(makeCard(c, SC_HAND));
    wrap.addEventListener('click', () => {
      if (c.exSel) {
        c.exSel = false;
      } else {
        const selCount = pendingHands[0].filter(x => x.exSel).length;
        if (selCount < need) c.exSel = true;
      }
      const selCount = pendingHands[0].filter(x => x.exSel).length;
      document.getElementById('ex-btn').disabled = selCount !== need;
      renderExchangeHand();
    });
    hand.appendChild(wrap);
  });
}

function confirmExchange() {
  const btn = document.getElementById('ex-btn');
  if (btn.disabled) return;

  if (exchangeMode === 'give2' || exchangeMode === 'give1') {
    const selected = pendingHands[0].filter(c => c.exSel);
    selected.forEach(card => {
      card.exSel = false;
      const i = pendingHands[0].findIndex(c => c.id === card.id);
      if (i >= 0) pendingHands[0].splice(i, 1);
    });
    pendingHands[0].push(...exchangeReceiving.map(c => ({...c, sel:false, exSel:false})));
  }

  pendingHands.forEach(h => h.sort((a,b) => STR[a.r]-STR[b.r]));
  document.getElementById('exchange-overlay').classList.add('h');
  sndExchange();
  startGameWithHands(pendingHands);
  pendingHands = null;
}

function updateScoreDisplay() {}

// ── BOT PERSONALITIES ─────────────────────────────────────
function setAvatar(el, av) {
  if (!el) return;
  // Show emoji immediately (always works)
  el.textContent = av.emoji;
  // Silently try to load the PNG; replace emoji if it loads
  const img = document.createElement('img');
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block;';
  img.onload  = () => { el.textContent = ''; el.appendChild(img); };
  img.onerror = () => { /* keep emoji */ };
  img.src = av.src;
}

const BOT_COLORS = ['#4488ff','#44ff88','#ffaa44','#cc66ff','#ff6688','#66e0ff','#ffcc44','#aaff66'];

function assignBotPersonalities() {
  const namePool = shuffle([...JP_NAMES]).slice(0, 3);
  const avPool   = shuffle([...AVATARS]).slice(0, 3);
  const colPool  = shuffle([...BOT_COLORS]).slice(0, 3);

  // disp position 1 = left sidebot, 2 = top strip, 3 = right sidebot
  const slots = [
    { disp: 1, avEl: 'av-1', nmEl: 'cn-1' },
    { disp: 2, avEl: 'av-2', nmEl: 'cn-2' },
    { disp: 3, avEl: 'av-3', nmEl: 'cn-3' },
  ];
  const inMP = (typeof MP !== 'undefined' && MP.active);

  slots.forEach((s, i) => {
    const seat = seatOf(s.disp);
    let name, avatar, accent;
    if (inMP && seat !== myPlayer() && (seat === 0 || seat === 1) && MP.peer) {
      // human opponent — use their chosen profile
      name   = MP.peer.name || 'Игрок';
      avatar = AVATARS[Math.max(0, Math.min(AVATARS.length-1, MP.peer.avatar|0))];
      accent = colPool[i];
    } else {
      name   = namePool[i];
      avatar = avPool[i];
      accent = colPool[i];
    }
    NAMES[seat] = name;
    const nm = document.getElementById(s.nmEl);
    if (nm) nm.textContent = name;
    const avEl = document.getElementById(s.avEl);
    setAvatar(avEl, avatar);
    if (avEl) avEl.style.setProperty('--bot-accent', accent);
  });
}

// ── RENDER ────────────────────────────────────────────────
function render() {
  renderCounts();
  renderHand();
  renderBotHands();
  renderPile();
  renderActive();
  renderStatus();
  if (typeof mpSendState === 'function' && typeof MP !== 'undefined' && MP.active && MP.seat === 0)
    mpSendState();
}

function renderCounts() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('cc-' + i);
    if (el) el.textContent = G.hands[i].length ? G.hands[i].length + ' кар' : '';
    const bc = document.getElementById('bc-' + i);
    if (bc) bc.textContent = G.hands[i].length ? G.hands[i].length + ' кар' : '';
  }
}

function renderBotHands() {
  [1,2,3].forEach(disp => {
    const el = document.getElementById('bot-hand-' + disp);
    if (!el) return;
    el.innerHTML = '';
    const seat = seatOf(disp);
    const n = G.hands[seat].length;
    if (!n) return;
    const done = G.finished.includes(seat);
    for (let k = 0; k < n; k++) {
      const w = document.createElement('div');
      w.className = 'bot-card-back';
      w.style.opacity = done ? '0.3' : '1';
      w.appendChild(makeBack(SC_MINI));
      el.appendChild(w);
    }
  });
}

function canCardBeat(card) {
  if (!G.currentCombo) return true;
  return cardStr(card.r, G.revolution) > cardStr(G.currentCombo.rank, G.revolution);
}

function renderHand() {
  const mp = myPlayer();
  const el = document.getElementById('hcards');
  el.innerHTML = '';
  const hand = G.hands[mp];
  if (focusIdx >= hand.length) focusIdx = Math.max(0, hand.length - 1);

  hand.forEach((c, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'card-wrap' + (c.sel ? ' sel' : '') + (i === focusIdx ? ' focus' : '');
    wrap.dataset.idx = i;
    wrap.appendChild(makeCard(c, SC_HAND));
    wrap.addEventListener('click', () => { if (!isDragging) { focusIdx = i; toggleCard(i); } });
    wrap.addEventListener('mouseenter', () => { focusIdx = i; });
    wrap.addEventListener('mousedown', e => startDrag(e, i, wrap, c));
    el.appendChild(wrap);
  });
  // scroll focused card into view if hand overflows
  const focusEl = el.children[focusIdx];
  if (focusEl) focusEl.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function renderPile() {
  const pc = document.getElementById('pcards');
  pc.innerHTML = '';
  if (G.currentCombo && G.currentCombo.cards.length) {
    G.currentCombo.cards.forEach(c => {
      const w = document.createElement('div');
      w.className = 'pile-card-wrap';
      w.appendChild(makeCard(c, SC_PILE));
      pc.appendChild(w);
    });
  }
  document.getElementById('rev-badge').style.display = G.revolution ? 'block' : 'none';
}

function renderActive() {
  const seat2 = seatOf(2);
  const ch2 = document.getElementById('chip-2');
  if (ch2) {
    ch2.classList.toggle('active', G.turn===seat2 && !G.finished.includes(seat2));
    ch2.classList.toggle('done', G.finished.includes(seat2));
  }
  [1,3].forEach(disp => {
    const seat = seatOf(disp);
    const sb = document.getElementById('pa-' + disp);
    if (!sb) return;
    sb.classList.toggle('active', G.turn===seat && !G.finished.includes(seat));
    sb.classList.toggle('done', G.finished.includes(seat));
  });
  const mp2 = myPlayer();
  const my = G.turn===mp2 && !G.finished.includes(mp2) && !G.gameOver && !G.busy;
  document.getElementById('bps').disabled = !my;
  document.getElementById('bplay').disabled = !my;
}

function renderStatus() {}

// ── DRAG & DROP ───────────────────────────────────────────
let isDragging = false;
let dragData   = null;

function startDrag(e, idx, wrap, card) {
  const mp = myPlayer();
  if (G.turn!==mp||G.finished.includes(mp)||G.gameOver||G.busy) return;
  e.preventDefault(); isDragging = false;
  const sel       = G.hands[mp].filter(c => c.sel);
  const dragCards = card.sel && sel.length > 1 ? sel : [card];
  dragData = { cards: dragCards, startX: e.clientX, startY: e.clientY };

  const ghost = document.getElementById('drag-ghost');
  ghost.innerHTML = '';
  ghost.appendChild(makeCard(dragCards[0], SC_HAND));
  ghost.style.display = 'block';
  ghost.style.left = (e.clientX - PW/2) + 'px';
  ghost.style.top  = (e.clientY - PH/2) + 'px';

  const dz = document.getElementById('dropzone');
  const onMove = ev => {
    if (Math.abs(ev.clientX-dragData.startX)>5||Math.abs(ev.clientY-dragData.startY)>5) isDragging=true;
    ghost.style.left = (ev.clientX - PW/2) + 'px';
    ghost.style.top  = (ev.clientY - PH/2) + 'px';
    const r = dz.getBoundingClientRect();
    dz.classList.toggle('dragover',
      ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom);
  };
  const onUp = ev => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    ghost.style.display = 'none';
    dz.classList.remove('dragover');
    const r = dz.getBoundingClientRect();
    if (ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom&&isDragging)
      tryPlayerPlay(dragData.cards);
    isDragging = false; dragData = null;
    wrap.classList.remove('dragging');
  };
  wrap.classList.add('dragging');
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

function tryPlayerPlay(cards) {
  const res = validate(cards);
  if (!res.ok) { sndError(); toast(res.msg); return; }
  sndCard();
  flyCards(cards, getPlayerCardPositions(cards), () => commitPlay(0, cards, res));
}

function playerPlaySelected() {
  const mp = myPlayer();
  if (G.turn!==mp||G.finished.includes(mp)||G.gameOver||G.busy) return;
  const sel = G.hands[mp].filter(c => c.sel);
  if (!sel.length) { toast('ВЫБЕРИТЕ КАРТЫ'); return; }
  if (mp === 1 && typeof mpGuestPlay === 'function') { mpGuestPlay(sel.map(c => c.id)); return; }
  tryPlayerPlay(sel);
}

function getPlayerCardPositions(cards) {
  const mp = myPlayer();
  const wraps = [...document.getElementById('hcards').querySelectorAll('.card-wrap')];
  return cards.map(card => {
    const wrap = wraps.find(w => G.hands[mp][+w.dataset.idx]?.id === card.id);
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return null;
  });
}

function getBotPos(who) {
  const disp = displayOf(who);
  const el = document.getElementById('chip-' + disp) || document.getElementById('pa-' + disp);
  if (el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
  return { x: window.innerWidth/2, y: 60 };
}

function flyCards(cards, srcPositions, cb) {
  const dz  = document.getElementById('dropzone');
  const dzR = dz.getBoundingClientRect();
  const tx  = dzR.left + dzR.width/2;
  const ty  = dzR.top  + dzR.height/2;
  const gen = GAME_GEN;

  let pending = cards.length;
  if (!pending) { cb(); return; }

  cards.forEach((card, ci) => {
    const src = srcPositions ? srcPositions[ci] : null;
    const sx  = src ? src.x : tx;
    const sy  = src ? src.y : ty;
    const ox  = (ci - (cards.length-1)/2) * 36;

    const cv = makeCard(card, SC_HAND);
    cv.style.position       = 'fixed';
    cv.style.left           = (sx - PW/2) + 'px';
    cv.style.top            = (sy - PH/2) + 'px';
    cv.style.zIndex         = '999';
    cv.style.pointerEvents  = 'none';
    cv.style.imageRendering = 'pixelated';
    const initRot = (Math.random()-0.5)*20;
    cv.style.transform      = `scale(0.95) rotate(${initRot}deg)`;
    document.body.appendChild(cv);

    const delay = ci * 50;
    setTimeout(() => {
      cv.style.transition =
        `left .32s cubic-bezier(.22,1,.36,1) ${delay}ms,` +
        `top .32s cubic-bezier(.22,1,.36,1) ${delay}ms,` +
        `transform .32s ease ${delay}ms`;
      cv.style.left      = (tx - PW/2 + ox) + 'px';
      cv.style.top       = (ty - PH/2) + 'px';
      cv.style.transform = `scale(0.88) rotate(${(Math.random()*6-3)}deg)`;
    }, 10);

    setTimeout(() => {
      cv.remove();
      if (--pending === 0) {
        if (gameAlive(gen)) cb();
      }
    }, 370 + delay);
  });
}

// ── PLAYER ACTIONS ────────────────────────────────────────
function toggleCard(idx) {
  const mp = myPlayer();
  if (G.turn!==mp||G.finished.includes(mp)||G.gameOver||G.busy) return;
  const wasSelected = G.hands[mp][idx].sel;
  G.hands[mp][idx].sel = !wasSelected;
  wasSelected ? sndDeselect() : sndSelect();
  render();
}

function playerPass() {
  const mp = myPlayer();
  if (G.turn!==mp||G.finished.includes(mp)||G.gameOver||G.busy) return;
  if (mp === 1 && typeof mpGuestPass === 'function') { mpGuestPass(); return; }
  sndPass();
  doPass(mp);
}

// ── VALIDATE ──────────────────────────────────────────────
function validate(cards) {
  if (!cards.length) return {ok:false, msg:'НЕТ КАРТ'};
  const jk = cards.filter(c => c.r==='JK');
  const nr = cards.filter(c => c.r!=='JK');
  let rank, count = cards.length;
  if (cards.length===1 && jk.length===1) { rank='JK'; }
  else if (nr.length) {
    const r0 = nr[0].r;
    if (nr.some(c => c.r!==r0)) return {ok:false, msg:'РАЗНЫЕ РАНГИ!'};
    rank = r0;
  } else return {ok:false, msg:'НЕЛЬЗЯ'};
  if (G.currentCombo) {
    if (count !== G.currentCombo.count)
      return {ok:false, msg:'НУЖНО '+G.currentCombo.count+' КАР'};
    if (cardStr(rank,G.revolution) <= cardStr(G.currentCombo.rank,G.revolution))
      return {ok:false, msg:'СЛАБЕЕ!'};
  }
  return {ok:true, rank, count};
}

// ── COMMIT PLAY ───────────────────────────────────────────
function commitPlay(who, cards, res) {
  clearAllPas();
  const hand = G.hands[who];
  for (const c of cards) {
    const i = hand.findIndex(h => h.id===c.id);
    if (i >= 0) hand.splice(i,1);
  }
  hand.forEach(c => c.sel=false);
  G.currentCombo = {cards:[...cards], rank:res.rank, count:res.count};
  G.pile.push(G.currentCombo);
  G.passCount = 0;

  if (res.count===4 && res.rank!=='JK') {
    G.revolution = !G.revolution;
    sndRevolution();
    toast(G.revolution ? '⚡ РЕВОЛЮЦИЯ!' : '⚡ КОНТР-РЕВ!');
  }
  if (res.rank==='8') {
    render();
    const gen = GAME_GEN;
    setTimeout(() => {
      if (!gameAlive(gen)) return;
      sndClear();
      toast('8 — СТОП!');
      G.currentCombo=null; G.pile=[]; G.passCount=0; clearAllPas();
      if (!hand.length) { finishPlayer(who); return; }
      render(); if (who!==myPlayer()) schedBot();
    }, 400);
    return;
  }
  if (!hand.length) { render(); finishPlayer(who); return; }
  nextTurn(who);
}

// ── PASS ──────────────────────────────────────────────────
function showPas(who) {
  showPasBubble(who);
}

function showPasBubble(who) {
  const disp = displayOf(who);
  const av = document.getElementById('av-' + disp);
  if (!av) return;
  const r = av.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'pas-bubble';
  b.textContent = 'ПАС';
  document.body.appendChild(b);
  // size the bubble first (appended offscreen-ish)
  const bw = b.offsetWidth, bh = b.offsetHeight;
  let left, top, tail;
  if (disp === 2) {
    left = r.left + r.width/2 - bw/2;
    top  = r.bottom + 16;
  } else if (disp === 1) {
    left = r.right + 16;
    top  = r.top + r.height/2 - bh/2;
    b.classList.add('tail-left');
  } else {
    left = r.left - bw - 16;
    top  = r.top + r.height/2 - bh/2;
    b.classList.add('tail-right');
  }
  // Clamp to viewport
  left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
  top  = Math.max(8, Math.min(top,  window.innerHeight - bh - 8));
  b.style.left = left + 'px';
  b.style.top  = top + 'px';
  if (disp === 2) {
    const tip = document.createElement('div');
    tip.style.cssText = `position:absolute;left:50%;top:-19px;margin-left:-8px;
      width:0;height:0;border:8px solid transparent;border-bottom-color:var(--rose);`;
    const tip2 = document.createElement('div');
    tip2.style.cssText = `position:absolute;left:50%;top:-14px;margin-left:-8px;
      width:0;height:0;border:8px solid transparent;border-bottom-color:rgba(20,5,15,.96);`;
    b.appendChild(tip); b.appendChild(tip2);
  }
  setTimeout(() => b.remove(), 1950);
}

function clearAllPas() {
  for (let i=1; i<4; i++) {
    const cp = document.getElementById('pas-'+i); if (cp) cp.classList.remove('show');
    const sl = document.getElementById('pasl-'+i); if (sl) sl.classList.remove('show');
  }
}

function doPass(who) {
  if (who !== 0) showPas(who);
  G.passCount++;
  const active = 4 - G.finished.length;
  if (G.currentCombo && G.passCount >= active-1) {
    render();
    const gen = GAME_GEN;
    setTimeout(() => {
      if (!gameAlive(gen)) return;
      sndClear();
      toast('СТОЛ ОЧИЩЕН');
      G.currentCombo=null; G.pile=[]; G.passCount=0; clearAllPas();
      G.turn = nextActive(who); render();
      if (G.turn!==myPlayer()) schedBot();
    }, 300);
    return;
  }
  if (!G.currentCombo && G.passCount >= active) { G.passCount=0; render(); return; }
  nextTurn(who);
}

function nextTurn(from) {
  G.turn = nextActive(from); render();
  if (G.turn!==myPlayer() && !G.gameOver) schedBot();
}

function nextActive(from) {
  let n=(from+1)%4, t=0;
  while (G.finished.includes(n) && t<4) { n=(n+1)%4; t++; }
  return n;
}

// ── FINISH PLAYER ─────────────────────────────────────────
function finishPlayer(who) {
  G.finished.push(who);
  const ri = G.rankings.length;
  G.rankings.push({player:who, rank:ri});

  const dispWho = displayOf(who);
  const rb = document.getElementById('rb-'+dispWho);
  if (rb) { rb.className='chip-badge '+RCLS[ri]; rb.textContent=RANK_NAMES[ri]; rb.style.display='inline-block'; }
  const rb2 = document.getElementById('brb-'+dispWho);
  if (rb2) { rb2.className='bot-rbadge '+RCLS[ri]; rb2.textContent=RANK_NAMES[ri]; rb2.style.display='inline-block'; }

  toast(NAMES[who]+': '+RANK_NAMES[ri]+'!');

  if (4-G.finished.length<=1) {
    for (let i=0; i<4; i++) if (!G.finished.includes(i)) {
      G.finished.push(i);
      G.rankings.push({player:i, rank:G.rankings.length});
      const ri2 = G.rankings.length-1;
      const dispI = displayOf(i);
      const rb3 = document.getElementById('rb-'+dispI);
      if (rb3) { rb3.className='chip-badge '+RCLS[ri2]; rb3.textContent=RANK_NAMES[ri2]; rb3.style.display='inline-block'; }
      const brb3 = document.getElementById('brb-'+dispI);
      if (brb3) { brb3.className='bot-rbadge '+RCLS[ri2]; brb3.textContent=RANK_NAMES[ri2]; brb3.style.display='inline-block'; }
    }
    G.gameOver=true; render();
    const gen2 = GAME_GEN;
    setTimeout(() => { if (gameAlive(gen2)) showResults(); }, 1400);
    return;
  }
  nextTurn(who);
}

// ── RESULTS ───────────────────────────────────────────────
function showResults() {
  gamesPlayed++;
  G.rankings.forEach(({player,rank}) => totalScores[player]+=RANK_POINTS[rank]);
  prevRankings = [...G.rankings];

  // Победная или проигрышная мелодия — по результату игрока
  const me = myPlayer();
  const myRow = G.rankings.find(r => r.player === me);
  if (myRow) {
    if (myRow.rank <= 1) sndWin();
    else                 sndLose();
  }

  document.getElementById('rsub').textContent =
    'Победитель: '+NAMES[G.rankings[0].player]+' (Миллиардер)';
  const el = document.getElementById('rrows'); el.innerHTML='';
  G.rankings.forEach(({player,rank},i) => {
    const d = document.createElement('div'); d.className='rrow';
    d.innerHTML =
      `<div class="rnum" style="color:${RCLR[i]}">${i+1}</div>`+
      `<div style="flex:1">${NAMES[player]}</div>`+
      `<div style="color:${RCLR[i]};font-size:16px;min-width:90px;text-align:right">${RANK_NAMES[rank]}</div>`;
    el.appendChild(d);
  });
  updateScoreDisplay();
  document.getElementById('overlay').classList.remove('h');
}

// ── BOT AI ────────────────────────────────────────────────
function schedBot() {
  if (G.busy) return; G.busy=true;
  const gen = GAME_GEN;
  setTimeout(() => {
    if (!gameAlive(gen)) return;
    G.busy=false;
    if (!G.gameOver && G.turn!==myPlayer() && !G.finished.includes(G.turn)) botTurn(G.turn);
  }, 600 + Math.random()*700);
}

function botTurn(who) {
  const hand = G.hands[who];
  const move = botChoose(who, hand);
  if (move) {
    const res = validate(move);
    if (res.ok) {
      const botPos = getBotPos(who);
      const srcPositions = move.map(() => ({ x: botPos.x, y: botPos.y }));
      for (const c of move) {
        const i = hand.findIndex(h => h.id===c.id);
        if (i>=0) hand.splice(i,1);
      }
      renderCounts();
      renderBotHands();
      sndCard();
      const moveCopy = move.map(c => ({...c}));
      flyCards(moveCopy, srcPositions, () => {
        clearAllPas();
        G.currentCombo = {cards:[...moveCopy], rank:res.rank, count:res.count};
        G.pile.push(G.currentCombo); G.passCount=0;
        if (res.count===4 && res.rank!=='JK') {
          G.revolution=!G.revolution;
          sndRevolution();
          toast(G.revolution?'⚡ РЕВОЛЮЦИЯ!':'⚡ КОНТР-РЕВ!');
        }
        if (res.rank==='8') {
          render();
          const gen8 = GAME_GEN;
          setTimeout(()=>{
            if (!gameAlive(gen8)) return;
            sndClear(); toast('8 — СТОП!');
            G.currentCombo=null; G.pile=[]; G.passCount=0; clearAllPas();
            if(!hand.length){finishPlayer(who);return;}
            render(); schedBot();
          },400); return;
        }
        if(!hand.length){render();finishPlayer(who);return;}
        nextTurn(who);
      });
      return;
    }
  }
  sndPass();
  doPass(who);
}

function botChoose(who, hand) {
  const jk = hand.filter(c=>c.r==='JK');
  const nr = hand.filter(c=>c.r!=='JK');
  const gr = {};
  nr.forEach(c => { if(!gr[c.r]) gr[c.r]=[]; gr[c.r].push(c); });

  const endGame = hand.length <= 4;
  const sorted  = Object.entries(gr).sort((a,b)=>STR[a[0]]-STR[b[0]]);

  if (!G.currentCombo) {
    const quads  = sorted.filter(([,cs])=>cs.length>=4);
    const triples= sorted.filter(([,cs])=>cs.length>=3);
    const pairs  = sorted.filter(([,cs])=>cs.length>=2);

    // Play quad if revolution would help (we have many low cards)
    if (quads.length && !G.revolution) {
      const lowCount = nr.filter(c=>STR[c.r]<5).length;
      if (lowCount >= 4 || endGame) return quads[0][1].slice(0,4);
    }

    if (endGame) {
      // Rush to finish: play anything
      if (sorted.length) return [sorted[0][1][0]];
      return jk.length ? [jk[0]] : null;
    }

    // Prefer pairs for board control over singles
    if (pairs.length) return pairs[0][1].slice(0,2);
    if (sorted.length) return [sorted[0][1][0]];
    if (jk.length) return [jk[0]];
    return null;
  }

  const need = G.currentCombo.count;
  const curS = cardStr(G.currentCombo.rank, G.revolution);
  const cands = [];

  Object.entries(gr).forEach(([r,cs])=>{
    if (cs.length >= need) {
      const s = cardStr(r, G.revolution);
      if (s > curS) cands.push({s, cards:cs.slice(0,need), joker:false});
    }
  });

  if (jk.length > 0) {
    if (need === 1) {
      cands.push({s:14, cards:[jk[0]], joker:true});
    } else {
      Object.entries(gr).forEach(([r,cs])=>{
        const fill = need - jk.length;
        if (fill > 0 && cs.length >= fill) {
          const s = cardStr(r, G.revolution);
          if (s > curS) {
            const combo = [...cs.slice(0,fill), ...jk.slice(0, need-fill)];
            if (combo.length === need) cands.push({s, cards:combo, joker:true});
          }
        }
      });
    }
  }

  if (!cands.length) return null;
  cands.sort((a,b)=>a.s-b.s);

  if (endGame) return cands[cands.length-1].cards; // play strongest to win faster
  const nonJoker = cands.filter(c=>!c.joker);
  return nonJoker.length ? nonJoker[0].cards : cands[0].cards;
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg) {
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),1900);
}

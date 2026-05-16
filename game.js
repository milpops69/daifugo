
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

  beep(1320, 0.018, 'triangle', 0.05);
  beep(990,  0.04,  'triangle', 0.035, 0.018);
}

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

function myPlayer() { return (typeof MP !== 'undefined' && MP.active) ? MP.seat : 0; }

const REL_TO_DISP = {
  2: { 1: 2 },
  3: { 1: 1, 2: 3 },
  4: { 1: 1, 2: 2, 3: 3 },
};
function getN() { return (G && G.numPlayers) || 4; }
function displayOf(seat) {
  const mp = myPlayer();
  if (seat === mp) return 0;
  const N = getN();
  const rel = ((seat - mp) % N + N) % N;
  return (REL_TO_DISP[N] && REL_TO_DISP[N][rel]) || 0;
}
function seatOf(disp) {
  const mp = myPlayer();
  if (disp === 0) return mp;
  const N = getN();
  for (let s = 0; s < N; s++) {
    if (s === mp) continue;
    if (displayOf(s) === disp) return s;
  }
  return -1;
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

const TURN_LIMIT_MS = 20000;
let _timerHandle = null;
let _timerEnd    = 0;
let _lastTimerTurn = -1;

function clearTurnTimer(){
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
  _timerEnd = 0;
  updateTimerUi(0, false);
}

function startTurnTimer(){
  clearTurnTimer();
  if (!G || G.gameOver) return;
  const mp = myPlayer();

  if (G.turn !== mp || G.finished.includes(mp)) return;
  _timerEnd = Date.now() + TURN_LIMIT_MS;
  _timerHandle = setInterval(() => {
    const remain = _timerEnd - Date.now();
    if (remain <= 0) {
      clearTurnTimer();
      const m = myPlayer();
      if (G && !G.gameOver && !G.busy && G.turn === m && !G.finished.includes(m)) {
        toast('ВРЕМЯ ВЫШЛО — ПАС');
        playerPass();
      }
    } else {
      updateTimerUi(remain, true);
    }
  }, 100);
}

function updateTimerUi(remain, active){
  const wrap = document.getElementById('turn-timer');
  const bar  = document.getElementById('turn-timer-bar');
  if (!wrap || !bar) return;
  if (!active) { wrap.style.opacity = '0'; bar.style.width = '0%'; return; }
  wrap.style.opacity = '1';
  const pct = Math.max(0, Math.min(100, (remain / TURN_LIMIT_MS) * 100));
  bar.style.width = pct + '%';
  if (remain < 5000)       bar.style.background = 'var(--rose)';
  else if (remain < 10000) bar.style.background = 'var(--gold2)';
  else                     bar.style.background = 'var(--green)';
}

function goTitle() {

  GAME_GEN++;
  if (G) G.aborted = true;
  _pileSig = null; _lastTimerTurn = -1; _lastMyRank = -1; clearTurnTimer();
  G = { hands:[[],[],[],[]], currentCombo:null, pile:[], revolution:false,
        turn:0, passCount:0, finished:[], rankings:[], gameOver:true, busy:false,
        aborted:true, numPlayers: 4 };
  document.querySelectorAll('.toast').forEach(t => t.remove());
  for (let i = 0; i < _toastSlots.length; i++) _toastSlots[i] = false;
  document.querySelectorAll('.pas-bubble').forEach(b => b.remove());

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
  const r = document.getElementById('mp-roster');
  if (r) r.innerHTML = '';
}
function show(id)   {
  ['title','rules','game','online'].forEach(s =>
    document.getElementById(s).classList.toggle('off', s !== id));
  const dr = document.getElementById('mobile-drawer');
  if (dr) dr.classList.remove('open');

  const inMP = (typeof MP !== 'undefined' && MP.active);
  document.querySelectorAll('.btn-newgame').forEach(b => {
    b.style.display = inMP ? 'none' : '';
  });
}

function toggleDrawer(){
  const dr = document.getElementById('mobile-drawer');
  if (dr) dr.classList.toggle('open');
}

function fsActive(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement
            || document.mozFullScreenElement || document.msFullscreenElement);
}
function tryEnterFullscreen() {
  if (!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches)) return;
  if (fsActive()) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen
              || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && typeof p.then === 'function') {
      p.then(lockLandscape).catch(() => {});
    } else {
      lockLandscape();
    }
  } catch (_) {}
}
function lockLandscape(){
  try {
    if (screen.orientation && screen.orientation.lock)
      screen.orientation.lock('landscape').catch(() => {});
  } catch (_) {}
}

['click','touchend','pointerup','keyup','focusout','change'].forEach(ev =>
  document.addEventListener(ev, tryEnterFullscreen, { passive: true })
);

let _hcardsScrollTime = 0;
(function(){
  const el = document.getElementById('hcards');
  if (!el) return;
  el.addEventListener('wheel', e => {
    if (!e.deltaY) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('scroll', () => { _hcardsScrollTime = Date.now(); });
})();

(function() {
  const el = document.getElementById('title-cards');
  [{r:'A',s:'♠'},{r:'K',s:'♥'},{r:'JK',s:'★'},{r:'A',s:'♦'},{r:'K',s:'♣'}]
    .forEach(c => el.appendChild(makeCard(c, SC_HAND)));
})();

(function(){
  const SVG_NS = 'http://www.w3.org/2000/svg';
  ['av-1','av-2','av-3'].forEach(id => {
    const av = document.getElementById(id);
    if (!av || av.querySelector('.avatar-ring')) return;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'avatar-ring');
    svg.setAttribute('viewBox', '0 0 100 100');
    const mk = cls => {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('class', cls);
      r.setAttribute('x', '4'); r.setAttribute('y', '4');
      r.setAttribute('width', '92'); r.setAttribute('height', '92');
      r.setAttribute('rx', '6'); r.setAttribute('ry', '6');
      r.setAttribute('pathLength', '100');
      return r;
    };
    svg.appendChild(mk('ring-bg'));
    svg.appendChild(mk('ring-fg'));
    av.appendChild(svg);
  });
})();

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

  const titleEl = document.getElementById('title');
  function tick(){
    if (titleEl && titleEl.classList.contains('off')) {
      requestAnimationFrame(tick);
      return;
    }
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

function currentNumPlayers() {
  if (typeof MP !== 'undefined' && MP.active) return MP.numPlayers || 2;
  return 4;
}

function applyLayoutForN(N) {
  const used = REL_TO_DISP[N] || REL_TO_DISP[4];
  const inUse = new Set(Object.values(used));
  const top   = document.getElementById('bot1-strip');
  const left  = document.getElementById('pa-1');
  const right = document.getElementById('pa-3');
  if (top)   top.style.display   = inUse.has(2) ? '' : 'none';
  if (left)  left.style.display  = inUse.has(1) ? '' : 'none';
  if (right) right.style.display = inUse.has(3) ? '' : 'none';
}

function newGame() {
  document.getElementById('overlay').classList.add('h');
  document.getElementById('exchange-overlay').classList.add('h');
  clearAllPas();

  const N = currentNumPlayers();
  applyLayoutForN(N);

  if (!G) G = {};
  G.numPlayers = N;
  assignBotPersonalities(N);

  for (let i = 1; i <= 3; i++) {
    const rb = document.getElementById('rb-' + i);
    if (rb) { rb.className = 'chip-badge'; rb.textContent = ''; rb.style.display = 'none'; }
    const rb2 = document.getElementById('brb-' + i);
    if (rb2) { rb2.className = 'bot-rbadge'; rb2.textContent = ''; rb2.style.display = 'none'; }
  }
  updateScoreDisplay();

  const deck = shuffle(mkDeck());
  const hands = Array.from({length: N}, () => []);
  deck.forEach((c,i) => hands[i % N].push(c));
  hands.forEach(h => h.sort((a,b) => STR[a.r]-STR[b.r]));

  const inMP = (typeof MP !== 'undefined' && MP.active);
  if (!inMP && N === 4 && prevRankings && prevRankings.length === 4) {
    showExchange(hands, prevRankings);
    return;
  }

  startGameWithHands(hands);
}

function startGameWithHands(hands) {
  const N = hands.length;
  let start = hands.findIndex(h => h.some(c => c.r==='3' && c.s==='♠'));
  if (start < 0) start = 0;

  focusIdx = 0;
  GAME_GEN++;
  _pileSig = null;
  _lastTimerTurn = -1;
  _glowSeat = null;
  _lastMyRank = -1;

  const _pcInit = document.getElementById('pcards');
  if (_pcInit) _pcInit.innerHTML = '';

  reshuffleBotPools();
  G = {
    hands, currentCombo: null, pile: [],
    revolution: false, turn: start,
    passCount: 0, finished: [], rankings: [],
    gameOver: false, busy: false, aborted: false,
    roundNum: gamesPlayed + 1,
    numPlayers: N,
  };

  applyLayoutForN(N);
  render();

  const inMP = (typeof MP !== 'undefined' && MP.active);
  if (!inMP && G.turn !== myPlayer()) schedBot();
}

let pendingHands = null;
let exchangeGiving = [];
let exchangeReceiving = [];
let exchangeMode = null;

function showExchange(hands, rankings) {
  pendingHands = hands;
  exchangeGiving = [];
  exchangeReceiving = [];
  exchangeMode = null;

  const byRank = {};
  rankings.forEach(({player, rank}) => byRank[rank] = player);
  const p0 = byRank[0];
  const p3 = byRank[3];
  const p1 = byRank[1];
  const p2 = byRank[2];

  if (p0 === 0) {

    exchangeMode = 'give2';
    exchangeReceiving = hands[p3].slice(-2).map(c => ({...c}));

    exchangeReceiving.forEach(card => {
      const i = hands[p3].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p3].splice(i, 1);
    });

    doAutoExchange(hands, p1, p2, 1);
  } else if (p3 === 0) {

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

    exchangeMode = 'give1';
    exchangeReceiving = hands[p2].slice(-1).map(c => ({...c}));
    exchangeReceiving.forEach(card => {
      const i = hands[p2].findIndex(c => c.id === card.id);
      if (i >= 0) hands[p2].splice(i, 1);
    });
    doAutoExchange(hands, p0, p3, 2);
  } else {

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
  btn.onclick = confirmExchange;

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

function showMpExchUI(data) {
  document.getElementById('overlay').classList.add('h');
  document.getElementById('exchange-overlay').classList.remove('h');
  const title = document.getElementById('ex-title');
  const body  = document.getElementById('ex-body');
  const hand  = document.getElementById('ex-hand');
  const btn   = document.getElementById('ex-btn');
  title.textContent = '◈ ОБМЕН КАРТАМИ ◈';
  hand.innerHTML = '';

  const myRank = data.myRank;
  const rankName = (myRank >= 0 && myRank < RANK_NAMES.length) ? RANK_NAMES[myRank] : '';
  const clr = (myRank >= 0 && myRank < RCLR.length) ? RCLR[myRank] : '#ffaadd';

  if (data.role === 'pick') {
    const need = data.count;
    const recvStr = (data.recv || []).map(c => c.r + c.s).join(', ');
    body.innerHTML = '<span style="color:' + clr + '">Вы — ' + rankName + '!</span> '
                   + 'Выберите ' + need + ' карт' + (need===1?'у':'') + ' для передачи игроку <b>'
                   + (data.partnerName || 'сопернику') + '</b>.<br>'
                   + '<span style="color:#ff88cc">Получите:</span> ' + recvStr;
    btn.textContent = '✓ ПОДТВЕРДИТЬ ВЫБОР';
    btn.disabled = true;
    btn.onclick = mpExchConfirmPick;

    _exchSelected = new Set();
    _exchClientHand = (data.hand || []).map(c => ({...c, exSel:false}));
    renderMpExchHand(need);
    return;
  }

  if (data.role === 'auto') {
    const givenStr = (data.gave || []).map(c => c.r + c.s).join(', ');
    body.innerHTML = '<span style="color:' + clr + '">Вы — ' + rankName + '.</span><br>'
                   + 'Автоматически отдаёте игроку <b>' + (data.partnerName || 'сопернику')
                   + '</b>: <span style="color:#ff88cc">' + givenStr + '</span>.<br>'
                   + '<i>Ожидаем, пока победитель выберет карты для вас…</i>';
    btn.textContent = '◯ ОЖИДАНИЕ…';
    btn.disabled = true;
    btn.onclick = null;
    return;
  }

  body.innerHTML = '<span style="color:' + clr + '">Вы — ' + rankName + '.</span><br>'
                 + 'В этой партии вы не участвуете в обмене.<br>'
                 + '<i>Ожидаем завершения обмена у других игроков…</i>';
  btn.textContent = '◯ ОЖИДАНИЕ…';
  btn.disabled = true;
  btn.onclick = null;
}

let _exchSelected = null;
let _exchClientHand = null;

function renderMpExchHand(need) {
  const hand = document.getElementById('ex-hand');
  hand.innerHTML = '';
  _exchClientHand.forEach(c => {
    const wrap = document.createElement('div');
    wrap.className = 'ex-card-wrap' + (c.exSel ? ' ex-sel' : '');
    wrap.appendChild(makeCard(c, SC_HAND));
    wrap.addEventListener('click', () => {
      if (c.exSel) {
        c.exSel = false; _exchSelected.delete(c.id);
      } else if (_exchSelected.size < need) {
        c.exSel = true; _exchSelected.add(c.id);
      }
      document.getElementById('ex-btn').disabled = _exchSelected.size !== need;
      renderMpExchHand(need);
    });
    hand.appendChild(wrap);
  });
}

function mpExchConfirmPick() {
  if (!_exchSelected) return;
  const ids = Array.from(_exchSelected);
  mpSendExchPick(ids);
}

function showMpExchWaiting() {
  const btn = document.getElementById('ex-btn');
  const body = document.getElementById('ex-body');
  if (btn) { btn.disabled = true; btn.textContent = '◯ ОЖИДАНИЕ…'; btn.onclick = null; }
  if (body) body.innerHTML = '<i>Ожидаем завершения обмена у других игроков…</i>';
  const hand = document.getElementById('ex-hand');
  if (hand) hand.innerHTML = '';
}

function showMpExchResult(data) {
  const title = document.getElementById('ex-title');
  const body  = document.getElementById('ex-body');
  const hand  = document.getElementById('ex-hand');
  const btn   = document.getElementById('ex-btn');
  title.textContent = '◈ ОБМЕН ЗАВЕРШЁН ◈';
  hand.innerHTML = '';

  const gave = (data.gave || []).map(c => c.r + c.s).join(', ') || '—';
  const recv = (data.received || []).map(c => c.r + c.s).join(', ') || '—';
  body.innerHTML = '<span style="color:#ff88cc">Вы отдали:</span> ' + gave + '<br>'
                 + '<span style="color:#44ff88">Вы получили:</span> ' + recv;
  btn.textContent = '▶ НАЧАТЬ ИГРУ';
  btn.disabled = false;
  btn.onclick = mpExchReady;
  sndExchange();
}

function showMpExchWaitingFinal() {
  const btn = document.getElementById('ex-btn');
  const body = document.getElementById('ex-body');
  if (btn) { btn.disabled = true; btn.textContent = '◯ ЖДЁМ ДРУГИХ…'; btn.onclick = null; }
  if (body) body.innerHTML += '<br><i>Ждём остальных игроков…</i>';
}

function setAvatar(el, av) {
  if (!el) return;
  const ring = el.querySelector('.avatar-ring');
  el.innerHTML = '';
  if (ring) el.appendChild(ring);
  const span = document.createElement('span');
  span.textContent = av.emoji;
  span.style.cssText = 'line-height:1;';
  el.appendChild(span);
  const img = document.createElement('img');
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block;border-radius:inherit;';
  img.onload  = () => { if (span.parentNode) span.parentNode.removeChild(span); el.appendChild(img); };
  img.onerror = () => {};
  img.src = av.src;
}

const BOT_COLORS = ['#4488ff','#44ff88','#ffaa44','#cc66ff','#ff6688','#66e0ff','#ffcc44','#aaff66'];

let _shuffledNames = null, _shuffledAvs = null, _shuffledCols = null;
function reshuffleBotPools(){
  _shuffledNames = shuffle([...JP_NAMES]);
  _shuffledAvs   = shuffle([...AVATARS]);
  _shuffledCols  = shuffle([...BOT_COLORS]);
}

function assignBotPersonalities(N) {
  N = N || 4;
  if (!_shuffledNames) reshuffleBotPools();

  const inMP = (typeof MP !== 'undefined' && MP.active);
  const peerBySeat = {};
  if (inMP && MP.peers) MP.peers.forEach(p => peerBySeat[p.seat] = p);

  while (NAMES.length < N) NAMES.push('Игрок ' + (NAMES.length + 1));

  const slots = [
    { disp: 1, avEl: 'av-1', nmEl: 'cn-1' },
    { disp: 2, avEl: 'av-2', nmEl: 'cn-2' },
    { disp: 3, avEl: 'av-3', nmEl: 'cn-3' },
  ];
  let pi = 0;
  slots.forEach(s => {
    const seat = seatOf(s.disp);
    if (seat < 0) return;
    let name, avatar, accent;
    if (inMP && peerBySeat[seat]) {
      const peer = peerBySeat[seat];
      name = peer.name || ('Игрок ' + (seat + 1));
      if (typeof peer.avatar === 'string' && peer.avatar.startsWith('data:')) {
        avatar = { src: peer.avatar, emoji: '🖼' };
      } else {
        avatar = AVATARS[Math.max(0, Math.min(AVATARS.length-1, peer.avatar|0))];
      }
      accent = _shuffledCols[pi % _shuffledCols.length];
    } else {
      name   = _shuffledNames[pi % _shuffledNames.length];
      avatar = _shuffledAvs[pi % _shuffledAvs.length];
      accent = _shuffledCols[pi % _shuffledCols.length];
    }
    pi++;
    NAMES[seat] = name;
    const nm = document.getElementById(s.nmEl);
    if (nm) nm.textContent = name;
    const avEl = document.getElementById(s.avEl);
    setAvatar(avEl, avatar);
  });

  if (inMP) {
    NAMES[MP.seat] = (MP.profile && MP.profile.name) || 'Я';
    if (MP.peers) {
      MP.peers.forEach(p => {
        NAMES[p.seat] = p.name || ('Игрок ' + (p.seat + 1));
      });
    }
  }
}

function render() {
  renderCounts();
  renderHand();
  renderBotHands();
  renderPile();
  renderActive();
  renderRanks();
  renderStatus();
  _maybeToastMyRank();

  const turnKey = G.gameOver ? 'over' : G.turn;
  if (turnKey !== _lastTimerTurn) {
    _lastTimerTurn = turnKey;
    startTurnTimer();
  }
  if (typeof mpSendState === 'function' && typeof MP !== 'undefined' && MP.active && MP.seat === 0)
    mpSendState();
}

function renderRanks() {
  for (let i = 1; i <= 3; i++) {
    const rb = document.getElementById('rb-' + i);
    if (rb) { rb.className = 'chip-badge'; rb.textContent = ''; rb.style.display = 'none'; }
    const brb = document.getElementById('brb-' + i);
    if (brb) { brb.className = 'bot-rbadge'; brb.textContent = ''; brb.style.display = 'none'; }
  }
  if (!G || !G.rankings) return;
  G.rankings.forEach(r => {
    const disp = displayOf(r.player);
    if (disp <= 0) return;
    const rb = document.getElementById('rb-' + disp);
    if (rb) {
      rb.className = 'chip-badge ' + RCLS[r.rank];
      rb.textContent = RANK_NAMES[r.rank];
      rb.style.display = 'inline-block';
    }
    const brb = document.getElementById('brb-' + disp);
    if (brb) {
      brb.className = 'bot-rbadge ' + RCLS[r.rank];
      brb.textContent = RANK_NAMES[r.rank];
      brb.style.display = 'inline-block';
    }
  });
}

let _lastMyRank = -1;
function _maybeToastMyRank() {
  const me = myPlayer();
  if (!G || !G.rankings || !G.rankings.length) { _lastMyRank = -1; return; }
  const myR = G.rankings.find(r => r.player === me);
  if (!myR) { _lastMyRank = -1; return; }
  if (_lastMyRank !== myR.rank) {
    _lastMyRank = myR.rank;
    toast(RANK_NAMES[myR.rank].toUpperCase() + '!');
  }
}

function renderCounts() {
  const N = (G.hands && G.hands.length) || 0;
  for (let i = 0; i < N; i++) {
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
    if (seat < 0 || !G.hands || !G.hands[seat]) return;
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

  const isTouch = (window.matchMedia && window.matchMedia('(hover: none)').matches);

  hand.forEach((c, i) => {
    const wrap = document.createElement('div');
    let cls = 'card-wrap' + (c.sel ? ' sel' : '');
    if (!isTouch && i === focusIdx) cls += ' focus';
    wrap.className = cls;
    wrap.dataset.idx = i;
    wrap.appendChild(makeCard(c, SC_HAND));

    let _downX = 0, _downY = 0, _moved = false, _touchDrag = false;
    wrap.addEventListener('pointerdown', e => {
      _downX = e.clientX; _downY = e.clientY; _moved = false; _touchDrag = false;

      if (e.pointerType !== 'touch') startDrag(e, i, wrap, c);
    });
    wrap.addEventListener('pointermove', e => {
      const dx = e.clientX - _downX, dy = e.clientY - _downY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) _moved = true;

      if (e.pointerType === 'touch' && !_touchDrag && _moved) {
        if (dy < -10 && Math.abs(dy) >= Math.abs(dx)) {
          _touchDrag = true;
          startDrag(e, i, wrap, c);
        }
      }
    });
    wrap.addEventListener('click', () => {
      if (Date.now() - _hcardsScrollTime < 250) { _moved = false; return; }
      if (_moved || isDragging) { _moved = false; return; }
      focusIdx = i; toggleCard(i);
    });
    if (!isTouch) wrap.addEventListener('mouseenter', () => { focusIdx = i; });
    el.appendChild(wrap);
  });

  if (!isTouch) {
    const focusEl = el.children[focusIdx];
    if (focusEl) focusEl.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

let _pileSig = null;
function renderPile() {
  const pc = document.getElementById('pcards');

  const sig = G.currentCombo
    ? G.currentCombo.cards.map(c => c.id).join('|')
    : '';
  if (sig !== _pileSig) {
    _pileSig = sig;
    pc.innerHTML = '';
    if (G.currentCombo && G.currentCombo.cards.length) {
      G.currentCombo.cards.forEach(c => {
        const w = document.createElement('div');
        w.className = 'pile-card-wrap';
        w.appendChild(makeCard(c, SC_PILE));
        pc.appendChild(w);
      });
    }
  }
  document.getElementById('rev-badge').style.display = G.revolution ? 'block' : 'none';
}

function renderActive() {
  const seat2 = seatOf(2);
  const ch2 = document.getElementById('chip-2');
  if (ch2 && seat2 >= 0) {
    ch2.classList.toggle('active', G.turn===seat2 && !G.finished.includes(seat2));
    ch2.classList.toggle('done', G.finished.includes(seat2));
  }
  [1,3].forEach(disp => {
    const seat = seatOf(disp);
    const sb = document.getElementById('pa-' + disp);
    if (!sb || seat < 0) return;
    sb.classList.toggle('active', G.turn===seat && !G.finished.includes(seat));
    sb.classList.toggle('done', G.finished.includes(seat));
  });
  const mp2 = myPlayer();
  const my = G.turn===mp2 && !G.finished.includes(mp2) && !G.gameOver && !G.busy;
  document.getElementById('bps').disabled = !my;
  document.getElementById('bplay').disabled = !my;

  applyTurnGlow();
}

let _glowSeat = null;
function applyTurnGlow(){
  const inMP = (typeof MP !== 'undefined' && MP.active);
  const off = !inMP || !G || G.gameOver
            || G.turn == null || G.turn === myPlayer()
            || (G.finished && G.finished.includes(G.turn));
  if (off) {
    document.querySelectorAll('.turn-glow').forEach(el => el.classList.remove('turn-glow'));
    _glowSeat = null; return;
  }
  if (G.turn === _glowSeat) return;
  document.querySelectorAll('.turn-glow').forEach(el => el.classList.remove('turn-glow'));
  const disp = displayOf(G.turn);
  if (disp <= 0) { _glowSeat = null; return; }
  const av = document.getElementById('av-' + disp);
  if (!av) return;
  void av.offsetWidth;
  av.classList.add('turn-glow');
  _glowSeat = G.turn;
}

function renderStatus() {}

let isDragging = false;
let dragData   = null;

function startDrag(e, idx, wrap, card) {
  const mp = myPlayer();
  if (G.turn!==mp||G.finished.includes(mp)||G.gameOver||G.busy) return;
  if (e.cancelable) e.preventDefault();
  isDragging = false;
  const sel       = G.hands[mp].filter(c => c.sel);
  const dragCards = card.sel && sel.length > 1 ? sel : [card];
  dragData = { cards: dragCards, startX: e.clientX, startY: e.clientY };

  const ghost = document.getElementById('drag-ghost');
  ghost.innerHTML = '';
  ghost.appendChild(makeCard(dragCards[0], SC_HAND));
  ghost.style.display = 'block';
  ghost.style.left = (e.clientX - PW/2) + 'px';
  ghost.style.top  = (e.clientY - PH/2) + 'px';

  try { wrap.setPointerCapture(e.pointerId); } catch(_) {}

  const dz = document.getElementById('dropzone');
  const onMove = ev => {
    if (Math.abs(ev.clientX-dragData.startX)>5||Math.abs(ev.clientY-dragData.startY)>5) isDragging=true;
    ghost.style.left = (ev.clientX - PW/2) + 'px';
    ghost.style.top  = (ev.clientY - PH/2) + 'px';
    const r = dz.getBoundingClientRect();
    dz.classList.toggle('dragover',
      ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom);
    if (ev.cancelable) ev.preventDefault();
  };
  const onUp = ev => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup',   onUp);
    document.removeEventListener('pointercancel', onUp);
    try { wrap.releasePointerCapture(ev.pointerId); } catch(_) {}
    ghost.style.display = 'none';
    dz.classList.remove('dragover');
    const r = dz.getBoundingClientRect();
    if (ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom&&isDragging)
      tryPlayerPlay(dragData.cards);
    isDragging = false; dragData = null;
    wrap.classList.remove('dragging');
  };
  wrap.classList.add('dragging');
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup',   onUp);
  document.addEventListener('pointercancel', onUp);
}

function tryPlayerPlay(cards) {
  const inMP = (typeof MP !== 'undefined' && MP.active);

  if (inMP && MP.seat > 0 && typeof mpGuestPlay === 'function') {
    const res = validate(cards);
    if (!res.ok) { sndError(); toast(res.msg); return; }
    mpGuestPlay(cards.map(c => c.id));
    return;
  }

  if (inMP && MP.seat === 0) {
    const res = validate(cards);
    if (!res.ok) { sndError(); toast(res.msg); return; }
    sndCard();
    commitPlay(myPlayer(), cards, res);
    return;
  }

  const res = validate(cards);
  if (!res.ok) { sndError(); toast(res.msg); return; }
  sndCard();
  G.busy = true;
  if (typeof clearTurnTimer === 'function') clearTurnTimer();
  flyCards(cards, getPlayerCardPositions(cards), () => commitPlay(myPlayer(), cards, res));
}

function playerPlaySelected() {
  const mp = myPlayer();
  if (G.turn!==mp) { toast('НЕ ВАШ ХОД'); return; }
  if (G.finished.includes(mp)) { toast('ВЫ УЖЕ ВЫШЛИ'); return; }
  if (G.gameOver) { toast('ИГРА ОКОНЧЕНА'); return; }
  if (G.busy) { toast('ПОДОЖДИТЕ…'); return; }
  const sel = G.hands[mp].filter(c => c.sel);
  if (!sel.length) { toast('ВЫБЕРИТЕ КАРТЫ'); return; }
  const inMP = (typeof MP !== 'undefined' && MP.active);
  if (inMP && MP.seat > 0 && typeof mpGuestPlay === 'function') {
    mpGuestPlay(sel.map(c => c.id)); return;
  }
  if (inMP && MP.seat === 0) {
    const res = validate(sel);
    if (!res.ok) { sndError(); toast(res.msg); return; }
    sndCard();
    commitPlay(mp, sel, res);
    return;
  }
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

  if (typeof MP !== 'undefined' && MP.active && MP.seat > 0
      && typeof mpGuestPass === 'function') { mpGuestPass(); return; }
  sndPass();
  doPass(mp);
}

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

function commitPlay(who, cards, res) {
  clearAllPas();
  G.busy = false;
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
  if (who !== myPlayer()) showPas(who);
  G.passCount++;
  const active = (G.numPlayers || 4) - G.finished.length;
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
  const N = G.numPlayers || 4;
  let n=(from+1)%N, t=0;
  while (G.finished.includes(n) && t<N) { n=(n+1)%N; t++; }
  return n;
}

function finishPlayer(who) {
  G.finished.push(who);
  const ri = G.rankings.length;
  G.rankings.push({player:who, rank:ri});

  const N = G.numPlayers || 4;
  if (N - G.finished.length <= 1) {
    for (let i=0; i<N; i++) if (!G.finished.includes(i)) {
      G.finished.push(i);
      G.rankings.push({player:i, rank:G.rankings.length});
    }
    G.gameOver=true; render();
    const gen2 = GAME_GEN;
    setTimeout(() => { if (gameAlive(gen2)) showResults(); }, 1400);
    return;
  }
  nextTurn(who);
}

function showResults() {
  gamesPlayed++;
  G.rankings.forEach(({player,rank}) => totalScores[player]+=RANK_POINTS[rank]);
  prevRankings = [...G.rankings];

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

function schedBot() {

  if (typeof MP !== 'undefined' && MP.active) return;
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

    if (quads.length && !G.revolution) {
      const lowCount = nr.filter(c=>STR[c.r]<5).length;
      if (lowCount >= 4 || endGame) return quads[0][1].slice(0,4);
    }

    if (endGame) {

      if (sorted.length) return [sorted[0][1][0]];
      return jk.length ? [jk[0]] : null;
    }

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

  if (endGame) return cands[cands.length-1].cards;
  const nonJoker = cands.filter(c=>!c.joker);
  return nonJoker.length ? nonJoker[0].cards : cands[0].cards;
}

const _toastSlots = new Array(8).fill(false);
function toast(msg) {
  let slot = 0;
  while (slot < _toastSlots.length && _toastSlots[slot]) slot++;
  if (slot >= _toastSlots.length) slot = _toastSlots.length - 1;
  _toastSlots[slot] = true;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.setProperty('--toast-slot', slot);
  document.body.appendChild(t);
  setTimeout(() => {
    _toastSlots[slot] = false;
    t.remove();
  }, 1900);
}

/* ============================================
   Game analysis page logic
   ============================================ */

(function () {
  'use strict';

  // ---------- DOM refs ----------
  const boardEl = document.getElementById('chess-board');
  const arrowsEl = document.getElementById('board-arrows');
  const moveListEl = document.getElementById('move-list');
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeBtnTop = document.getElementById('analyze-btn-top');
  const analyzeBanner = document.getElementById('analyze-banner');
  const testEngineBtn = document.getElementById('test-engine-btn');
  const reanalyzeBtn = document.getElementById('reanalyze-btn');
  const progressWrap = document.getElementById('progress-wrapper');
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const toastContainer = document.getElementById('toast-container');

  const evalBarWhite = document.getElementById('eval-bar-white');
  const evalTextTop = document.getElementById('eval-text-top');
  const evalTextBottom = document.getElementById('eval-text-bottom');

  const qualityTag = document.getElementById('quality-tag');
  const evalDisplay = document.getElementById('eval-display');
  const moveExplanation = document.getElementById('move-explanation');
  const bestMoveRow = document.getElementById('best-move-row');
  const bestMoveNotation = document.getElementById('best-move-notation');

  const infoDate = document.getElementById('info-date');
  const infoTime = document.getElementById('info-time');
  const infoOpening = document.getElementById('info-opening');
  const infoResult = document.getElementById('info-result');

  const playerTop = document.getElementById('player-top');
  const playerBottom = document.getElementById('player-bottom');

  const summaryCard = document.getElementById('summary-card');
  const summaryContent = document.getElementById('summary-content');
  const evalGraphCard = document.getElementById('eval-graph-card');
  const evalGraphSvg = document.getElementById('eval-graph');

  // ---------- State ----------
  let game = null;
  let analysis = null;
  let chess = null;
  let currentPly = 0;          // 0 = starting position, history.length = final position
  let history = [];            // verbose chess.js move list
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // ---------- Utils ----------
  function toast(msg, type = 'info', timeout = 4000) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20%)';
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  function showProgress() { progressWrap.classList.add('active'); }
  function hideProgress() { progressWrap.classList.remove('active'); }
  function setProgress({ current, total, message }) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressText.textContent = message || '';
    progressPct.textContent = pct + '%';
    progressFill.style.width = pct + '%';
  }

  function fmtDate(unixSec) {
    if (!unixSec) return '–';
    return new Date(unixSec * 1000).toLocaleString('he-IL');
  }

  function fmtTimeControl(tc) {
    if (!tc) return '–';
    // chess.com format: "180+2" or "600" seconds
    const m = tc.match(/^(\d+)(?:\+(\d+))?$/);
    if (!m) return tc;
    const base = parseInt(m[1], 10);
    const inc = m[2] ? parseInt(m[2], 10) : 0;
    return `${Math.floor(base / 60)}:${String(base % 60).padStart(2, '0')}${inc ? ' +' + inc : ''}`;
  }

  // ---------- Loading ----------
  function getGameId() {
    return new URL(location.href).searchParams.get('id');
  }

  function loadGame() {
    const id = getGameId();
    if (!id) {
      toast('לא צוין מזהה משחק', 'error');
      return null;
    }
    const g = Storage.getGame(id);
    if (!g) {
      toast('המשחק לא נמצא במאגר', 'error');
      return null;
    }
    return g;
  }

  // ---------- Rendering ----------
  function fillGameInfo() {
    infoDate.textContent = fmtDate(game.endTime);
    infoTime.textContent = fmtTimeControl(game.timeControl);
    infoOpening.textContent = game.opening || game.eco || '–';
    const resultMap = { win: 'ניצחון', loss: 'הפסד', draw: 'תיקו' };
    infoResult.textContent = resultMap[game.result] || '–';
    infoResult.style.fontWeight = '700';
    infoResult.style.color =
      game.result === 'win'  ? 'var(--q-best)'    :
      game.result === 'loss' ? 'var(--q-blunder)' : 'var(--text-secondary)';

    // Players: top = opponent if we're white, else us; flipped logic
    updatePlayerInfo();
  }

  function updatePlayerInfo() {
    // bottom = the side we're viewing FROM. If we're white and not flipped, bottom = white.
    const userIsWhite = game.ourColor === 'white';
    const bottomIsWhite = Board.isFlipped() ? !userIsWhite : userIsWhite;
    // When ourColor is unknown, just show white at bottom by default
    if (game.ourColor === 'unknown') {
      setPlayer(playerBottom, 'white');
      setPlayer(playerTop,    'black');
      return;
    }
    setPlayer(playerBottom, bottomIsWhite ? 'white' : 'black');
    setPlayer(playerTop,    bottomIsWhite ? 'black' : 'white');
  }

  function setPlayer(el, color) {
    const name = color === 'white' ? game.whiteUsername : game.blackUsername;
    const rating = color === 'white' ? game.whiteRating : game.blackRating;
    const isYou = (game.ourColor === color);
    el.querySelector('.player-name').textContent = (name || '–') + (isYou ? '  (אתה)' : '');

    // Show accuracy next to the rating once the game has been analyzed
    let ratingTxt = rating ? `(${rating})` : '';
    if (analysis && analysis.status === 'done') {
      const acc = color === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy;
      if (acc != null) ratingTxt += ` · דיוק ${acc.toFixed(1)}%`;
    }
    el.querySelector('.player-rating').textContent = ratingTxt;

    el.querySelector('.player-clock').textContent = color === 'white' ? 'לבן' : 'שחור';
    el.querySelector('.player-clock').style.background = color === 'white' ? '#f0f0f0' : '#222';
    el.querySelector('.player-clock').style.color = color === 'white' ? '#222' : '#f0f0f0';
  }

  function renderMoveList() {
    moveListEl.innerHTML = '';
    if (history.length === 0) {
      moveListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">אין מהלכים</div>';
      return;
    }

    // Pair up white+black moves
    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const moveNum = Math.floor(i / 2) + 1;
      row.innerHTML = `
        <div class="move-number">${moveNum}.</div>
        <div class="move-cell" data-ply="${i + 1}">${moveCellContent(i)}</div>
        <div class="move-cell" data-ply="${i + 2}" ${history[i + 1] ? '' : 'style="visibility:hidden"'}>
          ${history[i + 1] ? moveCellContent(i + 1) : ''}
        </div>
      `;
      moveListEl.appendChild(row);
    }

    moveListEl.querySelectorAll('.move-cell[data-ply]').forEach(el => {
      el.addEventListener('click', () => {
        gotoPly(parseInt(el.dataset.ply, 10));
      });
    });

    updateActiveMove();
  }

  function moveCellContent(idx) {
    const mv = history[idx];
    const move = mv ? mv.san : '';
    const a = analysis && analysis.perMove[idx];
    if (a) {
      const visual = QUALITY_VISUAL[a.quality] || { symbol: '', color: '#888' };
      const cls = 'q-' + a.quality;
      return `<span class="quality-dot ${cls}" title="${QUALITY_HE[a.quality] || ''}"></span>
              <span>${move}</span>
              <span class="quality-mark" style="color:${visual.color};font-weight:700;font-size:12px;">${visual.symbol}</span>`;
    }
    return `<span>${move}</span>`;
  }

  function updateActiveMove() {
    moveListEl.querySelectorAll('.move-cell').forEach(el => el.classList.remove('active'));
    if (currentPly > 0) {
      const cell = moveListEl.querySelector(`.move-cell[data-ply="${currentPly}"]`);
      if (cell) {
        cell.classList.add('active');
        scrollMoveListTo(cell);
      }
    }
  }

  /** Scroll ONLY the move-list container — never the page.
   *  (scrollIntoView scrolls every ancestor, which made the whole page jump.) */
  function scrollMoveListTo(cell) {
    const listRect = moveListEl.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    if (cellRect.top < listRect.top || cellRect.bottom > listRect.bottom) {
      moveListEl.scrollTop += (cellRect.top - listRect.top)
        - (listRect.height / 2) + (cellRect.height / 2);
    }
  }

  function renderEvalBar(cpWhite, scoreObj) {
    // Map cp to a 0..100 percentage for white
    // Curve: tanh(cp/400) gives nice S-curve
    const x = Math.max(-1, Math.min(1, Math.tanh((cpWhite || 0) / 400)));
    const whitePct = 50 + x * 48; // keep a small margin so labels are visible
    evalBarWhite.style.height = whitePct + '%';

    // Labels
    let label;
    if (scoreObj && scoreObj.type === 'mate') {
      label = '#' + Math.abs(scoreObj.value);
    } else {
      const cp = (cpWhite || 0) / 100;
      label = (cp >= 0 ? '+' : '') + cp.toFixed(1);
    }

    // Black side on top, white side on bottom; show label on the leading side
    if (cpWhite >= 0) {
      evalTextBottom.textContent = label;
      evalTextTop.textContent = '';
    } else {
      evalTextTop.textContent = label;
      evalTextBottom.textContent = '';
    }
  }

  // ---------- Analysis summary (chess.com review style) ----------
  function renderSummary() {
    if (!analysis || analysis.status !== 'done') {
      summaryCard.style.display = 'none';
      return;
    }
    summaryCard.style.display = '';

    const counts = { w: {}, b: {} };
    for (const m of analysis.perMove) {
      counts[m.color][m.quality] = (counts[m.color][m.quality] || 0) + 1;
    }

    const rows = [
      ['best',       'הטוב ביותר'],
      ['excellent',  'מצוין'],
      ['good',       'טוב'],
      ['book',       'פתיחה'],
      ['inaccuracy', 'אי-דיוק'],
      ['mistake',    'טעות'],
      ['blunder',    'פאדיחה'],
    ];

    const wAcc = analysis.whiteAccuracy != null ? analysis.whiteAccuracy.toFixed(1) : '–';
    const bAcc = analysis.blackAccuracy != null ? analysis.blackAccuracy.toFixed(1) : '–';

    let html = `
      <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 4px 14px; font-size: 13px; align-items: center;">
        <div></div>
        <div style="font-weight:700; text-align:center;">${game.whiteUsername || 'לבן'}</div>
        <div style="font-weight:700; text-align:center;">${game.blackUsername || 'שחור'}</div>
        <div style="color: var(--text-secondary);">דיוק</div>
        <div style="text-align:center; font-weight:700; color: var(--q-best);">${wAcc}%</div>
        <div style="text-align:center; font-weight:700; color: var(--q-best);">${bAcc}%</div>`;

    for (const [q, label] of rows) {
      const wc = counts.w[q] || 0;
      const bc = counts.b[q] || 0;
      if (wc === 0 && bc === 0) continue;
      const visual = QUALITY_VISUAL[q] || { color: '#888', symbol: '' };
      html += `
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="quality-dot q-${q}" style="width:10px;height:10px;border-radius:50%;display:inline-block;"></span>
          <span>${label}</span>
          <span style="color:${visual.color}; font-weight:700; font-size:11px;">${visual.symbol}</span>
        </div>
        <div style="text-align:center;">${wc}</div>
        <div style="text-align:center;">${bc}</div>`;
    }
    html += '</div>';
    summaryContent.innerHTML = html;
  }

  // ---------- Eval graph (chess.com review style) ----------
  const GRAPH_W = 300, GRAPH_H = 70;

  function evalToY(cpWhite) {
    // +eval (white better) → curve goes up. tanh gives the S-curve feel.
    const share = 0.5 + Math.tanh((cpWhite || 0) / 400) * 0.5;
    return GRAPH_H * (1 - share);
  }

  function renderEvalGraph() {
    if (!analysis || analysis.status !== 'done' || analysis.perMove.length === 0) {
      evalGraphCard.style.display = 'none';
      return;
    }
    evalGraphCard.style.display = '';
    evalGraphSvg.setAttribute('viewBox', `0 0 ${GRAPH_W} ${GRAPH_H}`);

    const n = analysis.perMove.length;
    const pts = [[0, evalToY(0)]];
    analysis.perMove.forEach((m, i) => {
      pts.push([((i + 1) / n) * GRAPH_W, evalToY(m.cpAfterWhite)]);
    });

    // White-advantage area: fill from the curve down to the bottom.
    let d = `M 0 ${GRAPH_H} L ${pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')} L ${GRAPH_W} ${GRAPH_H} Z`;

    let svg = `
      <rect x="0" y="0" width="${GRAPH_W}" height="${GRAPH_H}" fill="#262421"/>
      <path d="${d}" fill="#f0f0f0"/>
      <line x1="0" y1="${GRAPH_H / 2}" x2="${GRAPH_W}" y2="${GRAPH_H / 2}" stroke="#888" stroke-width="0.5" stroke-dasharray="3,2" opacity="0.6"/>`;

    // Dots for inaccuracies / mistakes / blunders
    analysis.perMove.forEach((m, i) => {
      if (!['inaccuracy', 'mistake', 'blunder'].includes(m.quality)) return;
      const x = ((i + 1) / n) * GRAPH_W;
      const y = evalToY(m.cpAfterWhite);
      const color = (QUALITY_VISUAL[m.quality] || {}).color || '#888';
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" stroke="#262421" stroke-width="1"/>`;
    });

    // Cursor line for the current ply
    svg += `<line id="eval-cursor" x1="0" y1="0" x2="0" y2="${GRAPH_H}" stroke="#f7c046" stroke-width="1.5" opacity="0"/>`;

    evalGraphSvg.innerHTML = svg;
    updateEvalGraphCursor();
  }

  function updateEvalGraphCursor() {
    const cursor = document.getElementById('eval-cursor');
    if (!cursor || !analysis || analysis.status !== 'done') return;
    const n = analysis.perMove.length;
    if (currentPly === 0) {
      cursor.setAttribute('opacity', '0');
    } else {
      const x = (currentPly / n) * GRAPH_W;
      cursor.setAttribute('x1', x);
      cursor.setAttribute('x2', x);
      cursor.setAttribute('opacity', '0.9');
    }
  }

  function setupEvalGraphClick() {
    evalGraphSvg.addEventListener('click', (e) => {
      if (!analysis || analysis.status !== 'done') return;
      const rect = evalGraphSvg.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const ply = Math.round(frac * analysis.perMove.length);
      gotoPly(ply);
    });
  }

  function buildMoveExplanation(a) {
    const colorTxt = a.color === 'w' ? 'לבן' : 'שחור';
    const loss = (a.cpLoss / 100).toFixed(2);
    const sanBold = `<strong style="font-family: 'Consolas', monospace;">${a.san}</strong>`;

    if (a.quality === 'book') {
      return `${sanBold} – מהלך מוכר מתורת הפתיחות. ${colorTxt} משחק לפי התיאוריה.`;
    }
    if (a.quality === 'best') {
      return `${sanBold} – המהלך המדויק ביותר במצב הזה. ${colorTxt} מצא את המהלך הנכון.`;
    }
    if (a.quality === 'excellent' || a.quality === 'good') {
      return `${sanBold} – מהלך טוב שמשמר את היתרון של ${colorTxt}.`;
    }
    if (a.quality === 'inaccuracy') {
      return `${sanBold} – אי-דיוק. ${colorTxt} איבד <strong>${loss}</strong> נקודות הערכה.
              היה מהלך טוב יותר זמין.`;
    }
    if (a.quality === 'mistake') {
      return `${sanBold} – טעות. ${colorTxt} איבד <strong>${loss}</strong> נקודות הערכה
              ונתן ליריב הזדמנות.`;
    }
    if (a.quality === 'blunder') {
      return `${sanBold} – פאדיחה (החמצה). ${colorTxt} איבד <strong>${loss}</strong> נקודות הערכה!
              זה עלול לקבוע את גורל המשחק.`;
    }
    return `${sanBold} – ${QUALITY_HE[a.quality] || a.quality}`;
  }

  function renderAnalysisPanel() {
    if (currentPly === 0) {
      qualityTag.textContent = 'התחלה';
      qualityTag.style.background = 'var(--text-muted)';
      evalDisplay.textContent = '+0.00';
      moveExplanation.textContent = 'לחץ על "קדימה" או חץ במקלדת כדי לשחק את המהלכים.';
      bestMoveRow.style.display = 'none';
      renderEvalBar(0, { type: 'cp', value: 0 });
      return;
    }

    const a = analysis && analysis.perMove[currentPly - 1];
    if (!a) {
      qualityTag.textContent = 'לא נותח';
      qualityTag.style.background = 'var(--text-muted)';
      evalDisplay.textContent = '–';
      moveExplanation.innerHTML = 'משחק זה עוד לא נותח. לחץ <strong>"נתח משחק זה"</strong> כדי להפעיל את המנוע.';
      bestMoveRow.style.display = 'none';
      renderEvalBar(0, { type: 'cp', value: 0 });
      return;
    }

    const heLabel = QUALITY_HE[a.quality] || a.quality;
    const visual = QUALITY_VISUAL[a.quality] || { color: 'var(--text-muted)' };
    qualityTag.textContent = heLabel;
    qualityTag.style.background = visual.color;

    // Eval display
    if (a.scoreAfter.type === 'mate') {
      evalDisplay.textContent = (a.scoreAfter.value > 0 ? '+M' : '-M') + Math.abs(a.scoreAfter.value);
    } else {
      const cp = a.cpAfterWhite / 100;
      evalDisplay.textContent = (cp >= 0 ? '+' : '') + cp.toFixed(2);
    }

    // Explanation — written in chess.com narrative style
    moveExplanation.innerHTML = buildMoveExplanation(a);

    // Best move suggestion (only show when our move wasn't optimal)
    if (a.bestSan && !a.wasBest) {
      bestMoveRow.style.display = '';
      bestMoveRow.classList.remove('is-blunder', 'is-mistake', 'is-inaccuracy');
      if (a.quality === 'blunder') bestMoveRow.classList.add('is-blunder');
      else if (a.quality === 'mistake') bestMoveRow.classList.add('is-mistake');
      else if (a.quality === 'inaccuracy') bestMoveRow.classList.add('is-inaccuracy');
      bestMoveNotation.textContent = a.bestSan;
    } else {
      bestMoveRow.style.display = 'none';
    }

    renderEvalBar(a.cpAfterWhite, a.scoreAfter);
  }

  function renderBoard(animate = null) {
    let fen = START_FEN;
    if (currentPly > 0 && history[currentPly - 1] && typeof Chess !== 'undefined') {
      try { fen = getFenAtPly(currentPly); } catch (e) { console.warn(e); fen = START_FEN; }
    }
    const lastMv = currentPly > 0 ? history[currentPly - 1] : null;
    const a = analysis && currentPly > 0 ? analysis.perMove[currentPly - 1] : null;

    const lastMove = lastMv ? {
      from: lastMv.from,
      to: lastMv.to,
      quality: a ? a.quality : null,
    } : null;

    // Show best-move arrow only when our move was not the best AND it's a poor move
    let bestMoveArrow = null;
    if (a && !a.wasBest && a.bestFrom && a.bestTo && ['blunder', 'mistake', 'inaccuracy'].includes(a.quality)) {
      bestMoveArrow = { from: a.bestFrom, to: a.bestTo };
    }

    Board.render(fen, { lastMove, bestMove: bestMoveArrow, animate });
  }

  /** Build animation descriptors for a single move (chess.com-style slide).
   *  reverse=true animates the move being taken back. */
  function buildAnims(mv, reverse) {
    const anims = [];
    const main = reverse
      ? { from: mv.to, to: mv.from }
      : { from: mv.from, to: mv.to };

    // Capture ghost (only forward; skip en-passant where the pawn isn't on `to`)
    if (!reverse && mv.captured && !(mv.flags || '').includes('e')) {
      const capColor = mv.color === 'w' ? 'b' : 'w';
      main.capturedCode = capColor + mv.captured.toUpperCase();
    }
    anims.push(main);

    // Castling: animate the rook too
    const flags = mv.flags || '';
    if (flags.includes('k') || flags.includes('q')) {
      const rank = mv.color === 'w' ? '1' : '8';
      const rookFrom = flags.includes('k') ? 'h' + rank : 'a' + rank;
      const rookTo   = flags.includes('k') ? 'f' + rank : 'd' + rank;
      anims.push(reverse ? { from: rookTo, to: rookFrom } : { from: rookFrom, to: rookTo });
    }
    return anims;
  }

  function getFenAtPly(ply) {
    if (typeof Chess === 'undefined') return START_FEN;
    const c = new Chess();
    for (let i = 0; i < ply; i++) {
      const mv = history[i];
      c.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    }
    return c.fen();
  }

  // ---------- Navigation ----------
  function gotoPly(ply) {
    const target = Math.max(0, Math.min(history.length, ply));
    const prev = currentPly;
    currentPly = target;

    // Animate only single-step navigation (forward or backward)
    let animate = null;
    if (target === prev + 1 && history[target - 1]) {
      animate = buildAnims(history[target - 1], false);
    } else if (target === prev - 1 && history[prev - 1]) {
      animate = buildAnims(history[prev - 1], true);
    }

    renderBoard(animate);
    renderAnalysisPanel();
    updateActiveMove();
    updateEvalGraphCursor();
  }

  // ---------- Init ----------
  function buildHistory() {
    if (typeof Chess === 'undefined') {
      console.error('chess.js לא נטען');
      toast('שגיאה: ספריית chess.js לא נטענה. בדוק שאין חוסם פרסומות שחוסם cdn.jsdelivr.net.', 'error', 10000);
      history = [];
      return;
    }
    try {
      chess = new Chess();
      const ok = chess.load_pgn(game.pgn, { sloppy: true });
      if (!ok) {
        toast('שגיאה בטעינת ה-PGN של המשחק', 'error');
        history = [];
        return;
      }
      history = chess.history({ verbose: true });
    } catch (e) {
      console.error('buildHistory error', e);
      toast('שגיאה בעיבוד המשחק: ' + e.message, 'error', 7000);
      history = [];
    }
  }

  function setupNav() {
    document.getElementById('nav-start').onclick = () => gotoPly(0);
    document.getElementById('nav-end').onclick = () => gotoPly(history.length);
    // For RTL, "forward" button visually goes to NEXT ply (the LEFT chevron in RTL layout)
    document.getElementById('nav-next').onclick = () => gotoPly(currentPly + 1);
    document.getElementById('nav-prev').onclick = () => gotoPly(currentPly - 1);
    document.getElementById('nav-flip').onclick = () => {
      Board.setFlipped(!Board.isFlipped());
      updatePlayerInfo();
      renderBoard();
    };
    document.addEventListener('keydown', e => {
      // Stop the browser from scrolling the page with these keys
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
      // In RTL: left = forward, right = backward (matches the visual chevrons)
      if (e.key === 'ArrowLeft')  gotoPly(currentPly + 1);
      if (e.key === 'ArrowRight') gotoPly(currentPly - 1);
      if (e.key === 'Home')       gotoPly(0);
      if (e.key === 'End')        gotoPly(history.length);
      if (e.key === 'f' || e.key === 'F') document.getElementById('nav-flip').click();
    });
  }

  async function runEngineTest() {
    if (!testEngineBtn) return;
    const oldHtml = testEngineBtn.innerHTML;
    testEngineBtn.disabled = true;
    testEngineBtn.innerHTML = '<span class="loader"></span><span>טוען מנוע…</span>';
    try {
      // Always start with a clean engine in case a previous run hung it.
      Analyzer.reset();
      const result = await Analyzer.selfTest();
      const cp = result.score.type === 'cp'
        ? (result.score.value / 100).toFixed(2)
        : '#' + result.score.value;
      toast(`Stockfish עובד! מהלך מומלץ מהפתיחה: ${result.bestMove} (הערכה ${cp}, עומק ${result.depth})`, 'info', 8000);
      console.log('[selfTest] PASS', result);
    } catch (e) {
      console.error('[selfTest] FAIL', e);
      toast('Stockfish נכשל: ' + e.message, 'error', 12000);
    } finally {
      testEngineBtn.disabled = false;
      testEngineBtn.innerHTML = oldHtml;
    }
  }

  function setAnalyzeBusy(busy) {
    analyzeBtn.disabled = busy;
    analyzeBtnTop.disabled = busy;
    if (busy) {
      analyzeBtnTop.innerHTML = '<span class="loader" style="border-top-color:white;"></span><span>בניתוח…</span>';
    } else {
      analyzeBtnTop.innerHTML = '<span>⚙</span><span>נתח משחק זה</span>';
    }
  }

  async function runAnalysis() {
    if (!game.pgn) { toast('אין PGN למשחק זה', 'error'); return; }
    setAnalyzeBusy(true);
    showProgress();
    setProgress({ current: 0, total: 1, message: 'טוען את מנוע Stockfish…' });

    try {
      // Start clean — avoids any stuck state from a previous failed run.
      Analyzer.reset();
      const depth = Storage.getDepth();
      const result = await Analyzer.analyzeGame(game.pgn, {
        depth,
        onProgress: setProgress,
      });

      analysis = result;
      Storage.saveAnalysis(game.id, result);
      toast('הניתוח הושלם!');
      analyzeBtn.style.display = 'none';
      analyzeBanner.style.display = 'none';
      if (reanalyzeBtn) reanalyzeBtn.style.display = '';
      renderMoveList();
      renderBoard();
      renderAnalysisPanel();
      renderSummary();
      renderEvalGraph();
      updatePlayerInfo();
    } catch (e) {
      console.error(e);
      toast('שגיאה בניתוח: ' + e.message, 'error', 7000);
    } finally {
      hideProgress();
      setAnalyzeBusy(false);
    }
  }

  function init() {
    // 1. Initialize the board FIRST — this doesn't need chess.js and will at
    //    least show pieces on the starting position even if everything else
    //    breaks.
    Board.init(boardEl, arrowsEl);

    // 2. Bind handlers and nav so buttons are always responsive
    setupNav();
    analyzeBtn.onclick = runAnalysis;
    analyzeBtnTop.onclick = runAnalysis;
    if (testEngineBtn) testEngineBtn.onclick = runEngineTest;
    if (reanalyzeBtn) reanalyzeBtn.onclick = () => {
      if (!confirm('להריץ ניתוח מחדש? הניתוח הקיים יימחק.')) return;
      Storage.deleteAnalysis(game.id);
      analysis = null;
      runAnalysis();
    };

    // 3. Load the game from storage
    game = loadGame();
    if (!game) {
      Board.render(START_FEN);
      return;
    }

    // 4. Fill the info card and player names (no chess.js required)
    try { fillGameInfo(); } catch (e) { console.warn('fillGameInfo', e); }

    // Flip board for black-side games
    if (game.ourColor === 'black') Board.setFlipped(true);

    // 5. Always show the analyze banner up front when there's no done analysis.
    //    This way, even if chess.js fails later, the user can still see the
    //    call-to-action.
    analysis = Storage.getAnalysis(game.id);
    if (!analysis || analysis.status !== 'done') {
      analyzeBtn.style.display = '';
      analyzeBanner.style.display = '';
      if (reanalyzeBtn) reanalyzeBtn.style.display = 'none';
    } else {
      analyzeBtn.style.display = 'none';
      analyzeBanner.style.display = 'none';
      if (reanalyzeBtn) reanalyzeBtn.style.display = '';
    }

    // 6. Now parse PGN — wrapped in try/catch so a failure here doesn't kill
    //    the UI. If chess.js failed to load, buildHistory toasts an error and
    //    sets history = [].
    try { buildHistory(); } catch (e) { console.error('buildHistory threw', e); history = []; }

    // 7. Render everything we have, in whatever state.
    try { renderMoveList(); }      catch (e) { console.warn('renderMoveList', e); }
    try { renderBoard(); }         catch (e) { console.warn('renderBoard', e); }
    try { renderAnalysisPanel(); } catch (e) { console.warn('renderAnalysisPanel', e); }
    try { renderSummary(); }       catch (e) { console.warn('renderSummary', e); }
    try { renderEvalGraph(); }     catch (e) { console.warn('renderEvalGraph', e); }
    try { setupEvalGraphClick(); } catch (e) { console.warn('setupEvalGraphClick', e); }
    try { updatePlayerInfo(); }    catch (e) { console.warn('updatePlayerInfo', e); }

    // 8. If the chess.com piece theme finishes preloading after the first
    //    paint, re-render the board once so the nicer pieces appear.
    window.addEventListener('pieces-theme-ready', () => {
      try { renderBoard(); } catch (e) { console.warn('theme re-render', e); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

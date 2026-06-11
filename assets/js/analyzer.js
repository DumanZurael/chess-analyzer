/* ============================================
   Stockfish Analyzer
   - loads Stockfish as a Web Worker via fetch+Blob URL
     (avoids CORS issues with cross-origin Worker URLs)
   - analyses positions move-by-move
   - classifies each move quality based on eval drop
   ============================================ */

const Analyzer = (() => {
  // Multiple mirrors of stockfish.js@10.0.2 — pure-JS, no SharedArrayBuffer.
  const STOCKFISH_URLS = [
    'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
    'https://unpkg.com/stockfish.js@10.0.2/stockfish.js',
    'https://cdn.jsdelivr.net/gh/nmrugg/stockfish.js@v10.0.2/stockfish.js',
    'https://cdn.jsdelivr.net/gh/nmrugg/stockfish.js@10.0.2/stockfish.js',
  ];

  let engine = null;
  let ready = false;
  let initPromise = null;
  let lastLoadedFrom = null;

  // Single-slot request queue
  let queueTail = Promise.resolve();
  let currentResolve = null;
  let currentLastInfo = null;

  function send(cmd) {
    if (engine) engine.postMessage(cmd);
  }

  function onMessage(e) {
    const line = (typeof e.data === 'string' ? e.data : '').trim();
    if (!line) return;

    if (line.startsWith('info ')) {
      const depthM = line.match(/\bdepth\s+(\d+)/);
      const scoreM = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
      const pvM    = line.match(/\bpv\s+(.+)$/);
      if (scoreM && currentResolve) {
        currentLastInfo = {
          depth: depthM ? parseInt(depthM[1], 10) : 0,
          score: { type: scoreM[1], value: parseInt(scoreM[2], 10) },
          pv: pvM ? pvM[1].trim().split(/\s+/) : [],
        };
      }
      return;
    }

    if (line.startsWith('bestmove') && currentResolve) {
      const parts = line.split(/\s+/);
      const best = parts[1] || '';
      const info = currentLastInfo || { score: { type: 'cp', value: 0 }, pv: [], depth: 0 };
      const result = { bestMove: best, score: info.score, depth: info.depth, pv: info.pv };
      const resolve = currentResolve;
      currentResolve = null;
      currentLastInfo = null;
      resolve(result);
    }
  }

  /** Try each URL: fetch source as text, create Blob URL, spawn Worker.
   *  This bypasses cross-origin Worker restrictions. */
  function load() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      let lastErr = null;
      for (const url of STOCKFISH_URLS) {
        try {
          console.log('[analyzer] fetching Stockfish from', url);
          await tryLoadFromUrl(url);
          console.log('[analyzer] Stockfish ready (from', url, ')');
          lastLoadedFrom = url;
          ready = true;
          return;
        } catch (e) {
          console.warn('[analyzer] failed to load from', url, '→', e.message);
          lastErr = e;
          if (engine) { try { engine.terminate(); } catch (_) {} engine = null; }
        }
      }
      throw new Error('כל המראות של Stockfish נכשלו. סיבה אחרונה: ' + (lastErr?.message || 'לא ידוע') + '. ייתכן שחוסם פרסומות חוסם cdn.jsdelivr.net / unpkg.com.');
    })();
    return initPromise;
  }

  async function tryLoadFromUrl(url) {
    // Step 1: fetch source code
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const source = await res.text();
    if (source.length < 10000) {
      throw new Error('הקובץ קטן מדי (' + source.length + ' bytes) – ככל הנראה לא Stockfish');
    }

    // Step 2: create Blob URL and Worker
    const blob = new Blob([source], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('Stockfish לא הגיב תוך 30 שניות'));
      }, 30000);

      try {
        engine = new Worker(blobUrl);
      } catch (e) {
        clearTimeout(timer);
        return reject(e);
      }

      engine.onerror = (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('Worker error: ' + (e.message || e.filename || 'unknown')));
      };

      engine.onmessage = (e) => {
        if (done) return;
        const line = (typeof e.data === 'string' ? e.data : '').trim();
        if (!line) return;

        if (line === 'uciok' || line.endsWith(' uciok')) {
          send('isready');
          return;
        }
        if (line === 'readyok' || line.endsWith(' readyok')) {
          done = true;
          clearTimeout(timer);
          engine.onmessage = onMessage;
          // Try to free the blob URL — the Worker has already loaded its code
          try { URL.revokeObjectURL(blobUrl); } catch (_) {}
          resolve();
          return;
        }
      };

      try { send('uci'); }
      catch (e) { clearTimeout(timer); reject(e); }
    });
  }

  function analyzeFEN(fen, depth) {
    // Per-move timeout: tight enough that a hung engine doesn't waste a minute,
    // generous enough for deep search at high depth.
    const perMoveTimeoutMs = Math.max(15000, depth * 1500);

    const work = queueTail.catch(() => {}).then(() => new Promise((resolve, reject) => {
      if (!ready) return reject(new Error('המנוע לא מוכן'));

      // If something left the engine "busy", clear it and recover.
      if (currentResolve) {
        try { send('stop'); } catch (_) {}
        currentResolve = null;
        currentLastInfo = null;
      }

      const timer = setTimeout(() => {
        // Try to interrupt the search so the next call can use the engine.
        try { send('stop'); } catch (_) {}
        currentResolve = null;
        currentLastInfo = null;
        reject(new Error('המנוע לא הגיב בזמן (מהלך בודד, ' + Math.round(perMoveTimeoutMs / 1000) + 'ש)'));
      }, perMoveTimeoutMs);

      currentResolve = (result) => { clearTimeout(timer); resolve(result); };
      currentLastInfo = null;

      send('ucinewgame');
      send('position fen ' + fen);
      send('go depth ' + depth);
    }));

    // Keep the queue moving regardless of success/failure of this call.
    queueTail = work.catch(() => {});
    return work;
  }

  function scoreToWhiteCp(score, sideToMove) {
    if (!score) return 0;
    let cp;
    if (score.type === 'mate') {
      cp = score.value > 0 ? 10000 - score.value : -10000 - score.value;
    } else {
      cp = score.value;
    }
    return sideToMove === 'w' ? cp : -cp;
  }

  function classifyMove(cpBefore, cpAfter, wasBest, inOpening) {
    const drop = cpBefore - cpAfter;
    const dCp = Math.max(-2000, Math.min(2000, drop));

    // "Book" only applies to opening moves that don't lose meaningful eval.
    // A blunder on move 2 is still a blunder (e.g. 2...f6??).
    if (inOpening && dCp < 50) return 'book';
    if (wasBest) return 'best';

    let q;
    if (dCp >= 300)     q = 'blunder';
    else if (dCp >= 150) q = 'mistake';
    else if (dCp >= 60)  q = 'inaccuracy';
    else if (dCp >= 20)  q = 'good';
    else                 q = 'excellent';

    // In positions that are already completely decided, soften severity —
    // losing 3 pawns of eval when you're up a queen doesn't change the result.
    const decidedlyLost = cpBefore <= -600 && cpAfter <= -600;
    const decidedlyWon  = cpBefore >= 600 && cpAfter >= 300;
    if (decidedlyLost || decidedlyWon) {
      if (q === 'blunder') q = 'mistake';
      else if (q === 'mistake') q = 'inaccuracy';
    }
    return q;
  }

  async function analyzeGame(pgn, options = {}) {
    const { depth = 15, onProgress = () => {} } = options;

    onProgress({ current: 0, total: 1, message: 'טוען מנוע Stockfish…' });
    await load();

    if (typeof Chess === 'undefined') {
      throw new Error('chess.js לא נטען');
    }

    const chess = new Chess();
    const ok = chess.load_pgn(pgn, { sloppy: true });
    if (!ok) throw new Error('לא הצלחתי לטעון את ה-PGN של המשחק');

    const history = chess.history({ verbose: true });
    if (history.length === 0) throw new Error('המשחק ריק (אין מהלכים)');

    chess.reset();
    const positions = [{ fen: chess.fen(), sideToMove: 'w', terminal: null }];
    for (const mv of history) {
      chess.move(mv);
      let terminal = null;
      if (chess.in_checkmate()) terminal = 'checkmate';
      else if (chess.in_stalemate()) terminal = 'stalemate';
      else if (chess.in_draw()) terminal = 'draw';
      positions.push({ fen: chess.fen(), sideToMove: chess.turn(), terminal });
    }

    const total = history.length;
    const perMove = [];

    let whiteCpDropSum = 0, whiteCpDropCount = 0;
    let blackCpDropSum = 0, blackCpDropCount = 0;

    onProgress({ current: 0, total, message: 'מנתח מצב פתיחה...' });
    let prevAnalysis;
    try {
      prevAnalysis = await analyzeFEN(positions[0].fen, depth);
    } catch (e) {
      console.warn('[analyzer] start position failed, using neutral eval', e);
      prevAnalysis = { bestMove: 'e2e4', score: { type: 'cp', value: 0 }, depth, pv: [] };
    }
    let prevCpWhite = scoreToWhiteCp(prevAnalysis.score, positions[0].sideToMove);

    for (let i = 0; i < total; i++) {
      const moveNum = Math.floor(i / 2) + 1;
      const moverColor = i % 2 === 0 ? 'w' : 'b';
      onProgress({
        current: i,
        total,
        message: `מנתח מהלך ${moveNum}${moverColor === 'w' ? '.' : '...'} (${i + 1}/${total})`,
      });

      const move = history[i];
      const posAfter = positions[i + 1];
      const fenAfter = posAfter.fen;

      // Skip terminal positions: synthesize a result without calling the engine.
      // Stockfish can hang on mate positions (it has no move to return), and
      // analyzing checkmate is pointless anyway.
      let afterAnalysis;
      if (posAfter.terminal === 'checkmate') {
        // The side-to-move is mated. From their POV, mate-in-0 = very bad.
        // We represent it as a large negative cp value for predictable math.
        afterAnalysis = {
          bestMove: '(none)',
          score: { type: 'mate', value: 0 },
          depth,
          pv: [],
        };
      } else if (posAfter.terminal) {
        afterAnalysis = {
          bestMove: '(none)',
          score: { type: 'cp', value: 0 },
          depth,
          pv: [],
        };
      } else {
        try {
          afterAnalysis = await analyzeFEN(fenAfter, depth);
        } catch (e) {
          // Don't kill the whole analysis just because one move failed.
          // Use the previous evaluation as a placeholder.
          console.warn('[analyzer] move', i + 1, 'failed:', e.message, '— using previous eval');
          afterAnalysis = {
            bestMove: '(none)',
            score: prevAnalysis.score,
            depth,
            pv: [],
          };
        }
      }
      const cpAfterWhite = scoreToWhiteCp(afterAnalysis.score, posAfter.sideToMove);

      const moverSign = moverColor === 'w' ? 1 : -1;
      const cpBeforeMover = prevCpWhite * moverSign;
      const cpAfterMover = cpAfterWhite * moverSign;

      const expectedBest = prevAnalysis.bestMove;
      const actualUci = move.from + move.to + (move.promotion || '');
      const wasBest = expectedBest && (expectedBest.toLowerCase() === actualUci.toLowerCase());

      const inOpening = i < 8;
      const quality = classifyMove(cpBeforeMover, cpAfterMover, wasBest, inOpening);

      let bestSan = '', bestFrom = '', bestTo = '';
      if (expectedBest && expectedBest !== '(none)' && expectedBest.length >= 4) {
        bestFrom = expectedBest.slice(0, 2);
        bestTo = expectedBest.slice(2, 4);
        const tmp = new Chess(positions[i].fen);
        const promo = expectedBest.length > 4 ? expectedBest[4] : undefined;
        const made = tmp.move({ from: bestFrom, to: bestTo, promotion: promo });
        if (made) bestSan = made.san;
      }

      const cpLoss = Math.max(0, cpBeforeMover - cpAfterMover);

      perMove.push({
        ply: i + 1,
        moveNum,
        color: moverColor,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion || null,
        fenBefore: positions[i].fen,
        fenAfter,
        cpBeforeWhite: prevCpWhite,
        cpAfterWhite,
        scoreAfter: afterAnalysis.score,
        depth,
        bestMoveUci: expectedBest,
        bestSan,
        bestFrom,
        bestTo,
        wasBest,
        quality,
        cpLoss,
      });

      if (moverColor === 'w') { whiteCpDropSum += cpLoss; whiteCpDropCount++; }
      else                    { blackCpDropSum += cpLoss; blackCpDropCount++; }

      prevAnalysis = afterAnalysis;
      prevCpWhite = cpAfterWhite;
    }

    onProgress({ current: total, total, message: 'מסיים…' });

    function avgLossToAccuracy(avgLoss) {
      const x = Math.max(0, avgLoss);
      return Math.max(0, Math.min(100, 100 * Math.exp(-x / 200)));
    }
    const whiteAvgLoss = whiteCpDropCount > 0 ? whiteCpDropSum / whiteCpDropCount : 0;
    const blackAvgLoss = blackCpDropCount > 0 ? blackCpDropSum / blackCpDropCount : 0;

    return {
      perMove,
      whiteAccuracy: avgLossToAccuracy(whiteAvgLoss),
      blackAccuracy: avgLossToAccuracy(blackAvgLoss),
      whiteAvgLoss,
      blackAvgLoss,
      depth,
      status: 'done',
      timestamp: Date.now(),
    };
  }

  /** Quick sanity check: load engine and ask for best move from the start position. */
  async function selfTest() {
    await load();
    const result = await analyzeFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 10);
    return { loadedFrom: lastLoadedFrom, ...result };
  }

  function isReady() { return ready; }

  /** Terminate the current Worker and reset all state. After calling this,
   *  the next load() will start fresh. */
  function reset() {
    console.log('[analyzer] resetting engine');
    if (engine) {
      try { engine.terminate(); } catch (_) {}
      engine = null;
    }
    ready = false;
    initPromise = null;
    queueTail = Promise.resolve();
    currentResolve = null;
    currentLastInfo = null;
  }

  return {
    load,
    analyzeFEN,
    analyzeGame,
    classifyMove,
    scoreToWhiteCp,
    isReady,
    selfTest,
    reset,
  };
})();

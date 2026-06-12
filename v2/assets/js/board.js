/* ============================================
   Chess Board Renderer
   - renders an 8x8 board
   - shows last-move highlight
   - draws arrows (best-move suggestion etc.)
   - shows a "move quality" badge on the destination square
   ============================================ */

const Board = (() => {
  const FILES = ['a','b','c','d','e','f','g','h'];
  const RANKS = ['1','2','3','4','5','6','7','8'];

  let boardEl, arrowsSvg;
  let flipped = false;

  function init(boardElement, arrowsElement) {
    boardEl = boardElement;
    arrowsSvg = arrowsElement;
    buildSquares();
  }

  function setFlipped(v) {
    flipped = v;
    buildSquares();
  }

  function isFlipped() { return flipped; }

  function buildSquares() {
    boardEl.innerHTML = '';
    const orderRanks = flipped ? [...RANKS] : [...RANKS].reverse();
    const orderFiles = flipped ? [...FILES].reverse() : [...FILES];
    for (const r of orderRanks) {
      for (const f of orderFiles) {
        const sq = document.createElement('div');
        const fileIdx = FILES.indexOf(f);
        const rankIdx = RANKS.indexOf(r);
        const isLight = (fileIdx + rankIdx) % 2 === 1;
        sq.className = 'chess-square ' + (isLight ? 'light' : 'dark');
        sq.dataset.sq = f + r;

        // Coord labels: file letters on bottom rank, rank numbers on left file
        const isBottomRow = (flipped ? r === '8' : r === '1');
        const isLeftCol = (flipped ? f === 'h' : f === 'a');
        if (isBottomRow) {
          const c = document.createElement('span');
          c.className = 'coord file';
          c.textContent = f;
          sq.appendChild(c);
        }
        if (isLeftCol) {
          const c = document.createElement('span');
          c.className = 'coord rank';
          c.textContent = r;
          sq.appendChild(c);
        }

        boardEl.appendChild(sq);
      }
    }
  }

  /**
   * Renders a FEN position.
   * Options:
   *   lastMove = { from, to, quality? } — highlight + quality badge
   *   bestMove = { from, to }           — green suggestion arrow
   *   animate  = [{ from, to, capturedCode? }, ...] — slide pieces into place
   *              (chess.com-style movement animation)
   */
  function render(fen, options = {}) {
    const { lastMove = null, bestMove = null, animate = null } = options;

    // Clear pieces and highlights
    boardEl.querySelectorAll('.chess-square').forEach(sq => {
      sq.classList.remove('lastmove');
      // remove pieces & badges
      Array.from(sq.children).forEach(c => {
        if (c.classList.contains('piece') || c.classList.contains('move-quality-icon')) c.remove();
      });
    });
    if (arrowsSvg) arrowsSvg.innerHTML = '';

    // Parse FEN board portion
    const board = fen.split(' ')[0];
    const ranks = board.split('/');
    for (let i = 0; i < 8; i++) {
      const rankStr = ranks[i];
      let fileIdx = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) { fileIdx += parseInt(ch, 10); continue; }
        const isWhite = ch === ch.toUpperCase();
        const code = (isWhite ? 'w' : 'b') + ch.toUpperCase();
        const square = FILES[fileIdx] + RANKS[7 - i];
        placePiece(square, code);
        fileIdx++;
      }
    }

    if (lastMove) {
      highlightSquare(lastMove.from);
      highlightSquare(lastMove.to);
      if (lastMove.quality) showQualityBadge(lastMove.to, lastMove.quality);
    }

    if (bestMove && bestMove.from && bestMove.to) {
      drawArrow(bestMove.from, bestMove.to, '#9bce4f');
    }

    if (animate && animate.length) {
      for (const anim of animate) animatePiece(anim);
    }
  }

  function pieceImageFor(code) {
    const usePng = (typeof PIECE_PNG_OK !== 'undefined' && PIECE_PNG_OK
                    && typeof PIECE_PNG !== 'undefined' && PIECE_PNG[code]);
    return usePng ? PIECE_PNG[code] : (PIECE_SVG[code] || '');
  }

  function placePiece(square, code) {
    const sq = boardEl.querySelector(`[data-sq="${square}"]`);
    if (!sq) return;
    const p = document.createElement('div');
    p.className = 'piece';
    p.style.backgroundImage = pieceImageFor(code);
    sq.appendChild(p);
  }

  /** Slide the piece that now sits on `to` from the position of `from`.
   *  Optionally shows a ghost of the captured piece on `to` until the
   *  moving piece lands — like chess.com's capture animation. */
  function animatePiece({ from, to, capturedCode = null }) {
    const fromSq = boardEl.querySelector(`[data-sq="${from}"]`);
    const toSq = boardEl.querySelector(`[data-sq="${to}"]`);
    if (!fromSq || !toSq) return;
    const piece = toSq.querySelector('.piece');
    if (!piece) return;

    const dx = fromSq.offsetLeft - toSq.offsetLeft;
    const dy = fromSq.offsetTop - toSq.offsetTop;
    if (dx === 0 && dy === 0) return;

    // Ghost of the captured piece, removed when the mover lands
    let ghost = null;
    if (capturedCode) {
      ghost = document.createElement('div');
      ghost.className = 'piece';
      ghost.style.backgroundImage = pieceImageFor(capturedCode);
      ghost.style.position = 'absolute';
      ghost.style.inset = '6%';
      ghost.style.width = 'auto';
      ghost.style.height = 'auto';
      ghost.style.zIndex = '1';
      toSq.insertBefore(ghost, piece);
    }

    piece.style.transition = 'none';
    piece.style.transform = `translate(${dx}px, ${dy}px)`;
    piece.style.zIndex = '10';
    piece.getBoundingClientRect(); // force reflow so the transition kicks in
    piece.style.transition = 'transform 0.25s ease-out';
    piece.style.transform = 'translate(0, 0)';

    const cleanup = () => {
      piece.style.zIndex = '';
      piece.style.transition = '';
      piece.style.transform = '';
      if (ghost) { ghost.remove(); ghost = null; }
    };
    piece.addEventListener('transitionend', cleanup, { once: true });
    // Safety net in case transitionend never fires (tab hidden etc.)
    setTimeout(cleanup, 400);
  }

  function highlightSquare(square) {
    const sq = boardEl.querySelector(`[data-sq="${square}"]`);
    if (sq) sq.classList.add('lastmove');
  }

  function showQualityBadge(square, quality) {
    const sq = boardEl.querySelector(`[data-sq="${square}"]`);
    if (!sq) return;
    const badge = document.createElement('div');
    badge.className = 'move-quality-icon';
    const info = QUALITY_VISUAL[quality] || { color: '#888', symbol: '?' };
    badge.style.backgroundColor = info.color;
    badge.textContent = info.symbol;
    // place top-right (logical) inside the square
    badge.style.position = 'absolute';
    badge.style.top = '0';
    badge.style.right = '0';
    sq.appendChild(badge);
  }

  // SVG arrow between two squares
  function drawArrow(from, to, color) {
    if (!arrowsSvg) return;
    const fIdx = FILES.indexOf(from[0]);
    const rIdx = RANKS.indexOf(from[1]);
    const fIdx2 = FILES.indexOf(to[0]);
    const rIdx2 = RANKS.indexOf(to[1]);
    if (fIdx < 0 || fIdx2 < 0) return;

    const sqSize = 100; // viewBox is 800x800, 8x8 grid
    function center(file, rank) {
      const x = flipped ? (7 - file) * sqSize : file * sqSize;
      const y = flipped ? rank * sqSize : (7 - rank) * sqSize;
      return [x + sqSize / 2, y + sqSize / 2];
    }
    const [x1, y1] = center(fIdx, rIdx);
    const [x2, y2] = center(fIdx2, rIdx2);

    // Calculate arrow geometry
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = dx / len, ny = dy / len;

    // Pull arrow head back from center of dest square
    const headBack = 30;
    const ex = x2 - nx * headBack;
    const ey = y2 - ny * headBack;

    // Shorten line so head doesn't cover piece body too much
    const shaftWidth = 18;
    const headWidth = 32;
    const headLength = 36;

    // Side normals
    const sx = -ny, sy = nx;

    // Shaft as a thick polygon, plus arrowhead triangle
    const shaftStartX = x1 + nx * 20;
    const shaftStartY = y1 + ny * 20;
    const shaftEndX = ex;
    const shaftEndY = ey;

    const points = [
      [shaftStartX + sx * shaftWidth / 2, shaftStartY + sy * shaftWidth / 2],
      [shaftEndX + sx * shaftWidth / 2, shaftEndY + sy * shaftWidth / 2],
      [shaftEndX + sx * headWidth / 2, shaftEndY + sy * headWidth / 2],
      [x2, y2], // tip
      [shaftEndX - sx * headWidth / 2, shaftEndY - sy * headWidth / 2],
      [shaftEndX - sx * shaftWidth / 2, shaftEndY - sy * shaftWidth / 2],
      [shaftStartX - sx * shaftWidth / 2, shaftStartY - sy * shaftWidth / 2],
    ];

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));
    poly.setAttribute('fill', color);
    poly.setAttribute('opacity', '0.85');
    poly.setAttribute('stroke', 'rgba(0,0,0,0.4)');
    poly.setAttribute('stroke-width', '2');
    arrowsSvg.appendChild(poly);
  }

  return {
    init,
    setFlipped,
    isFlipped,
    render,
  };
})();

// Visual encoding for move quality badges
const QUALITY_VISUAL = {
  brilliant: { color: '#1baaa6', symbol: '!!' },
  great:     { color: '#5b8baf', symbol: '!' },
  best:      { color: '#9bce4f', symbol: '★' },
  excellent: { color: '#95b776', symbol: '✓' },
  good:      { color: '#94af8b', symbol: '✓' },
  book:      { color: '#a88865', symbol: '📖' },
  inaccuracy:{ color: '#f7c046', symbol: '?!' },
  mistake:   { color: '#ffa459', symbol: '?' },
  blunder:   { color: '#fa412d', symbol: '??' },
};

const QUALITY_HE = {
  brilliant: 'מבריק',
  great: 'מצוין',
  best: 'הטוב ביותר',
  excellent: 'מצוין',
  good: 'טוב',
  book: 'פתיחה',
  inaccuracy: 'אי-דיוק',
  mistake: 'טעות',
  blunder: 'פאדיחה',
};

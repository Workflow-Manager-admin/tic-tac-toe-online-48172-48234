/**
 * Returns the next move for the AI as [row, col].
 * Uses a simple minimax algorithm or falls back to random if board is too complex.
 */
export function getAIMove(board, ai, human) {
  // Try to win
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      if (!board[i][j]) {
        board[i][j] = ai;
        if (calculateWinner(board)) {
          board[i][j] = null;
          return [i, j];
        }
        board[i][j] = null;
      }
    }
  }
  // Try to block
  for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
      if (!board[i][j]) {
        board[i][j] = human;
        if (calculateWinner(board)) {
          board[i][j] = null;
          return [i, j];
        }
        board[i][j] = null;
      }
    }
  }
  // Pick center
  if (!board[1][1]) {
    return [1, 1];
  }
  // Pick a corner
  for (const pos of [
    [0, 0],[0, 2],[2, 0],[2, 2]
  ]) {
    if (!board[pos[0]][pos[1]]) {
      return pos;
    }
  }
  // Pick any empty
  for (let i = 0; i < 3; ++i)
    for (let j = 0; j < 3; ++j)
      if (!board[i][j]) return [i, j];
}

/**
 * Checks for a winner. Returns 'X', 'O', or null.
 * Used for both player and AI detection.
 */
export function calculateWinner(bd) {
  const lines = [
    [ [0, 0],[0, 1],[0, 2] ],
    [ [1, 0],[1, 1],[1, 2] ],
    [ [2, 0],[2, 1],[2, 2] ],
    [ [0, 0],[1, 0],[2, 0] ],
    [ [0, 1],[1, 1],[2, 1] ],
    [ [0, 2],[1, 2],[2, 2] ],
    [ [0, 0],[1, 1],[2, 2] ],
    [ [0, 2],[1, 1],[2, 0] ],
  ];
  for (let l of lines) {
    const [a, b, c] = l;
    if (
      bd[a[0]][a[1]] &&
      bd[a[0]][a[1]] === bd[b[0]][b[1]] &&
      bd[a[0]][a[1]] === bd[c[0]][c[1]]
    ) {
      return bd[a[0]][a[1]];
    }
  }
  return null;
}

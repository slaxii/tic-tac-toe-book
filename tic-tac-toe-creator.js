const fs = require('fs');

const SIZE = 3;
const FILE_NAME_TXT = 'tictactoe_paths.txt';
const FILE_NAME_CSV = 'tictactoe_paths.csv';

let currentPage = 1;
const pages = {};

/**
 * Entry point: generates all possible "choose-your-adventure" pages
 * where the user is always 'X' and the computer is always 'O'.
 * Only 'X' turns produce pages; 'O' plays silently in the background.
 */
function generatePaths() {
  // Start with an empty board
  const initialBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
  const initialKey = getBoardKey(initialBoard);
  // Create the initial page record and enqueue it.
  pages[initialKey] = {
    page: currentPage++,
    board: initialBoard,
    content: '',
    contentCsv: [],
  };

  const queue = [initialKey];

  while (queue.length > 0) {
    const boardKey = queue.shift();
    const record = pages[boardKey];
    const board = record.board;
    let content = `Page ${record.page}\n\n${formatBoard(board)}\n`;
    const movesCount = countMoves(board);
    const winner = checkWinner(board);

    // Prepare CSV content: 21 cells
    // [0]: page number, [1]: lost message, [2]: draw message,
    // [3-11]: move links for each cell (if available),
    // [12-20]: board cell fills.
    const csv = new Array(21).fill('');
    csv[0] = record.page;

    // Fill board symbols into csv indices 12 to 20.
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        csv[12 + (i * SIZE + j)] = board[i][j];
      }
    }

    if (winner) {
      content += `Game Over! Winner: ${winner}\n`;
      csv[1] = "You lost!";
    } else if (movesCount === SIZE * SIZE) {
      content += `Game Over! It's a draw.\n`;
      csv[2] = "It's a draw!";
    } else {
      content += `Choose your next move (You are X):\n`;
      // Iterate cells in row-major order.
      for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
          if (board[i][j] === '') {
            const newBoard = copyBoard(board);
            // Place X (user's move)
            newBoard[i][j] = 'X';

            // Check if X’s move ended the game.
            const winnerAfterX = checkWinner(newBoard);
            const movesAfterX = countMoves(newBoard);

            // If game not over, let O (the computer) play its best move silently.
            if (!winnerAfterX && movesAfterX < SIZE * SIZE) {
              const { row: bestRow, col: bestCol } = getBestMove(newBoard);
              newBoard[bestRow][bestCol] = 'O';
            }

            const newKey = getBoardKey(newBoard);
            let nextPage;

            if (pages[newKey]) {
              nextPage = pages[newKey].page;
            }
            else {
              // Assign new page number and enqueue for processing.
              nextPage = currentPage++;
              pages[newKey] = {
                page: nextPage,
                board: newBoard,
                content: '',
                contentCsv: [],
              };
              queue.push(newKey);
            }

            content += `- Move to (row ${i + 1}, col ${j + 1}) -> Go to page ${nextPage}\n`;
            // Set move link in CSV at index: 3 + (i*SIZE+j)
            csv[3 + (i * SIZE + j)] = nextPage;
          }
        }
      }
    }

    record.content = content;
    record.contentCsv = csv;
  }
  return pages;
}

/**
 * The computer uses a minimax-based approach to select the best move for O.
 * Returns {row, col}.
 */
function getBestMove(board) {
  let bestVal = -Infinity;
  let bestMove = { row: -1, col: -1 };

  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (board[i][j] === '') {
        board[i][j] = 'O';
        const moveVal = minimax(board, false); // next turn is X => isMaximizing = false
        board[i][j] = '';
        if (moveVal > bestVal) {
          bestVal = moveVal;
          bestMove = { row: i, col: j };
        }
      }
    }
  }

  return bestMove;
}

/**
 * Minimax function:
 * - isMaximizing = true => O's turn (maximizing)
 * - isMaximizing = false => X's turn (minimizing)
 */
function minimax(board, isMaximizing) {
  const score = evaluateBoard(board);
  if (score !== 0) return score;
  if (countMoves(board) === SIZE * SIZE) return 0; // draw

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (board[i][j] === '') {
          board[i][j] = 'O';
          const value = minimax(board, false);
          board[i][j] = '';
          bestScore = Math.max(bestScore, value);
        }
      }
    }
    return bestScore;
  } else {
    let bestScore = +Infinity;
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (board[i][j] === '') {
          board[i][j] = 'X';
          const value = minimax(board, true);
          board[i][j] = '';
          bestScore = Math.min(bestScore, value);
        }
      }
    }
    return bestScore;
  }
}

/**
 * Evaluate the board for minimax:
 * +10 => O wins
 * -10 => X wins
 *  0  => no winner
 */
function evaluateBoard(board) {
  const w = checkWinner(board);
  if (w === 'O') return +10;
  if (w === 'X') return -10;
  return 0;
}

// -----------------------------------
// Utility Functions
// -----------------------------------

/**
 * Produce a unique string for each board state,
 * replacing empty cells with '_' to preserve position data.
 */
function getBoardKey(board) {
  return board
    .flat()
    .map(cell => (cell === '' ? '_' : cell))
    .join();
}

/** Copy the board (2D array) */
function copyBoard(board) {
  return board.map(row => [...row]);
}

/** Format board for printing: empty => '.' */
function formatBoard(board) {
  return board
    .map(row => row.map(cell => (cell === '' ? '.' : cell)).join(' '))
    .join('\n');
}

/** Return how many cells are filled */
function countMoves(board) {
  return board.flat().filter(cell => cell !== '').length;
}

/**
 * Check for a winner: returns 'X', 'O', or null (no winner).
 */
function checkWinner(board) {
  // Gather rows, columns, and diagonals.
  const lines = [];

  for (let i = 0; i < SIZE; i++) {
    lines.push(board[i]); // row i
    lines.push(board.map(row => row[i])); // column i
  }

  // Diagonals
  lines.push(board.map((row, i) => row[i]));            // main diagonal
  lines.push(board.map((row, i) => row[SIZE - 1 - i]));   // anti-diagonal

  // Check if any line is fully 'X' or 'O'
  for (const line of lines) {
    if (line.every(cell => cell === 'X')) return 'X';
    if (line.every(cell => cell === 'O')) return 'O';
  }
  return null;
}

/**
 * Write all pages into a text file, sorted by page number.
 */
function writeToFile(pages) {
  const totalPages = Object.keys(pages).length;
  let content = `All Valid Tic-Tac-Toe Game Paths (User=X, Computer=O)\n`;
  content += `Computer's move is silently applied right after X.\n`;
  content += `Total Pages: ${totalPages}\n\n`;
  let contentCSV = "PAGE,LOST,DRAW,POS1_NUMBER,POS2_NUMBER,POS3_NUMBER,POS4_NUMBER,POS5_NUMBER,POS6_NUMBER,POS7_NUMBER,POS8_NUMBER,POS9_NUMBER,POS1_SYMBOL,POS2_SYMBOL,POS3_SYMBOL,POS4_SYMBOL,POS5_SYMBOL,POS6_SYMBOL,POS7_SYMBOL,POS8_SYMBOL,POS9_SYMBOL\n";

  const sorted = Object.values(pages).sort((a, b) => a.page - b.page);
  for (const { content: pageContent, contentCsv } of sorted) {
    content += pageContent + '\n\n' + '-'.repeat(40) + '\n\n';
    contentCSV += contentCsv.join(',') + "\n";
  }

  fs.writeFileSync(FILE_NAME_TXT, content, 'utf8');
  fs.writeFileSync(FILE_NAME_CSV, contentCSV, 'utf8');
  console.log(`File "${FILE_NAME_TXT}" written with ${totalPages} pages.`);
  console.log(`File "${FILE_NAME_CSV}" written with ${totalPages} pages.`);
}

const paths = generatePaths();
writeToFile(paths);

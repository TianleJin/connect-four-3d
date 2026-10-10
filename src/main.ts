import { WorkerBot } from './ai/asyncBot';
import { DIFFICULTIES } from './ai/difficulty';
import { Game, type Player } from './core/game';
import { BoardScene } from './render/scene';
import { DEFAULT_SETTINGS, Overlay, PLAYER_NAMES, difficultyLabel, type Settings } from './ui/overlay';
import './ui/style.css';

/** Shortest time the bot appears to think, so its reply doesn't feel instant. */
const MIN_BOT_MS = 550;
const SETTINGS_KEY = 'connect-four.settings';

type Controller = 'human' | 'bot';

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    const s = { ...DEFAULT_SETTINGS, ...saved };
    const valid =
      ['bot', 'friend'].includes(s.opponent) &&
      s.difficulty in DIFFICULTIES &&
      [0, 1, 'random'].includes(s.side);
    return valid ? s : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked; settings just won't persist.
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const scene = new BoardScene(document.getElementById('scene')!);
const overlay = new Overlay(document.getElementById('ui')!, loadSettings());
const bot = new WorkerBot();
const game = new Game();

let settings = loadSettings();
let controllers: [Controller, Controller] = ['human', 'human'];
let current: AbortController | null = null;

overlay.onStart = (s) => {
  settings = s;
  saveSettings(s);
  void newGame();
};
overlay.onNewGame = () => void newGame();
overlay.setStatus('Choose a game', null);
overlay.showMenu(false);

/** Ends any game in progress (cancelling a bot search or a pending click) and starts a new one. */
async function newGame(): Promise<void> {
  current?.abort();
  const session = new AbortController();
  current = session;
  const { signal } = session;

  scene.setInput(null);
  overlay.hideResult();
  await scene.clearBoard();
  if (signal.aborted) return;

  game.reset();
  if (settings.opponent === 'friend') {
    controllers = ['human', 'human'];
    overlay.setMatchLabel('Two players · pass and play');
  } else {
    const human: Player = settings.side === 'random' ? (Math.random() < 0.5 ? 0 : 1) : settings.side;
    controllers = human === 0 ? ['human', 'bot'] : ['bot', 'human'];
    overlay.setMatchLabel(`You are ${PLAYER_NAMES[human]} · ${difficultyLabel(settings.difficulty)} bot`);
  }

  try {
    await playLoop(signal);
  } catch (err) {
    if (!signal.aborted) {
      console.error(err);
      overlay.setStatus('Something went wrong. Start a new game.', null);
    }
  }
}

/** One loop for every kind of turn: ask the side to move for a column, then drop it. */
async function playLoop(signal: AbortSignal): Promise<void> {
  while (game.status === 'playing') {
    const player = game.currentPlayer;
    const col = controllers[player] === 'human' ? await humanMove(player, signal) : await botMove(player, signal);
    signal.throwIfAborted();
    const cell = game.play(col);
    await scene.dropDisc(cell, player);
    signal.throwIfAborted();
  }
  showResult();
}

function humanMove(player: Player, signal: AbortSignal): Promise<number> {
  const vsBot = controllers.includes('bot');
  overlay.setStatus(vsBot ? 'Your move' : `${PLAYER_NAMES[player]} to move`, player);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      scene.setInput(null);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    scene.onColumnSelect = (col) => {
      if (!game.canPlay(col)) return;
      signal.removeEventListener('abort', onAbort);
      scene.setInput(null);
      resolve(col);
    };
    scene.setInput(player, (col) => game.canPlay(col));
  });
}

async function botMove(player: Player, signal: AbortSignal): Promise<number> {
  overlay.setStatus('Bot is thinking…', player, true);
  const [col] = await Promise.all([
    bot.chooseMove(game.history, settings.difficulty, signal),
    delay(MIN_BOT_MS, signal),
  ]);
  return col;
}

function showResult(): void {
  const winner = game.winner;
  const vsBot = controllers.includes('bot');
  const moves = `${game.history.length} moves`;
  if (winner === null) {
    overlay.setStatus('Draw', null);
    overlay.showResult('A draw', `The board is full after ${moves}.`, null);
    return;
  }
  scene.highlightWin(game.winningCells);
  if (!vsBot) {
    overlay.setStatus(`${PLAYER_NAMES[winner]} wins`, winner);
    overlay.showResult(`${PLAYER_NAMES[winner]} wins!`, `Four in a row in ${moves}.`, winner);
  } else if (controllers[winner] === 'human') {
    overlay.setStatus('You win', winner);
    overlay.showResult('You win!', `You beat the ${difficultyLabel(settings.difficulty)} bot in ${moves}.`, winner);
  } else {
    overlay.setStatus('The bot wins', winner);
    overlay.showResult('The bot wins', `Four in a row in ${moves}. Try again?`, winner);
  }
}

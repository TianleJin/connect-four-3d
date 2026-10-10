import type { Difficulty } from '../ai/difficulty';
import type { Player } from '../core/game';

export type Opponent = 'bot' | 'friend';
export type Side = Player | 'random';

export interface Settings {
  opponent: Opponent;
  difficulty: Difficulty;
  /** Which player the human is when playing the bot; 0 moves first. */
  side: Side;
}

export const DEFAULT_SETTINGS: Settings = { opponent: 'bot', difficulty: 'medium', side: 0 };

export const PLAYER_NAMES: Record<Player, string> = { 0: 'Red', 1: 'Yellow' };

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A row of toggle buttons that behaves as a radio group. */
function segmented<T>(
  name: string,
  choices: Choice<T>[],
  initial: T,
  onChange: (value: T) => void,
): { root: HTMLElement; set(value: T): void } {
  const root = el('div', 'segmented');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', name);
  const buttons = choices.map((c) => {
    const b = el('button', 'segment');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.append(el('span', 'segment-label', c.label));
    if (c.hint) b.append(el('span', 'segment-hint', c.hint));
    b.addEventListener('click', () => {
      set(c.value);
      onChange(c.value);
    });
    root.append(b);
    return b;
  });
  const set = (value: T) => {
    choices.forEach((c, i) => {
      const on = c.value === value;
      buttons[i]!.classList.toggle('active', on);
      buttons[i]!.setAttribute('aria-checked', String(on));
    });
  };
  set(initial);
  return { root, set };
}

/**
 * HTML overlay on top of the 3D view: the start menu, a status line, game
 * buttons and the end-of-game banner. It only reports clicks; main.ts decides
 * what they do.
 */
export class Overlay {
  onStart: (settings: Settings) => void = () => {};
  onNewGame: () => void = () => {};

  private settings: Settings;
  private menu: HTMLElement;
  private statusText: HTMLElement;
  private statusDot: HTMLElement;
  private statusRow: HTMLElement;
  private matchLabel: HTMLElement;
  private hud: HTMLElement;
  private result: HTMLElement;
  private resultTitle: HTMLElement;
  private resultSub: HTMLElement;
  private sideRow: HTMLElement;
  private difficultyRow: HTMLElement;
  private cancel: HTMLButtonElement;
  private resultWasOpen = false;

  constructor(root: HTMLElement, initial: Settings) {
    this.settings = { ...initial };

    // Heads-up display.
    this.hud = el('div', 'hud');
    this.statusRow = el('div', 'status');
    this.statusRow.setAttribute('role', 'status');
    this.statusRow.setAttribute('aria-live', 'polite');
    this.statusDot = el('span', 'dot');
    this.statusText = el('span', 'status-text');
    this.matchLabel = el('span', 'match');
    this.statusRow.append(this.statusDot, this.statusText);
    const actions = el('div', 'actions');
    const newGame = this.button('New game', 'ghost', () => this.onNewGame());
    const settings = this.button('Settings', 'ghost', () => this.showMenu());
    actions.append(newGame, settings);
    const top = el('div', 'hud-top');
    const left = el('div', 'hud-left');
    left.append(this.statusRow, this.matchLabel);
    top.append(left, actions);
    this.hud.append(top);

    // Start / settings menu.
    this.menu = el('div', 'menu-backdrop');
    const panel = el('div', 'panel menu');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'menu-title');
    const title = el('h1', 'title', 'Connect Four');
    title.id = 'menu-title';
    const subtitle = el('p', 'subtitle', 'Four in a row by the fire.');

    const opponent = segmented<Opponent>(
      'Opponent',
      [
        { value: 'bot', label: 'Bot' },
        { value: 'friend', label: 'Friend', hint: 'same device' },
      ],
      this.settings.opponent,
      (v) => {
        this.settings.opponent = v;
        this.syncMenu();
      },
    );
    const difficulty = segmented<Difficulty>(
      'Difficulty',
      (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] })),
      this.settings.difficulty,
      (v) => (this.settings.difficulty = v),
    );
    const side = segmented<Side>(
      'Your discs',
      [
        { value: 0, label: 'Red', hint: 'move first' },
        { value: 1, label: 'Yellow', hint: 'move second' },
        { value: 'random', label: 'Random' },
      ],
      this.settings.side,
      (v) => (this.settings.side = v),
    );
    this.difficultyRow = this.field('Difficulty', difficulty.root);
    this.sideRow = this.field('Your discs', side.root);

    const start = this.button('Play', 'primary', () => {
      this.resultWasOpen = false;
      this.hideMenu();
      this.onStart({ ...this.settings });
    });
    this.cancel = this.button('Back to game', 'ghost', () => this.hideMenu());
    const menuActions = el('div', 'actions');
    menuActions.append(start, this.cancel);
    const help = el(
      'p',
      'help',
      'Click a column to drop a disc. Drag to look around, scroll or pinch to zoom. Keys: ← → and Enter, or 1–7.',
    );
    panel.append(title, subtitle, this.field('Opponent', opponent.root), this.difficultyRow, this.sideRow, menuActions, help);
    this.menu.append(panel);

    // End-of-game banner.
    this.result = el('div', 'panel result');
    this.result.setAttribute('role', 'alert');
    this.resultTitle = el('h2', 'result-title');
    this.resultSub = el('p', 'result-sub');
    const again = el('div', 'actions');
    again.append(
      this.button('Play again', 'primary', () => this.onNewGame()),
      this.button('Settings', 'ghost', () => this.showMenu()),
    );
    this.result.append(this.resultTitle, this.resultSub, again);

    root.append(this.hud, this.result, this.menu);
    this.syncMenu();
    this.hideResult();

    // While the menu is open, keys belong to it (Tab, Enter on buttons), not to the board.
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.menu.hidden) return;
        if (e.key === 'Escape' && !this.cancel.hidden) this.hideMenu();
        e.stopPropagation();
      },
      { capture: true },
    );
  }

  /** Opens the menu. With `cancellable`, it can be closed to return to the game in progress. */
  showMenu(cancellable = true): void {
    this.cancel.hidden = !cancellable;
    this.resultWasOpen = !this.result.hidden;
    this.hideResult();
    this.menu.hidden = false;
    this.hud.classList.add('dimmed');
    this.menu.querySelector<HTMLButtonElement>('.primary')?.focus();
  }

  hideMenu(): void {
    if (this.resultWasOpen) this.result.hidden = false;
    this.resultWasOpen = false;
    this.menu.hidden = true;
    this.hud.classList.remove('dimmed');
  }

  /** Shows whose turn it is. `thinking` adds a spinner. */
  setStatus(text: string, player: Player | null, thinking = false): void {
    this.statusText.textContent = text;
    this.statusDot.dataset.player = player === null ? '' : String(player);
    this.statusRow.classList.toggle('thinking', thinking);
  }

  setMatchLabel(text: string): void {
    this.matchLabel.textContent = text;
  }

  showResult(title: string, subtitle: string, player: Player | null): void {
    this.resultTitle.textContent = title;
    this.resultSub.textContent = subtitle;
    this.result.dataset.player = player === null ? '' : String(player);
    this.result.hidden = false;
  }

  hideResult(): void {
    this.result.hidden = true;
  }

  private syncMenu(): void {
    const vsBot = this.settings.opponent === 'bot';
    this.difficultyRow.hidden = !vsBot;
    this.sideRow.hidden = !vsBot;
  }

  private field(label: string, control: HTMLElement): HTMLElement {
    const row = el('div', 'field');
    row.append(el('div', 'field-label', label), control);
    return row;
  }

  private button(label: string, kind: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', `btn ${kind}`, label);
    b.type = 'button';
    b.addEventListener('click', () => {
      // Hand focus back to the page so arrow keys and Enter drive the board again.
      b.blur();
      onClick();
    });
    return b;
  }
}

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABELS[d];
}

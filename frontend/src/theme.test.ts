import html from '../index.html?raw';
import css from './index.css?raw';

const AA_TEXT = 4.5;
const AA_UI = 3;
const MAX_DARK_LUMINANCE = 0.06;

const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const declared = new Set(Array.from(root.matchAll(/--([\w-]+)\s*:/g), (m) => m[1]));
const hexTokens = new Map(
  Array.from(
    root.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi),
    (m) => [m[1], m[2]] as [string, string],
  ),
);

function token(name: string): string {
  const hex = hexTokens.get(name);
  if (!hex) throw new Error(`--${name} is not a hex colour token in :root`);
  return hex;
}

function channels(hex: string): [number, number, number] {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`${hex} is not a #rgb or #rrggbb colour`);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

type Pair = [label: string, foreground: string, background: string];

const SURFACES = ['bg', 'surface', 'surface-2', 'surface-hover', 'surface-raised', 'field-bg'];

const TEXT_PAIRS: Pair[] = [
  ['body text on the page', 'text', 'bg'],
  ['body text on a card', 'text', 'surface'],
  ['body text on a table header', 'text', 'surface-2'],
  ['body text on a hovered row', 'text', 'surface-hover'],
  ['body text in an input', 'text', 'field-bg'],
  ['body text in a toast', 'text', 'surface-raised'],
  ['muted text on the page', 'muted', 'bg'],
  ['muted text on a card', 'muted', 'surface'],
  ['muted text on a table header', 'muted', 'surface-2'],
  ['muted text on a hovered row', 'muted', 'surface-hover'],
  ['placeholder text in an input', 'muted', 'field-bg'],
  ['links on the page', 'accent', 'bg'],
  ['links on a card', 'accent', 'surface'],
  ['links on a hovered row', 'accent', 'surface-hover'],
  ['field errors on a card', 'danger', 'surface'],
  ['label on a primary button', 'on-primary', 'primary'],
  ['label on a hovered primary button', 'on-primary', 'primary-hover'],
  ['error alert text', 'danger-soft-fg', 'danger-soft-bg'],
  ['draft badge', 'draft-fg', 'draft-bg'],
  ['pending badge', 'pending-fg', 'pending-bg'],
  ['paid badge', 'paid-fg', 'paid-bg'],
  ['overdue badge', 'overdue-fg', 'overdue-bg'],
];

const UI_PAIRS: Pair[] = [
  ['input border on a card', 'border-strong', 'surface'],
  ['input border on the page', 'border-strong', 'bg'],
  ['input border against its own fill', 'border-strong', 'field-bg'],
  ['focus ring on the page', 'accent', 'bg'],
  ['focus ring on a card', 'accent', 'surface'],
  ['focused input border', 'accent', 'field-bg'],
  ['invalid input border', 'danger', 'field-bg'],
  ['primary button fill on a card', 'primary', 'surface'],
  ['primary button fill on the page', 'primary', 'bg'],
  ['success toast rule', 'paid-fg', 'surface-raised'],
  ['error toast rule', 'danger', 'surface-raised'],
  ['info toast rule', 'accent', 'surface-raised'],
];

describe('dark theme', () => {
  it('loads the stylesheet source instead of an empty module', () => {
    expect(css.length).toBeGreaterThan(1000);
    expect(root).not.toBe('');
  });

  it('declares a dark colour scheme so native controls follow', () => {
    expect(root).toMatch(/color-scheme:\s*dark\b/);
  });

  it.each(SURFACES)('--%s is a dark surface', (name) => {
    expect(luminance(token(name))).toBeLessThan(MAX_DARK_LUMINANCE);
  });

  describe('text contrast, WCAG AA 4.5:1', () => {
    it.each(TEXT_PAIRS)('%s', (_label, foreground, background) => {
      expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('control and indicator contrast, WCAG AA 3:1', () => {
    it.each(UI_PAIRS)('%s', (_label, foreground, background) => {
      expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AA_UI);
    });
  });

  it('only references custom properties that :root defines', () => {
    const used = new Set(Array.from(css.matchAll(/var\(\s*--([\w-]+)/g), (m) => m[1]));
    expect(Array.from(used).filter((name) => !declared.has(name))).toEqual([]);
  });

  it('keeps colour literals inside :root so no light patch survives', () => {
    const outsideRoot = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root\s*\{[^}]*\}/, '');
    expect(outsideRoot.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it('tints the focus glow of an invalid field with the danger colour', () => {
    const block = /\[aria-invalid='true'\]\)?:focus[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/box-shadow:[^;]*var\(--danger\)/);
  });

  it('primes the browser with the same dark scheme before the stylesheet loads', () => {
    expect(html).toMatch(/<meta\s+name="color-scheme"\s+content="dark"\s*\/?>/);
    const themeColor = /<meta\s+name="theme-color"\s+content="(#[0-9a-f]{6})"/i.exec(html)?.[1];
    expect(themeColor?.toLowerCase()).toBe(token('bg').toLowerCase());
  });
});

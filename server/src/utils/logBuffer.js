const MAX_ENTRIES = 400;

const entries = [];
const listeners = new Set();

let counter = 0;
let captured = false;

const REDACTIONS = [
  [/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, '$1***:***@'],
  [/(bearer\s+)[A-Za-z0-9._-]+/gi, '$1***'],
  [/eyJ[A-Za-z0-9._-]{10,}/g, '***'],
  [/("?(?:password|passcode|secret|token|authorization)"?\s*[:=]\s*)("?)[^\s,"}]+\2/gi, '$1$2***$2'],
];

export function redact(text) {
  let output = String(text);
  for (const [pattern, replacement] of REDACTIONS) output = output.replace(pattern, replacement);
  return output;
}

function format(args) {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    })
    .join(' ');
}

export function record(level, args) {
  counter += 1;

  const entry = {
    id: counter,
    ts: Date.now(),
    level,
    message: redact(format(args)).slice(0, 1200),
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  for (const listener of listeners) {
    try {
      listener(entry);
    } catch (error) {
      return;
    }
  }

  return entry;
}

export function listEntries(limit = MAX_ENTRIES) {
  return entries.slice(Math.max(0, entries.length - limit));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function captureConsole() {
  if (captured) return;
  captured = true;

  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      record(level === 'log' ? 'info' : level, args);
      original(...args);
    };
  }
}

export function resetLogBuffer() {
  entries.length = 0;
  listeners.clear();
  counter = 0;
}

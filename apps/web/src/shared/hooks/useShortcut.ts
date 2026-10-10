import { useEffect } from 'react';

type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutEntry {
  keys: string[];
  handler: ShortcutHandler;
  description?: string;
}

const registeredShortcuts = new Map<string, ShortcutEntry[]>();

function keysMatch(event: KeyboardEvent, keys: string[]): boolean {
  return keys.every((key) => {
    if (key === 'ctrl') return event.ctrlKey || event.metaKey;
    if (key === 'shift') return event.shiftKey;
    if (key === 'alt') return event.altKey;
    if (key === 'meta') return event.metaKey;
    return event.key.toLowerCase() === key.toLowerCase();
  });
}

export function useShortcut(keys: string[], handler: ShortcutHandler, description?: string): void {
  useEffect(() => {
    const id = Math.random().toString(36).slice(2);
    const entry: ShortcutEntry = description ? { keys, handler, description } : { keys, handler };

    if (!registeredShortcuts.has(id)) {
      registeredShortcuts.set(id, []);
    }
    registeredShortcuts.get(id)!.push(entry);

    return () => {
      const entries = registeredShortcuts.get(id);
      if (entries) {
        const index = entries.indexOf(entry);
        if (index !== -1) entries.splice(index, 1);
        if (entries.length === 0) {
          // Map ini hanya menyimpan registrasi pintasan lokal, bukan data operasional.
          // eslint-disable-next-line no-restricted-syntax
          registeredShortcuts.delete(id);
        }
      }
    };
  }, [keys, handler, description]);
}

function handleKeyDown(event: KeyboardEvent): void {
  const activeElement = document.activeElement;
  const isInput =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable);

  for (const entries of registeredShortcuts.values()) {
    for (const entry of entries) {
      if (keysMatch(event, entry.keys)) {
        const allowedWhileTyping = entry.keys.some((key) =>
          ['F2', 'F3', 'F4', 'Escape'].includes(key),
        );
        if (isInput && !allowedWhileTyping) {
          continue;
        }
        event.preventDefault();
        entry.handler(event);
        return;
      }
    }
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('keydown', handleKeyDown);
}

export function getRegisteredShortcuts(): { keys: string[]; description?: string }[] {
  const result: { keys: string[]; description?: string }[] = [];
  for (const entries of registeredShortcuts.values()) {
    for (const entry of entries) {
      if (entry.description) {
        result.push({ keys: entry.keys, description: entry.description });
      }
    }
  }
  return result;
}

"use client";

/**
 * The single keyboard shortcut registry (docs/14-frontend-implementation-plan.md §F0:
 * "a single registry that owns bindings, scopes, and the `?` overlay. Built now because
 * F5 depends on it and retrofitting a shortcut system across pages is a rewrite.").
 *
 * Two binding shapes:
 *   - Combo: a normalised key string like "mod+k", "?", "j" — fires on keydown.
 *   - Chord: a two-step "g <letter>" sequence for cross-page navigation ("go to
 *     catalog" etc.) — arms on "g", fires on the next key within CHORD_TIMEOUT_MS.
 *
 * Bindings/chords live in React state (not refs read during render) and mutable
 * "latest handler" refs are only ever written from an effect — both required for
 * compatibility with the React Compiler's render-purity rules. Handlers never await
 * the network (NFR-PERF-8) — that discipline lives with each caller, not the registry.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export interface ShortcutBinding {
  id: string;
  /** Normalised combo, e.g. "mod+k", "?", "j", "shift+enter". Omit for chord-only entries. */
  keys?: string;
  /** Display form for the `?` overlay, e.g. "⌘K", "G then D". */
  display: string;
  description: string;
  /** Groups entries in the `?` overlay; also lets a scope be disabled (e.g. outside review). */
  scope: string;
  handler: () => void;
  /** Fires even while focus is inside a text input (e.g. Escape). Default false. */
  allowInInputs?: boolean;
}

interface ChordBinding {
  id: string;
  leader: string; // e.g. "g"
  followers: Record<string, string>; // key -> description, dispatched to onChord
  onChord: (key: string) => void;
  display: string;
  description: string;
  scope: string;
}

interface RegistryContextValue {
  register: (binding: ShortcutBinding) => () => void;
  registerChord: (binding: ChordBinding) => () => void;
  bindings: ShortcutBinding[];
  chords: ChordBinding[];
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const RegistryContext = createContext<RegistryContextValue | null>(null);

const CHORD_TIMEOUT_MS = 1200;

function normaliseEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);
  return parts.join("+");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function ShortcutRegistryProvider({ children }: { children: React.ReactNode }) {
  const [bindingMap, setBindingMap] = useState<Map<string, ShortcutBinding>>(new Map());
  const [chordMap, setChordMap] = useState<Map<string, ChordBinding>>(new Map());
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const armedChord = useRef<ChordBinding | null>(null);
  const armedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const register = useCallback((binding: ShortcutBinding) => {
    setBindingMap((prev) => new Map(prev).set(binding.id, binding));
    return () =>
      setBindingMap((prev) => {
        const next = new Map(prev);
        next.delete(binding.id);
        return next;
      });
  }, []);

  const registerChord = useCallback((binding: ChordBinding) => {
    setChordMap((prev) => new Map(prev).set(binding.id, binding));
    return () =>
      setChordMap((prev) => {
        const next = new Map(prev);
        next.delete(binding.id);
        return next;
      });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(e.target);

      if (e.key === "Escape") {
        if (armedChord.current) {
          armedChord.current = null;
          if (armedTimeout.current) clearTimeout(armedTimeout.current);
        }
        setOverlayOpen((open) => (open ? false : open));
        setPaletteOpen((open) => (open ? false : open));
      }

      if (typing) return;

      // Chord follower step.
      if (armedChord.current) {
        const chord = armedChord.current;
        const key = e.key.toLowerCase();
        if (chord.followers[key]) {
          e.preventDefault();
          chord.onChord(key);
        }
        armedChord.current = null;
        if (armedTimeout.current) clearTimeout(armedTimeout.current);
        return;
      }

      // Chord leader step.
      for (const chord of chordMap.values()) {
        if (e.key.toLowerCase() === chord.leader) {
          armedChord.current = chord;
          armedTimeout.current = setTimeout(() => {
            armedChord.current = null;
          }, CHORD_TIMEOUT_MS);
          e.preventDefault();
          return;
        }
      }

      const combo = normaliseEvent(e);
      for (const binding of bindingMap.values()) {
        if (binding.keys === combo && (!typing || binding.allowInInputs)) {
          e.preventDefault();
          binding.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindingMap, chordMap]);

  const value: RegistryContextValue = {
    register,
    registerChord,
    bindings: Array.from(bindingMap.values()),
    chords: Array.from(chordMap.values()),
    overlayOpen,
    setOverlayOpen,
    paletteOpen,
    setPaletteOpen,
  };

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

function useRegistry(): RegistryContextValue {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error("Keyboard shortcut hooks must be used within ShortcutRegistryProvider");
  return ctx;
}

/** Registers a shortcut for the lifetime of the calling component. */
export function useShortcut(binding: Omit<ShortcutBinding, "id"> & { id?: string }): void {
  const { register } = useRegistry();
  const autoId = useId();
  const id = binding.id ?? autoId;
  const handlerRef = useRef(binding.handler);

  useEffect(() => {
    handlerRef.current = binding.handler;
  });

  useEffect(() => {
    return register({ ...binding, id, handler: () => handlerRef.current() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, binding.keys, binding.description, binding.scope, binding.allowInInputs]);
}

export function useChordShortcut(binding: Omit<ChordBinding, "id"> & { id?: string }): void {
  const { registerChord } = useRegistry();
  const autoId = useId();
  const id = binding.id ?? autoId;
  const onChordRef = useRef(binding.onChord);

  useEffect(() => {
    onChordRef.current = binding.onChord;
  });

  useEffect(() => {
    return registerChord({ ...binding, id, onChord: (key) => onChordRef.current(key) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, binding.leader, binding.description, binding.scope]);
}

export function useShortcutOverlay() {
  const { overlayOpen, setOverlayOpen, bindings, chords } = useRegistry();
  return { open: overlayOpen, setOpen: setOverlayOpen, bindings, chords };
}

export function useCommandPalette() {
  const { paletteOpen, setPaletteOpen } = useRegistry();
  return { open: paletteOpen, setOpen: setPaletteOpen };
}

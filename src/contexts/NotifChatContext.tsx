import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface NotifChatState {
  openChats: string[]; // expanded windows (max 3)
  minimizedChats: string[]; // pill bar
  openChat: (id: string) => void;
  minimize: (id: string) => void;
  expand: (id: string) => void;
  dismiss: (id: string) => void;
  isSuppressed: (id: string) => boolean;
  setSuppressed: (id: string | null) => void;
}

const Ctx = createContext<NotifChatState | null>(null);

const STORAGE_KEY = "notif-chat-state-v1";
const MAX_OPEN = 3;

export function NotifChatProvider({ children }: { children: ReactNode }) {
  const [openChats, setOpenChats] = useState<string[]>([]);
  const [minimizedChats, setMinimizedChats] = useState<string[]>([]);
  const [suppressed, setSuppressedState] = useState<string | null>(null);

  // hydrate
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setOpenChats(s.openChats ?? []);
        setMinimizedChats(s.minimizedChats ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ openChats, minimizedChats }));
    } catch {}
  }, [openChats, minimizedChats]);

  const openChat = useCallback((id: string) => {
    setMinimizedChats((m) => m.filter((x) => x !== id));
    setOpenChats((o) => {
      if (o.includes(id)) return o;
      const next = [id, ...o];
      if (next.length > MAX_OPEN) {
        const overflow = next.slice(MAX_OPEN);
        setMinimizedChats((m) => [...overflow.filter((x) => !m.includes(x)), ...m]);
        return next.slice(0, MAX_OPEN);
      }
      return next;
    });
  }, []);

  const minimize = useCallback((id: string) => {
    setOpenChats((o) => o.filter((x) => x !== id));
    setMinimizedChats((m) => (m.includes(id) ? m : [id, ...m]));
  }, []);

  const expand = useCallback((id: string) => {
    setMinimizedChats((m) => m.filter((x) => x !== id));
    setOpenChats((o) => {
      if (o.includes(id)) return o;
      const next = [id, ...o];
      if (next.length > MAX_OPEN) {
        const overflow = next.slice(MAX_OPEN);
        setMinimizedChats((m) => [...overflow.filter((x) => !m.includes(x)), ...m]);
        return next.slice(0, MAX_OPEN);
      }
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setOpenChats((o) => o.filter((x) => x !== id));
    setMinimizedChats((m) => m.filter((x) => x !== id));
  }, []);

  const isSuppressed = useCallback((id: string) => suppressed === id, [suppressed]);
  const setSuppressed = useCallback((id: string | null) => setSuppressedState(id), []);

  return (
    <Ctx.Provider value={{ openChats, minimizedChats, openChat, minimize, expand, dismiss, isSuppressed, setSuppressed }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifChat() {
  const v = useContext(Ctx);
  if (!v) {
    // safe no-op fallback when used outside provider (e.g. portal routes)
    return {
      openChats: [] as string[],
      minimizedChats: [] as string[],
      openChat: () => {},
      minimize: () => {},
      expand: () => {},
      dismiss: () => {},
      isSuppressed: () => false,
      setSuppressed: () => {},
    } as NotifChatState;
  }
  return v;
}

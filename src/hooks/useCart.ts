import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { trackFunnelEvent } from "@/lib/searchTracking";

interface CartItem {
  id: string;
  photoId?: string;
  videoId?: string;
  photoUrl: string;
  eventId?: string;
  eventName: string;
  /**
   * Sempre "high": a opção de resolução reduzida ("Foto Social") nunca foi
   * exposta na UI de compra (nenhum botão define "low") e a Lambda de
   * imagem não gera um arquivo comercial separado para ela — era um
   * vestígio de versões anteriores. Mantido como tipo literal em vez de
   * removido para não quebrar o shape salvo no localStorage de carrinhos
   * já existentes.
   */
  resolution: "high";
  price: number;
}

const CART_KEY = "viufoto_cart";
const CART_CHANGE_EVENT = "viufoto_cart_change";

function getSessionId() {
  let id = localStorage.getItem("viufoto_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("viufoto_session_id", id);
  }
  return id;
}

// Shared external store so all useCart() instances stay in sync
let cartSnapshot: CartItem[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
})();

function getSnapshot() {
  return cartSnapshot;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setCart(next: CartItem[] | ((prev: CartItem[]) => CartItem[])) {
  const value = typeof next === "function" ? next(cartSnapshot) : next;
  cartSnapshot = value;
  localStorage.setItem(CART_KEY, JSON.stringify(value));
  listeners.forEach(cb => cb());
  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

// Listen for changes from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) {
      try {
        cartSnapshot = JSON.parse(e.newValue || "[]");
      } catch {
        cartSnapshot = [];
      }
      listeners.forEach(cb => cb());
    }
  });
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    setCart(prev => {
      // Vídeos têm preço único (sem variação alta/baixa) — dedupe só por videoId.
      // Fotos continuam podendo ter 2 entradas (alta e baixa) para a mesma foto.
      const exists = item.videoId
        ? prev.find(i => i.videoId === item.videoId)
        : prev.find(i => i.photoId === item.photoId && !i.videoId && i.resolution === item.resolution);
      if (exists) return prev;
      const newItem = { ...item, id: crypto.randomUUID() };
      // Track funnel event (fire-and-forget)
      trackFunnelEvent({
        event_type: "add_to_cart",
        event_id: item.eventId ?? null,
        photo_id: item.photoId ?? null,
        metadata: {
          resolution: item.resolution,
          price: item.price,
          is_video: !!item.videoId,
          video_id: item.videoId ?? null,
        },
        dedupeKey: `${item.photoId || item.videoId}:${item.resolution}`,
      });
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const sessionId = getSessionId();

  return { items, addItem, removeItem, clearCart, total, count: items.length, sessionId };
}
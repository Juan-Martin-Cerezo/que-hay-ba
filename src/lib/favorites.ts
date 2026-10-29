"use client";

import { useCallback, useState } from "react";
import type { CategoryId } from "./domain";

export interface FavoriteItem {
  id: number;
  title: string;
  category: CategoryId;
  priceLabel: string;
  startsAt: string;
  venueName: string;
  barrio: string | null;
  url: string;
  lat: number;
  lng: number;
}

const STORAGE_KEY = "quehayba:favoritos:v1";

function readStorage(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>(() => readStorage());

  const isFavorite = useCallback(
    (id: number) => items.some((item) => item.id === id),
    [items]
  );

  const toggleFavorite = useCallback((item: FavoriteItem) => {
    setItems((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  return { favorites: items, isFavorite, toggleFavorite };
}

"use client";

import { useEffect } from "react";
import { categoryById } from "@/lib/domain";
import type { FavoriteItem } from "@/lib/favorites";
import { formatEventDate } from "@/lib/format";

interface FavoritesDrawerProps {
  open: boolean;
  items: FavoriteItem[];
  onClose: () => void;
  onSelect: (item: FavoriteItem) => void;
  onRemove: (item: FavoriteItem) => void;
}

export function FavoritesDrawer({
  open,
  items,
  onClose,
  onSelect,
  onRemove,
}: FavoritesDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Guardados"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-panel"
      >
        <header className="flex items-end justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="font-display text-3xl leading-none">Guardados</h2>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              {items.length} en este dispositivo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:text-fg"
          >
            ✕
          </button>
        </header>

        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
          {items.length === 0 ? (
            <li className="px-5 py-12 text-center text-sm text-muted">
              Tocá el marcador en cualquier actividad para guardarla acá.
            </li>
          ) : (
            items.map((item) => {
              const cat = categoryById[item.category] ?? categoryById.arte;
              return (
                <li key={item.id} className="flex items-start gap-3 px-5 py-4">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: cat.color }}
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="line-clamp-2 text-sm font-medium text-fg">{item.title}</span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-muted">
                      {formatEventDate(item.startsAt)} · {item.venueName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label="Quitar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-fg"
                  >
                    ✕
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

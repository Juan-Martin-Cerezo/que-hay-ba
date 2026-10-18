"use client";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ❤️ Mis planes favoritos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guardados en este dispositivo ({items.length})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar favoritos"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Todavía no guardaste actividades. Tocá &ldquo;🤍 Guardar&rdquo; en cualquier evento del
              mapa para armar tu lista de planes.
            </div>
          ) : (
            items.map((item) => {
              const cat = categoryById[item.category] ?? categoryById.arte;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                      <span>·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {item.priceLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatEventDate(item.startsAt)} · {item.venueName}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    className="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Eliminar de favoritos"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

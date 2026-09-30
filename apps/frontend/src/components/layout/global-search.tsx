"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { matchAppMenuItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useUiText } from "@/hooks/useUiText";

const MIN_QUERY_LENGTH = 2;

interface GlobalSearchProps {
  className?: string;
  onNavigate?: () => void;
  onDismiss?: () => void;
  autoFocus?: boolean;
}

export function GlobalSearch({ className, onNavigate, onDismiss, autoFocus = false }: GlobalSearchProps) {
  const router = useRouter();
  const text = useUiText();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim();
  const results = useMemo(
    () => matchAppMenuItems(normalizedQuery, 6, text),
    [normalizedQuery, text],
  );
  const showPanel = open && normalizedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!showPanel) {
      return;
    }
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showPanel]);

  const closeSearch = () => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
  };

  const submitMenuMatch = () => {
    const firstMatch = results[0];
    if (firstMatch) {
      closeSearch();
      router.push(firstMatch.href);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full max-w-md flex-1", className)}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={resultsId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        className="rounded-xl bg-card pl-9"
        placeholder={text.common.searchPlaceholder}
        aria-label={text.common.searchAriaLabel}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitMenuMatch();
          }
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
            onDismiss?.();
          }
        }}
      />

      {mounted &&
        showPanel &&
        anchor &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <div
              id={resultsId}
              role="listbox"
              aria-label={text.common.searchResultsMenu}
              className="fixed z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg"
              style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
            >
              {results.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  {text.common.noSearchResults}
                </p>
              ) : (
                <div>
                  <p className="px-4 pt-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {text.common.searchResultsMenu}
                  </p>
                  {results.map((menu) => (
                    <Link
                      key={menu.href}
                      role="option"
                      aria-selected={false}
                      href={menu.href}
                      prefetch
                      className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-accent active:bg-accent"
                      onClick={closeSearch}
                    >
                      <menu.icon className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {menu.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {menu.href}
                        </span>
                      </span>
                      <Compass className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

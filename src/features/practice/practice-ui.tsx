import type { ReactNode } from "react";
import { cardLabel, suitColor, type Card } from "@/lib/euchre";

export function PracticeBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "brass";
}) {
  return (
    <span className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
      tone === "brass" ? "border-brass/50 bg-brass text-[#201602]" : "border-white/15 text-white/55"
    }`}>
      {children}
    </span>
  );
}

export function PracticeSuitIcon({
  suit,
  label,
  compact = false,
  light = false
}: {
  suit: Card["suit"] | null;
  label: string;
  compact?: boolean;
  light?: boolean;
}) {
  if (!suit) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border ${
        compact ? "h-6 min-w-6 px-1.5 text-[10px]" : "h-7 min-w-7 px-2 text-xs"
      } ${light ? "border-[#201602]/20 bg-[#201602]/10 text-[#201602]/65" : "border-white/10 bg-white/[0.04] text-white/45"}`}>
        -
      </span>
    );
  }

  const red = suitColor(suit) === "red";
  const colorClass = light
    ? red ? "text-[#9f1239]" : "text-[#111827]"
    : red ? "text-[#ff7b8a]" : "text-white";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-black leading-none shadow-sm ${
        compact ? "h-6 min-w-6 px-1.5 text-base" : "h-7 min-w-7 px-2 text-lg"
      } ${light ? "border-[#201602]/20 bg-white/80" : "border-white/15 bg-[#fffaf0]/10"} ${colorClass}`}
      aria-label={`${label}: ${suit}`}
      title={`${label}: ${suit}`}
    >
      {displaySuitSymbol(suit)}
    </span>
  );
}

export function PracticePlayingCard({
  card,
  playable,
  winning = false,
  selected = false,
  size
}: {
  card: Card;
  playable: boolean;
  winning?: boolean;
  selected?: boolean;
  size: "hand" | "trick";
}) {
  const red = suitColor(card.suit) === "red";
  const suit = displaySuitSymbol(card.suit);
  const sizeClass = size === "hand" ? "w-full max-w-24 lg:w-20 xl:w-24" : "w-full";

  return (
    <span
      className={`playing-card relative inline-flex ${sizeClass} select-none flex-col justify-between overflow-hidden border bg-[#fffaf0] p-1.5 text-left ${
        red ? "text-[#b71c2b]" : "text-[#111827]"
      } ${playable ? "border-white" : "border-white/25 grayscale brightness-90"} ${
        winning || selected ? "ring-2 ring-brass ring-offset-2 ring-offset-[#08271f]" : ""
      }`}
      aria-hidden="true"
    >
      <span className="flex flex-col leading-none">
        <span className="text-base font-black">{card.rank}</span>
        <span className="text-lg">{suit}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-black opacity-90 xl:text-4xl">
        {suit}
      </span>
      <span className="flex rotate-180 flex-col self-end leading-none">
        <span className="text-base font-black">{card.rank}</span>
        <span className="text-lg">{suit}</span>
      </span>
    </span>
  );
}

export function PracticeMiniCard({ card, className = "" }: { card: Card; className?: string }) {
  const red = suitColor(card.suit) === "red";
  const suit = displaySuitSymbol(card.suit);

  return (
    <span className={`playing-card relative inline-flex w-10 flex-col justify-between overflow-hidden border border-white bg-[#fffaf0] p-1 text-left shadow-md shadow-black/30 ${
      red ? "text-[#b71c2b]" : "text-[#111827]"
    } ${className}`} aria-label={`Upcard ${cardLabel(card)}`}>
      <span className="flex flex-col leading-none">
        <span className="text-xs font-black">{card.rank}</span>
        <span className="text-sm">{suit}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-black opacity-90">{suit}</span>
      <span className="flex rotate-180 flex-col self-end leading-none">
        <span className="text-xs font-black">{card.rank}</span>
        <span className="text-sm">{suit}</span>
      </span>
    </span>
  );
}

export function PracticeCardBackFan({ count, compact = false }: { count: number; compact?: boolean }) {
  const visible = Math.max(0, Math.min(count, 5));
  return (
    <div className="flex min-h-12 items-center justify-center" aria-label={`${count} hidden cards`}>
      {Array.from({ length: visible }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`playing-card playing-card-back ${compact ? "-ml-6 w-9" : "-ml-7 w-14"} first:ml-0 border border-brass/45`}
          style={{ transform: `rotate(${(index - Math.floor(visible / 2)) * 4}deg)` }}
        />
      ))}
    </div>
  );
}

export function displaySuitSymbol(suit: Card["suit"]): string {
  return {
    clubs: "\u2663",
    diamonds: "\u2666",
    hearts: "\u2665",
    spades: "\u2660"
  }[suit];
}

export function suitFromLabel(value: string): Card["suit"] | null {
  return value === "clubs" || value === "diamonds" || value === "hearts" || value === "spades"
    ? value
    : null;
}

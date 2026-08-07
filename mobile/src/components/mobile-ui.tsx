import { useEffect, useId, useRef, type ReactNode } from "react";
import { cardLabel, type Card, type Suit } from "@/lib/euchre";

export function ScreenHeader({
  title,
  eyebrow,
  onBack,
  action
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <div className="screen-header__leading">
        {onBack ? (
          <button className="icon-button" type="button" onClick={onBack} aria-label="Go back">
            <span aria-hidden="true">‹</span>
          </button>
        ) : null}
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
        </div>
      </div>
      {action}
    </header>
  );
}

export function BottomNavigation({
  current,
  onNavigate
}: {
  current: "home" | "history" | "settings";
  onNavigate: (screen: "home" | "history" | "settings") => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <NavButton label="Home" symbol="⌂" active={current === "home"} onClick={() => onNavigate("home")} />
      <NavButton label="History" symbol="≡" active={current === "history"} onClick={() => onNavigate("history")} />
      <NavButton label="Settings" symbol="⚙" active={current === "settings"} onClick={() => onNavigate("settings")} />
    </nav>
  );
}

function NavButton({
  label,
  symbol,
  active,
  onClick
}: {
  label: string;
  symbol: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="bottom-nav__item" aria-current={active ? "page" : undefined} onClick={onClick}>
      <span aria-hidden="true">{symbol}</span>
      <small>{label}</small>
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onCancel();
    }}>
      <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmRef}
            type="button"
            className={destructive ? "button button--danger" : "button button--primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function SuitMark({ suit, label }: { suit: Suit; label?: string }) {
  return (
    <span className={`suit suit--${suit}`} role={label ? "img" : undefined} aria-label={label}>
      {suitSymbol(suit)}
    </span>
  );
}

export function PlayingCard({
  card,
  legal = false,
  selected = false,
  compact = false
}: {
  card: Card;
  legal?: boolean;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`playing-card${legal ? " playing-card--legal" : ""}${selected ? " playing-card--selected" : ""}${compact ? " playing-card--compact" : ""}`}
      aria-hidden="true"
    >
      <strong>{card.rank}</strong>
      <SuitMark suit={card.suit} />
    </span>
  );
}

export function cardAccessibleName(card: Card): string {
  return cardLabel(card);
}

export function suitLabel(suit?: Suit): string {
  return suit ? suit[0].toUpperCase() + suit.slice(1) : "Not selected";
}

function suitSymbol(suit: Suit): string {
  return {
    clubs: "♣",
    diamonds: "♦",
    hearts: "♥",
    spades: "♠"
  }[suit];
}

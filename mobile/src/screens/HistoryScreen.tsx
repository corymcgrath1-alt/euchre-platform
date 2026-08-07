import type { CompletedGameListItem } from "../game/solo-game-service";
import { BottomNavigation, ConfirmDialog, ScreenHeader } from "../components/mobile-ui";
import { useState } from "react";

export function HistoryScreen({
  games,
  busy,
  onOpenReview,
  onDeleteHistory,
  onNavigate
}: {
  readonly games: readonly CompletedGameListItem[];
  readonly busy: boolean;
  readonly onOpenReview: (item: CompletedGameListItem) => void;
  readonly onDeleteHistory: () => void;
  readonly onNavigate: (screen: "home" | "history" | "settings") => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <main className="app-screen history-screen" data-testid="history-screen">
      <ScreenHeader
        title="Game History"
        eyebrow="Stored on this device"
        action={games.length ? (
          <button className="button button--quiet button--compact" type="button" onClick={() => setConfirmDelete(true)}>
            Clear
          </button>
        ) : undefined}
      />
      {games.length === 0 ? (
        <section className="empty-state">
          <h2>No completed games yet</h2>
          <p>Finished solo games will appear here with their local review.</p>
        </section>
      ) : (
        <ol className="history-list">
          {games.map((item) => {
            const won = item.review.winningTeam === 0;
            return (
              <li key={item.game.id}>
                <button type="button" onClick={() => onOpenReview(item)}>
                  <span className={`outcome outcome--${won ? "win" : "loss"}`}>{won ? "Win" : "Loss"}</span>
                  <span>
                    <strong>{item.review.finalScore[0]} - {item.review.finalScore[1]}</strong>
                    <small>{new Date(item.game.completedAt ?? item.game.updatedAt).toLocaleDateString()}</small>
                  </span>
                  <span>
                    <small>{difficultyLabel(item.game.config.botDifficulty)}</small>
                    <small>First to {item.game.config.targetScore}</small>
                  </span>
                  <span aria-hidden="true">{"\u203a"}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <BottomNavigation current="history" onNavigate={onNavigate} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete completed history?"
        message="This permanently removes completed game records and reviews from this device. An active game is not affected."
        confirmLabel={busy ? "Deleting\u2026" : "Delete History"}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteHistory();
        }}
      />
    </main>
  );
}

function difficultyLabel(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

export function PracticePersistenceControls({
  gameId,
  status,
  isSaving,
  inPlayMode,
  onClearTable
}: {
  gameId: string | null;
  status: string;
  isSaving: boolean;
  inPlayMode: boolean;
  onClearTable: () => void;
}) {
  return (
    <section
      className={`${inPlayMode ? "sr-only" : ""} rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70`}
      aria-live="polite"
      data-testid="practice-persistence-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold text-white">Persistence:</span>{" "}
          {gameId ? `Game ${gameId}` : "No persisted game selected"} | {status}
        </p>
        {gameId ? (
          <button
            type="button"
            className="min-h-11 rounded border border-white/20 px-3 py-2 text-xs font-semibold text-white"
            disabled={isSaving}
            onClick={onClearTable}
          >
            Clear active table
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-white/45">An unfinished local game resumes from immutable persisted events after reload.</p>
    </section>
  );
}

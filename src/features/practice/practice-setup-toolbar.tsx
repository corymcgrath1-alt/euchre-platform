import {
  BOT_DIFFICULTIES,
  DEALER_SELECTIONS,
  FARMERS_HAND_MODES,
  LONER_MODES,
  TARGET_SCORES,
  formatBotDifficulty,
  formatDealerSelection,
  formatFarmersHandMode,
  formatLonerMode,
  type BotDifficulty,
  type DealerSelection,
  type FarmersHandMode,
  type GameState,
  type LonerMode,
  type TargetScore
} from "@/lib/euchre";

interface PracticeSetupToolbarProps {
  inPlayMode: boolean;
  phase: GameState["phase"];
  handNumber: number;
  scores: [number, number];
  targetScore: TargetScore;
  botDifficulty: BotDifficulty;
  dealerSelection: DealerSelection;
  stickDealer: boolean;
  farmersHandMode: FarmersHandMode;
  lonerMode: LonerMode;
  seedInput: string;
  lastSeed: number | null;
  isSaving: boolean;
  onTargetScoreChange: (value: TargetScore) => void;
  onBotDifficultyChange: (value: BotDifficulty) => void;
  onDealerSelectionChange: (value: DealerSelection) => void;
  onStickDealerChange: (value: boolean) => void;
  onFarmersHandModeChange: (value: FarmersHandMode) => void;
  onLonerModeChange: (value: LonerMode) => void;
  onSeedInputChange: (value: string) => void;
  onCopySeed: () => void;
  onStartGame: () => void;
}

export function PracticeSetupToolbar({
  inPlayMode,
  phase,
  handNumber,
  scores,
  targetScore,
  botDifficulty,
  dealerSelection,
  stickDealer,
  farmersHandMode,
  lonerMode,
  seedInput,
  lastSeed,
  isSaving,
  onTargetScoreChange,
  onBotDifficultyChange,
  onDealerSelectionChange,
  onStickDealerChange,
  onFarmersHandModeChange,
  onLonerModeChange,
  onSeedInputChange,
  onCopySeed,
  onStartGame
}: PracticeSetupToolbarProps) {
  const idle = phase === "idle";
  const hiddenWhenPlaying = inPlayMode ? "hidden" : "flex";

  return (
    <header className={`flex flex-col gap-2 border-b border-white/10 pb-2 lg:flex-row lg:items-end lg:justify-between ${
      inPlayMode ? "lg:items-center" : ""
    }`}>
      <div>
        <p className="text-[11px] font-semibold uppercase text-brass">Solo Practice</p>
        <h1 className={`${inPlayMode ? "mt-0 text-xl sm:text-2xl" : "mt-1 text-2xl sm:text-3xl"} font-semibold text-white`}>
          Practice table
        </h1>
        <p className="mt-0.5 text-xs text-white/55">You are South. West, North, and East are deterministic bots.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Target
          <select
            className="rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={targetScore}
            disabled={!idle}
            onChange={(event) => onTargetScoreChange(Number(event.target.value) as TargetScore)}
          >
            {TARGET_SCORES.map((score) => <option key={score} value={score}>{score}</option>)}
          </select>
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Bot difficulty
          <select
            className="rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={botDifficulty}
            disabled={!idle}
            onChange={(event) => onBotDifficultyChange(event.target.value as BotDifficulty)}
          >
            {BOT_DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>{formatBotDifficulty(difficulty)}</option>
            ))}
          </select>
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Dealer
          <select
            className="rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={dealerSelection}
            disabled={!idle}
            onChange={(event) => onDealerSelectionChange(event.target.value as DealerSelection)}
          >
            {DEALER_SELECTIONS.map((selection) => (
              <option key={selection} value={selection}>{formatDealerSelection(selection)}</option>
            ))}
          </select>
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          <input
            type="checkbox"
            checked={stickDealer}
            disabled={!idle}
            onChange={(event) => onStickDealerChange(event.target.checked)}
          />
          Stick dealer
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Farmer
          <select
            className="rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={farmersHandMode}
            disabled={!idle}
            onChange={(event) => onFarmersHandModeChange(event.target.value as FarmersHandMode)}
          >
            {FARMERS_HAND_MODES.map((mode) => (
              <option key={mode} value={mode}>{formatFarmersHandMode(mode)}</option>
            ))}
          </select>
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Loner
          <select
            className="rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={lonerMode}
            disabled={!idle}
            onChange={(event) => onLonerModeChange(event.target.value as LonerMode)}
          >
            {LONER_MODES.map((mode) => <option key={mode} value={mode}>{formatLonerMode(mode)}</option>)}
          </select>
        </label>
        <label className={`${hiddenWhenPlaying} items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white`}>
          Seed
          <input
            className="w-28 rounded border border-white/15 bg-[#071411] px-2 py-1 text-white"
            value={seedInput}
            disabled={!idle}
            inputMode="numeric"
            placeholder={lastSeed === null ? "auto" : String(lastSeed)}
            onChange={(event) => onSeedInputChange(event.target.value)}
          />
        </label>
        <button
          className={`${inPlayMode ? "hidden" : ""} rounded border border-white/20 px-3 py-2 text-sm font-semibold text-white`}
          onClick={onCopySeed}
          type="button"
        >
          Copy seed
        </button>
        {inPlayMode ? (
          <div className="rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
            <span className="font-semibold text-white">Hand {handNumber}</span>
            <span className="mx-2 text-white/25">|</span>
            Team 0 {scores[0]} - {scores[1]} Team 1
          </div>
        ) : null}
        <button
          className="rounded bg-brass px-4 py-2 text-sm font-semibold text-[#201602]"
          disabled={isSaving}
          onClick={onStartGame}
          type="button"
        >
          {idle ? "Start hand" : "Start New Game"}
        </button>
      </div>
    </header>
  );
}

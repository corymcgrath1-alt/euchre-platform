import { useMemo, useState } from "react";
import {
  BOT_DIFFICULTIES,
  TARGET_SCORES,
  type BotDifficulty,
  type DealerSelection,
  type FarmersHandMode,
  type GameConfig
} from "@/lib/euchre";
import { ScreenHeader } from "../components/mobile-ui";

export interface NewGameSelection {
  readonly config: Partial<GameConfig>;
  readonly seed: number;
}

export function NewGameScreen({
  busy,
  onBack,
  onStart
}: {
  readonly busy: boolean;
  readonly onBack: () => void;
  readonly onStart: (selection: NewGameSelection) => void;
}) {
  const [targetScore, setTargetScore] = useState(10);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("standard");
  const [stickDealer, setStickDealer] = useState(true);
  const [dealerSelection, setDealerSelection] = useState<DealerSelection>("default");
  const [farmersHandMode, setFarmersHandMode] = useState<FarmersHandMode>("off");
  const [seedText, setSeedText] = useState(() => String(randomPracticeSeed()));
  const [advanced, setAdvanced] = useState(false);
  const seed = useMemo(() => Number(seedText), [seedText]);
  const validSeed = Number.isSafeInteger(seed) && seed >= 0 && seed <= 2_147_483_647;

  return (
    <main className="app-screen form-screen" data-testid="new-game-screen">
      <ScreenHeader title="New Game" eyebrow="Solo table" onBack={onBack} />
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!validSeed || busy) return;
        onStart({
          config: {
            targetScore,
            botDifficulty,
            stickDealer,
            dealerSelection,
            farmersHandMode,
            lonerMode: "aloneOnly"
          },
          seed
        });
      }}>
        <fieldset className="settings-group">
          <legend>Game</legend>
          <label>
            <span>Target score</span>
            <select value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value))}>
              {TARGET_SCORES.map((score) => <option key={score} value={score}>{score} points</option>)}
            </select>
          </label>
          <label>
            <span>Bot difficulty</span>
            <select value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficulty)}>
              {BOT_DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>{difficultyLabel(difficulty)}</option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            <span>
              <strong>Stick the dealer</strong>
              <small>The dealer must call trump in round two.</small>
            </span>
            <input
              type="checkbox"
              checked={stickDealer}
              onChange={(event) => setStickDealer(event.target.checked)}
            />
          </label>
        </fieldset>

        <button
          type="button"
          className="disclosure-button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((value) => !value)}
        >
          Advanced Settings <span aria-hidden="true">{advanced ? "\u2212" : "+"}</span>
        </button>

        {advanced ? (
          <fieldset className="settings-group" data-testid="advanced-settings">
            <legend>Advanced</legend>
            <label>
              <span>First dealer</span>
              <select value={dealerSelection} onChange={(event) => setDealerSelection(event.target.value as DealerSelection)}>
                <option value="default">Seeded rotation</option>
                <option value="human">You</option>
                <option value="seat1">West</option>
                <option value="seat2">North</option>
                <option value="seat3">East</option>
              </select>
            </label>
            <label>
              <span>Farmer&apos;s Hand</span>
              <select value={farmersHandMode} onChange={(event) => setFarmersHandMode(event.target.value as FarmersHandMode)}>
                <option value="off">Off</option>
                <option value="redeal">Redeal qualifying hands</option>
                <option value="replaceThree">Replace up to three low cards</option>
              </select>
            </label>
            <div className="setting-note">
              <strong>Loner mode</strong>
              <p>Standard play is enabled. Assisted loners with a partner are engine-deferred and not offered.</p>
            </div>
            <label>
              <span>Practice seed</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={seedText}
                aria-invalid={!validSeed}
                aria-describedby="seed-help"
                onChange={(event) => setSeedText(event.target.value)}
              />
              <small id="seed-help">
                {validSeed ? "Use the same seed and settings to replay this deal." : "Enter a whole number from 0 to 2147483647."}
              </small>
            </label>
          </fieldset>
        ) : null}

        <button className="button button--primary button--large form-submit" type="submit" disabled={busy || !validSeed}>
          {busy ? "Preparing table\u2026" : "Deal Cards"}
        </button>
      </form>
    </main>
  );
}

function randomPracticeSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 1_000_000;
}

function difficultyLabel(difficulty: BotDifficulty): string {
  return { easy: "Easy", standard: "Standard", strong: "Strong" }[difficulty];
}

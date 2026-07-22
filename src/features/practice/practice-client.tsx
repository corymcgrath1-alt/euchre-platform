"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TARGET_SCORES,
  cardId,
  chooseBotAction,
  createDefaultBotProfiles,
  createInitialGameState,
  parsePracticeSeed,
  type BotDifficulty,
  type DealerSelection,
  type FarmersHandMode,
  type GameAction,
  type GameState,
  type LonerMode,
  type PlayerIndex,
  type TargetScore
} from "@/lib/euchre";
import type { LoadedGame } from "@/lib/persistence/event-store";
import { buildClubReplayView } from "@/lib/presentation/club/replay";
import { buildClubTableView } from "@/lib/presentation/club/table";
import type { ProfileAggregateSummary } from "@/lib/profiles/profile-aggregates";
import type { PlayerProfileDetail } from "@/lib/profiles/profile-detail";
import type { GameReviewSummary } from "@/lib/review/game-review";
import type { PracticeCommandHandlers } from "./practice-actions";
import { PracticePersistenceControls } from "./practice-persistence";
import { PracticeProfilePanel } from "./practice-profile";
import { PracticeReview } from "./practice-review";
import { PracticeSetupHelp } from "./practice-setup-help";
import { PracticeSetupToolbar } from "./practice-setup-toolbar";
import {
  PracticeActivity,
  PracticeBotRoster,
  PracticeGameControls,
  PracticeGameSummary,
  PracticeTurnPanel
} from "./practice-status";
import { PracticeTable } from "./practice-table";

const STORAGE_KEY = "euchre-platform-active-game-id";
const HUMAN_SEAT: PlayerIndex = 0;

export default function PracticeClient() {
  const [stickDealer, setStickDealer] = useState(false);
  const [targetScore, setTargetScore] = useState<TargetScore>(10);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("standard");
  const [dealerSelection, setDealerSelection] = useState<DealerSelection>("default");
  const [farmersHandMode, setFarmersHandMode] = useState<FarmersHandMode>("off");
  const [lonerMode, setLonerMode] = useState<LonerMode>("aloneOnly");
  const [seedInput, setSeedInput] = useState("");
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [state, setState] = useState<GameState>(() => createInitialGameState({
    stickDealer,
    targetScore,
    botDifficulty,
    dealerSelection,
    farmersHandMode,
    lonerMode
  }));
  const [persistedGameId, setPersistedGameId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Local state ready");
  const [review, setReview] = useState<GameReviewSummary | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileAggregateSummary | null>(null);
  const [selectedProfileSeat, setSelectedProfileSeat] = useState<PlayerIndex>(HUMAN_SEAT);
  const [profileDetail, setProfileDetail] = useState<PlayerProfileDetail | null>(null);
  const [heldCompletedTrickKey, setHeldCompletedTrickKey] = useState<string | null>(null);
  const bots = useMemo(() => createDefaultBotProfiles(), []);
  const lastBotActionKey = useRef<string | null>(null);
  const lastAutoNextHandKey = useRef<string | null>(null);
  const inPlayMode = state.phase !== "idle";
  const tableView = useMemo(
    () => buildClubTableView(state, HUMAN_SEAT, { showLatestCompletedTrick: Boolean(heldCompletedTrickKey) }),
    [heldCompletedTrickKey, state]
  );
  const reviewView = useMemo(() => review ? buildClubReplayView(review) : null, [review]);

  const loadProfileStats = useCallback(async () => {
    try {
      const result = await fetchJson<{ profiles: ProfileAggregateSummary }>("/api/profiles");
      setProfileStats(result.profiles);
    } catch {
      setProfileStats(null);
    }
  }, []);

  const loadProfileDetail = useCallback(async (seat: PlayerIndex) => {
    try {
      const result = await fetchJson<{ profile: PlayerProfileDetail }>(`/api/profiles/${seat}`);
      setProfileDetail(result.profile);
    } catch {
      setProfileDetail(null);
    }
  }, []);

  const loadPersistedGame = useCallback(async (gameId: string) => {
    setIsSaving(true);
    setStatus("Loading saved game events...");
    try {
      const loaded = await fetchJson<LoadedGame>(`/api/games/${gameId}`);
      setPersistedGameId(loaded.game.id);
      setStickDealer(loaded.game.config.stickDealer);
      setTargetScore(asTargetScore(loaded.game.config.targetScore));
      setBotDifficulty(loaded.game.config.botDifficulty ?? "standard");
      setDealerSelection(loaded.game.config.dealerSelection ?? "default");
      setFarmersHandMode(loaded.game.config.farmersHandMode ?? "off");
      setLonerMode(loaded.game.config.lonerMode ?? "aloneOnly");
      setState(loaded.state);
      setReview(null);
      setStatus(`Restored ${loaded.events.length} persisted event${loaded.events.length === 1 ? "" : "s"}`);
      window.localStorage.setItem(STORAGE_KEY, loaded.game.id);
    } catch (error) {
      setPersistedGameId(null);
      window.localStorage.removeItem(STORAGE_KEY);
      setStatus(error instanceof Error ? error.message : "Unable to restore saved game");
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileStats();
    const savedGameId = window.localStorage.getItem(STORAGE_KEY);
    if (savedGameId) void loadPersistedGame(savedGameId);
  }, [loadPersistedGame, loadProfileStats]);

  useEffect(() => {
    void loadProfileDetail(selectedProfileSeat);
  }, [loadProfileDetail, selectedProfileSeat]);

  const act = useCallback(async (action: GameAction, actorLabel = "Human") => {
    if (!persistedGameId) {
      setStatus("Create a persisted game before playing moves");
      return false;
    }
    setIsSaving(true);
    try {
      const result = await fetchJson<Pick<LoadedGame, "game" | "state">>(`/api/games/${persistedGameId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSequence: state.moveLog.length, action })
      });
      if (action.type === "START_HAND" || action.type === "NEXT_HAND") {
        setHeldCompletedTrickKey(null);
        lastBotActionKey.current = null;
        lastAutoNextHandKey.current = null;
      }
      setState(result.state);
      setStatus(`${actorLabel} persisted event #${result.state.moveLog.length - 1}`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Move could not be persisted");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [persistedGameId, state.moveLog.length]);

  useEffect(() => {
    if (!persistedGameId || state.phase !== "gameComplete") {
      setReview(null);
      return;
    }
    let cancelled = false;
    void fetchJson<{ review: GameReviewSummary }>(`/api/games/${persistedGameId}/review`)
      .then((result) => {
        if (!cancelled) {
          setReview(result.review);
          void loadProfileStats();
          void loadProfileDetail(selectedProfileSeat);
        }
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Unable to load game review");
      });
    return () => { cancelled = true; };
  }, [loadProfileDetail, loadProfileStats, persistedGameId, selectedProfileSeat, state.moveLog.length, state.phase]);

  useEffect(() => {
    const latestCompleted = state.completedTricks[state.completedTricks.length - 1];
    if (state.phase !== "playing" || !latestCompleted) {
      setHeldCompletedTrickKey(null);
      return;
    }
    const key = `${state.handNumber}:${state.completedTricks.length}:${latestCompleted.winner}:${latestCompleted.plays
      .map((play) => `${play.player}-${cardId(play.card)}`).join("|")}`;
    setHeldCompletedTrickKey(key);
    const timeout = window.setTimeout(() => {
      setHeldCompletedTrickKey((current) => current === key ? null : current);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [state.completedTricks, state.handNumber, state.phase]);

  useEffect(() => {
    if (!persistedGameId || isSaving) return;
    const activeBot = bots.find((bot) => bot.enabled && bot.seat === state.activePlayer);
    if (!activeBot) return;
    const action = chooseBotAction(state, activeBot);
    if (!action) return;
    const actionKey = `${persistedGameId}:${state.moveLog.length}:${state.phase}:${state.activePlayer}`;
    if (lastBotActionKey.current === actionKey) return;
    lastBotActionKey.current = actionKey;
    const timeout = window.setTimeout(() => { void act(action, activeBot.name); }, 650);
    return () => window.clearTimeout(timeout);
  }, [act, bots, isSaving, persistedGameId, state]);

  useEffect(() => {
    if (!persistedGameId || isSaving || state.phase !== "handComplete") return;
    const actionKey = `${persistedGameId}:${state.moveLog.length}:next-hand:${state.handNumber}`;
    if (lastAutoNextHandKey.current === actionKey) return;
    lastAutoNextHandKey.current = actionKey;
    const timeout = window.setTimeout(() => {
      void act({ type: "NEXT_HAND", seed: Date.now() % 1_000_000 }, "Auto deal").then((success) => {
        if (!success) lastAutoNextHandKey.current = null;
      });
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [act, isSaving, persistedGameId, state.handNumber, state.moveLog.length, state.phase]);

  const handlers: PracticeCommandHandlers = {
    onPass: () => act({ type: "PASS", player: HUMAN_SEAT }),
    onOrderUp: (alone) => act({ type: "ORDER_UP", player: HUMAN_SEAT, alone }),
    onCallTrump: (suit, alone) => act({ type: "CALL_TRUMP", player: HUMAN_SEAT, suit, alone }),
    onDeclineFarmersHand: () => act({ type: "FARMERS_HAND_DECLINE", player: HUMAN_SEAT }),
    onClaimFarmersHandRedeal: () => act({ type: "FARMERS_HAND_REDEAL", player: HUMAN_SEAT, seed: Date.now() % 1_000_000 }),
    onReplaceFarmersHandCards: (cards) => act({ type: "FARMERS_HAND_REPLACE", player: HUMAN_SEAT, cards: cards.map((card) => ({ ...card })) }),
    onDiscard: (card) => act({ type: "DISCARD", player: HUMAN_SEAT, card }),
    onPlayCard: (card) => act({ type: "PLAY_CARD", player: HUMAN_SEAT, card })
  };

  async function startNewGame() {
    setIsSaving(true);
    setStatus("Creating persisted game...");
    try {
      const { seed } = parsePracticeSeed(seedInput);
      setLastSeed(seed);
      const created = await fetchJson<{ game: LoadedGame["game"] }>("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { stickDealer, targetScore, botDifficulty, dealerSelection, farmersHandMode, lonerMode },
          metadata: { source: "local-practice-ui" }
        })
      });
      setPersistedGameId(created.game.id);
      lastBotActionKey.current = null;
      setReview(null);
      window.localStorage.setItem(STORAGE_KEY, created.game.id);
      const started = await fetchJson<Pick<LoadedGame, "state">>(`/api/games/${created.game.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSequence: 0, action: { type: "START_HAND", seed } })
      });
      setState(started.state);
      setStatus(`Persisted game ${created.game.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create persisted game");
    } finally {
      setIsSaving(false);
    }
  }

  function resetGame() {
    setState(createInitialGameState({ stickDealer, targetScore, botDifficulty, dealerSelection, farmersHandMode, lonerMode }));
    setPersistedGameId(null);
    lastBotActionKey.current = null;
    lastAutoNextHandKey.current = null;
    setReview(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Local state reset; persisted events were left immutable");
  }

  function confirmStartNewGame() {
    const message = state.phase === "gameComplete"
      ? "Start a new active table? Completed games and immutable move history remain available."
      : "Clear the active table view? Persisted events are not deleted.";
    if (window.confirm(message)) resetGame();
  }

  function updateBotDifficulty(nextDifficulty: BotDifficulty) {
    setBotDifficulty(nextDifficulty);
    if (state.phase === "idle") {
      setState(createInitialGameState({
        stickDealer,
        targetScore,
        botDifficulty: nextDifficulty,
        dealerSelection,
        farmersHandMode,
        lonerMode
      }));
    }
  }

  function copySeed() {
    const seed = lastSeed ?? parsePracticeSeed(seedInput).seed;
    setLastSeed(seed);
    setSeedInput(String(seed));
    if (navigator.clipboard) void navigator.clipboard.writeText(String(seed));
    setStatus(`Seed ${seed} ready to reuse`);
  }

  return (
    <main className="min-h-screen bg-[#071411]">
      <section className="mx-auto flex w-full max-w-[118rem] flex-col gap-2 px-2 py-2 sm:px-3 lg:px-4">
        <PracticeSetupToolbar
          inPlayMode={inPlayMode}
          phase={tableView.phase}
          handNumber={tableView.handNumber}
          scores={[...tableView.scores]}
          targetScore={targetScore}
          botDifficulty={botDifficulty}
          dealerSelection={dealerSelection}
          stickDealer={stickDealer}
          farmersHandMode={farmersHandMode}
          lonerMode={lonerMode}
          seedInput={seedInput}
          lastSeed={lastSeed}
          isSaving={isSaving}
          onTargetScoreChange={setTargetScore}
          onBotDifficultyChange={updateBotDifficulty}
          onDealerSelectionChange={setDealerSelection}
          onStickDealerChange={setStickDealer}
          onFarmersHandModeChange={setFarmersHandMode}
          onLonerModeChange={setLonerMode}
          onSeedInputChange={setSeedInput}
          onCopySeed={copySeed}
          onStartGame={tableView.phase === "idle" ? startNewGame : confirmStartNewGame}
        />

        {tableView.phase === "idle" ? (
          <PracticeSetupHelp farmersHandMode={farmersHandMode} lonerMode={lonerMode} lastSeed={lastSeed} />
        ) : null}

        <PracticePersistenceControls
          gameId={persistedGameId}
          status={status}
          isSaving={isSaving}
          inPlayMode={inPlayMode}
          onClearTable={confirmStartNewGame}
        />

        <div className="flex flex-col gap-3">
          <section className="flex flex-col gap-2">
            <PracticeTable view={tableView} disabled={isSaving} handlers={handlers} />
            <PracticeGameControls
              view={tableView}
              disabled={isSaving}
              onDealNextHand={() => { void act({ type: "NEXT_HAND", seed: Date.now() % 1_000_000 }); }}
              onStartNewGame={confirmStartNewGame}
            />
            {reviewView ? <PracticeReview view={reviewView} /> : null}
          </section>

          <aside className="grid gap-4 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.25fr)_minmax(18rem,0.9fr)_minmax(18rem,1fr)]">
            <PracticeTurnPanel view={tableView} />
            <PracticeGameSummary view={tableView} />
            <PracticeBotRoster
              bots={bots.map((bot) => ({ id: bot.id, name: bot.name, seat: bot.seat }))}
              difficulty={tableView.config.botDifficultyLabel}
            />
            <PracticeProfilePanel
              profiles={profileStats}
              selectedSeat={selectedProfileSeat}
              detail={profileDetail}
              onSelectSeat={setSelectedProfileSeat}
            />
            <PracticeActivity view={tableView} botsOnly />
            <PracticeActivity view={tableView} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function asTargetScore(score: number): TargetScore {
  return TARGET_SCORES.includes(score as TargetScore) ? score as TargetScore : 10;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  return payload as T;
}

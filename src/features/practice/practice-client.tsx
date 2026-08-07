"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TARGET_SCORES,
  createDefaultBotProfiles,
  createInitialGameState,
  parsePracticeSeed,
  type BotDifficulty,
  type DealerSelection,
  type FarmersHandMode,
  type GameAction,
  type LonerMode,
  type PlayerIndex,
  type TargetScore
} from "@/lib/euchre";
import type { PersistedGameRecord } from "@/lib/persistence/types";
import type { ClubReplayView } from "@/lib/presentation/club/replay";
import { buildClubTableView, type ClubTableView } from "@/lib/presentation/club/table";
import type { ProfileAggregateSummary } from "@/lib/profiles/profile-aggregates";
import type { PlayerProfileDetail } from "@/lib/profiles/profile-detail";
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

interface PracticeProjectionResponse {
  readonly gameId: string;
  readonly status: PersistedGameRecord["status"];
  readonly eventCount: number;
  readonly table: ClubTableView;
  readonly replay: ClubReplayView | null;
}

export default function PracticeClient() {
  const [stickDealer, setStickDealer] = useState(false);
  const [targetScore, setTargetScore] = useState<TargetScore>(10);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("standard");
  const [dealerSelection, setDealerSelection] = useState<DealerSelection>("default");
  const [farmersHandMode, setFarmersHandMode] = useState<FarmersHandMode>("off");
  const [lonerMode, setLonerMode] = useState<LonerMode>("aloneOnly");
  const [seedInput, setSeedInput] = useState("");
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [tableView, setTableView] = useState<ClubTableView>(() => idleTableView({
    stickDealer,
    targetScore,
    botDifficulty,
    dealerSelection,
    farmersHandMode,
    lonerMode
  }));
  const [persistedGameId, setPersistedGameId] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Local state ready");
  const [review, setReview] = useState<ClubReplayView | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileAggregateSummary | null>(null);
  const [selectedProfileSeat, setSelectedProfileSeat] = useState<PlayerIndex>(HUMAN_SEAT);
  const [profileDetail, setProfileDetail] = useState<PlayerProfileDetail | null>(null);
  const bots = useMemo(() => createDefaultBotProfiles(), []);
  const lastBotActionKey = useRef<string | null>(null);
  const lastAutoNextHandKey = useRef<string | null>(null);
  const inPlayMode = tableView.phase !== "idle";

  const applyProjection = useCallback((projection: PracticeProjectionResponse) => {
    setPersistedGameId(projection.gameId);
    setEventCount(projection.eventCount);
    setTableView(projection.table);
    setReview(projection.replay);
  }, []);

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
      const loaded = await fetchJson<PracticeProjectionResponse>(`/api/games/${gameId}/practice`);
      const config = loaded.table.rules.config;
      applyProjection(loaded);
      setStickDealer(config.stickDealer);
      setTargetScore(asTargetScore(config.targetScore));
      setBotDifficulty(config.botDifficulty);
      setDealerSelection(config.dealerSelection);
      setFarmersHandMode(config.farmersHandMode);
      setLonerMode(config.lonerMode);
      setStatus(`Restored ${loaded.eventCount} persisted event${loaded.eventCount === 1 ? "" : "s"}`);
      window.localStorage.setItem(STORAGE_KEY, loaded.gameId);
    } catch (error) {
      setPersistedGameId(null);
      window.localStorage.removeItem(STORAGE_KEY);
      setStatus(error instanceof Error ? error.message : "Unable to restore saved game");
    } finally {
      setIsSaving(false);
    }
  }, [applyProjection]);

  useEffect(() => {
    void loadProfileStats();
    const savedGameId = window.localStorage.getItem(STORAGE_KEY);
    if (savedGameId) void loadPersistedGame(savedGameId);
  }, [loadPersistedGame, loadProfileStats]);

  useEffect(() => {
    void loadProfileDetail(selectedProfileSeat);
  }, [loadProfileDetail, selectedProfileSeat]);

  const submitViewerAction = useCallback(async (action: GameAction, actorLabel = "Human") => {
    if (!persistedGameId) {
      setStatus("Create a persisted game before playing moves");
      return false;
    }
    setIsSaving(true);
    try {
      const projection = await fetchJson<PracticeProjectionResponse>(`/api/games/${persistedGameId}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSequence: eventCount, command: "VIEWER_ACTION", action })
      });
      if (action.type === "START_HAND" || action.type === "NEXT_HAND") {
        lastBotActionKey.current = null;
        lastAutoNextHandKey.current = null;
      }
      applyProjection(projection);
      setStatus(`${actorLabel} persisted event #${projection.eventCount - 1}`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Move could not be persisted");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applyProjection, eventCount, persistedGameId]);

  const submitBotMove = useCallback(async (botName: string) => {
    if (!persistedGameId) return false;
    setIsSaving(true);
    try {
      const projection = await fetchJson<PracticeProjectionResponse>(`/api/games/${persistedGameId}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSequence: eventCount, command: "BOT_MOVE" })
      });
      applyProjection(projection);
      setStatus(`${botName} persisted event #${projection.eventCount - 1}`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bot move could not be persisted");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [applyProjection, eventCount, persistedGameId]);

  useEffect(() => {
    if (!persistedGameId || !tableView.currentTrick.isShowingCompletedTrick) return;
    const timeout = window.setTimeout(() => {
      void fetchJson<PracticeProjectionResponse>(`/api/games/${persistedGameId}/practice`)
        .then(applyProjection)
        .catch((error) => setStatus(error instanceof Error ? error.message : "Unable to clear trick presentation"));
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [applyProjection, persistedGameId, tableView.currentTrick.isShowingCompletedTrick]);

  useEffect(() => {
    if (tableView.phase !== "gameComplete" || !review) return;
    void loadProfileStats();
    void loadProfileDetail(selectedProfileSeat);
  }, [loadProfileDetail, loadProfileStats, review, selectedProfileSeat, tableView.phase]);

  useEffect(() => {
    if (!persistedGameId || isSaving || tableView.currentTrick.isShowingCompletedTrick) return;
    const activeBot = bots.find((bot) => bot.enabled && bot.seat === tableView.activePlayer);
    if (!activeBot || tableView.phase === "handComplete" || tableView.phase === "gameComplete" || tableView.phase === "idle") return;
    const actionKey = `${persistedGameId}:${eventCount}:${tableView.phase}:${tableView.activePlayer}`;
    if (lastBotActionKey.current === actionKey) return;
    lastBotActionKey.current = actionKey;
    const timeout = window.setTimeout(() => {
      void submitBotMove(activeBot.name).then((success) => {
        if (!success) lastBotActionKey.current = null;
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [bots, eventCount, isSaving, persistedGameId, submitBotMove, tableView.activePlayer, tableView.currentTrick.isShowingCompletedTrick, tableView.phase]);

  useEffect(() => {
    if (!persistedGameId || isSaving || tableView.phase !== "handComplete") return;
    const actionKey = `${persistedGameId}:${eventCount}:next-hand:${tableView.handNumber}`;
    if (lastAutoNextHandKey.current === actionKey) return;
    lastAutoNextHandKey.current = actionKey;
    const timeout = window.setTimeout(() => {
      void submitViewerAction({ type: "NEXT_HAND", seed: Date.now() % 1_000_000 }, "Auto deal").then((success) => {
        if (!success) lastAutoNextHandKey.current = null;
      });
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [eventCount, isSaving, persistedGameId, submitViewerAction, tableView.handNumber, tableView.phase]);

  const handlers: PracticeCommandHandlers = {
    onPass: () => submitViewerAction({ type: "PASS", player: HUMAN_SEAT }),
    onOrderUp: (alone) => submitViewerAction({ type: "ORDER_UP", player: HUMAN_SEAT, alone }),
    onCallTrump: (suit, alone) => submitViewerAction({ type: "CALL_TRUMP", player: HUMAN_SEAT, suit, alone }),
    onDeclineFarmersHand: () => submitViewerAction({ type: "FARMERS_HAND_DECLINE", player: HUMAN_SEAT }),
    onClaimFarmersHandRedeal: () => submitViewerAction({ type: "FARMERS_HAND_REDEAL", player: HUMAN_SEAT, seed: Date.now() % 1_000_000 }),
    onReplaceFarmersHandCards: (cards) => submitViewerAction({ type: "FARMERS_HAND_REPLACE", player: HUMAN_SEAT, cards: cards.map((card) => ({ ...card })) }),
    onDiscard: (card) => submitViewerAction({ type: "DISCARD", player: HUMAN_SEAT, card }),
    onPlayCard: (card) => submitViewerAction({ type: "PLAY_CARD", player: HUMAN_SEAT, card })
  };

  async function startNewGame() {
    setIsSaving(true);
    setStatus("Creating persisted game...");
    try {
      const { seed } = parsePracticeSeed(seedInput);
      setLastSeed(seed);
      const created = await fetchJson<{ game: PersistedGameRecord }>("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { stickDealer, targetScore, botDifficulty, dealerSelection, farmersHandMode, lonerMode },
          metadata: { source: "local-practice-ui" }
        })
      });
      const started = await fetchJson<PracticeProjectionResponse>(`/api/games/${created.game.id}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedSequence: 0,
          command: "VIEWER_ACTION",
          action: { type: "START_HAND", seed }
        })
      });
      applyProjection(started);
      lastBotActionKey.current = null;
      window.localStorage.setItem(STORAGE_KEY, started.gameId);
      setStatus(`Persisted game ${started.gameId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create persisted game");
    } finally {
      setIsSaving(false);
    }
  }

  function resetGame() {
    setTableView(idleTableView({ stickDealer, targetScore, botDifficulty, dealerSelection, farmersHandMode, lonerMode }));
    setPersistedGameId(null);
    setEventCount(0);
    lastBotActionKey.current = null;
    lastAutoNextHandKey.current = null;
    setReview(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus("Local state reset; persisted events were left immutable");
  }

  function confirmStartNewGame() {
    const message = tableView.phase === "gameComplete"
      ? "Start a new active table? Completed games and immutable move history remain available."
      : "Clear the active table view? Persisted events are not deleted.";
    if (window.confirm(message)) resetGame();
  }

  function updateBotDifficulty(nextDifficulty: BotDifficulty) {
    setBotDifficulty(nextDifficulty);
    if (tableView.phase === "idle") {
      setTableView(idleTableView({
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
              onDealNextHand={() => { void submitViewerAction({ type: "NEXT_HAND", seed: Date.now() % 1_000_000 }); }}
              onStartNewGame={confirmStartNewGame}
            />
            {review ? <PracticeReview view={review} /> : null}
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

function idleTableView(config: Parameters<typeof createInitialGameState>[0]): ClubTableView {
  return buildClubTableView(createInitialGameState(config), HUMAN_SEAT);
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

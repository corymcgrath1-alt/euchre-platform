import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardLabel, type GameAction } from "@/lib/euchre";
import { GameNotFoundError } from "@/lib/persistence/types";
import { ConfirmDialog } from "./components/mobile-ui";
import {
  SoloGameService,
  resultShareText,
  type CompletedGameListItem,
  type SoloGameSnapshot
} from "./game/solo-game-service";
import { emitHaptic, initializeNativeShell, listenForAppState, shareText } from "./native/native-bridge";
import {
  DEFAULT_MOBILE_SETTINGS,
  MobileEventStore,
  type MobileSettings
} from "./persistence/mobile-event-store";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { HowToPlayScreen, PrivacyScreen, SupportScreen } from "./screens/InfoScreens";
import { NewGameScreen, type NewGameSelection } from "./screens/NewGameScreen";
import { GameResultScreen, HandResultScreen } from "./screens/ResultScreens";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TableScreen } from "./screens/TableScreen";
import "./styles/mobile.css";

type Screen = "home" | "new" | "table" | "history" | "review" | "settings" | "how" | "privacy" | "support";

const eventStore = new MobileEventStore();
const soloGame = new SoloGameService(eventStore);

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [snapshot, setSnapshot] = useState<SoloGameSnapshot | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly CompletedGameListItem[]>([]);
  const [reviewItem, setReviewItem] = useState<CompletedGameListItem | null>(null);
  const [settings, setSettings] = useState<MobileSettings>(DEFAULT_MOBILE_SETTINGS);
  const [busy, setBusy] = useState(true);
  const [appActive, setAppActive] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<GameAction | null>(null);
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const botInFlight = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, snapshot?.table.phase]);
  const lastBotKey = useRef<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistory(await soloGame.completedGames());
  }, []);

  const refreshActivePointer = useCallback(async () => {
    setActiveGameId(await eventStore.getActiveGameId());
  }, []);
  const handleTerminalTransition = useCallback(async (next: SoloGameSnapshot): Promise<void> => {
    if (next.table.phase === "handComplete") {
      await emitHaptic("score", settings.haptics);
      return;
    }
    if (next.table.phase === "gameComplete") {
      await emitHaptic("complete", settings.haptics);
      await Promise.all([refreshHistory(), refreshActivePointer()]);
      const item = (await soloGame.completedGames()).find((candidate) => candidate.game.id === next.loaded.game.id);
      if (item) setReviewItem(item);
    }
  }, [refreshActivePointer, refreshHistory, settings.haptics]);

  const dealNextHand = useCallback(async (): Promise<void> => {
    if (!snapshot || busy) return;
    setBusy(true);
    try {
      const next = await soloGame.dealNextHand(snapshot.loaded.game.id);
      setSnapshot(next);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }, [busy, snapshot]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await initializeNativeShell();
        const [storedSettings, activeId, completed] = await Promise.all([
          soloGame.settings(),
          eventStore.getActiveGameId(),
          soloGame.completedGames()
        ]);
        if (!mounted) return;
        setSettings(storedSettings);
        setActiveGameId(activeId);
        setHistory(completed);
      } catch (error) {
        if (mounted) setNotice(readableError(error));
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;
    void listenForAppState((active) => {
      setAppActive(active);
      if (!active) return;
      void (async () => {
        const activeId = await eventStore.getActiveGameId();
        setActiveGameId(activeId);
        if (activeId && screen === "table") {
          setSnapshot(await soloGame.load(activeId));
        }
      })().catch((error) => setNotice(readableError(error)));
    }).then((remove) => {
      removeListener = remove;
    });
    return () => {
      void removeListener?.();
    };
  }, [screen]);

  useEffect(() => {
    const view = snapshot?.table;
    if (!snapshot || !view || !view.currentTrick.isShowingCompletedTrick || !appActive) return;
    const delay = settings.animationLevel === "full" ? 750 : settings.animationLevel === "reduced" ? 220 : 0;
    const timeout = window.setTimeout(() => {
      void soloGame.load(snapshot.loaded.game.id).then(setSnapshot).catch((error) => setNotice(readableError(error)));
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [appActive, settings.animationLevel, snapshot]);

  useEffect(() => {
    const view = snapshot?.table;
    if (
      !snapshot
      || !view
      || screen !== "table"
      || !appActive
      || busy
      || view.activePlayer === view.viewerSeat
      || view.currentTrick.isShowingCompletedTrick
      || view.phase === "handComplete"
      || view.phase === "gameComplete"
      || view.phase === "idle"
    ) {
      return;
    }
    const key = `${snapshot.loaded.game.id}:${snapshot.loaded.events.length}:${view.activePlayer}:${view.phase}`;
    if (lastBotKey.current === key || botInFlight.current) return;
    const delay = settings.animationLevel === "full" ? 520 : settings.animationLevel === "reduced" ? 180 : 0;
    const timeout = window.setTimeout(() => {
      if (!appActive || botInFlight.current) return;
      lastBotKey.current = key;
      botInFlight.current = true;
      setBusy(true);
      void soloGame.runOneBotTurn(snapshot.loaded.game.id)
        .then(async (next) => {
          setSnapshot(next);
          if (next.table.currentTrick.isShowingCompletedTrick) {
            await emitHaptic("trick", settings.haptics);
          }
          await handleTerminalTransition(next);
        })
        .catch((error) => {
          lastBotKey.current = null;
          setNotice(readableError(error));
        })
        .finally(() => {
          botInFlight.current = false;
          setBusy(false);
        });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [appActive, busy, handleTerminalTransition, screen, settings.animationLevel, settings.haptics, snapshot]);

  useEffect(() => {
    if (
      !snapshot
      || snapshot.table.phase !== "handComplete"
      || !settings.autoDealNextHand
      || !appActive
      || busy
      || screen !== "table"
    ) return;
    const timeout = window.setTimeout(() => void dealNextHand(), settings.animationLevel === "none" ? 250 : 1_800);
    return () => window.clearTimeout(timeout);
  }, [appActive, busy, dealNextHand, screen, settings.animationLevel, settings.autoDealNextHand, snapshot]);

  const currentResult = useMemo(() => {
    if (!snapshot || snapshot.table.phase !== "gameComplete") return null;
    return history.find((item) => item.game.id === snapshot.loaded.game.id) ?? reviewItem;
  }, [history, reviewItem, snapshot]);


  async function startGame(selection: NewGameSelection): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const next = await soloGame.createGame(selection);
      setSnapshot(next);
      setActiveGameId(next.loaded.game.id);
      setScreen("table");
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function resumeGame(): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const next = await soloGame.resumeActiveGame();
      if (!next) {
        setActiveGameId(null);
        setNotice("No active game is available to resume.");
        return;
      }
      setSnapshot(next);
      setActiveGameId(next.loaded.game.id);
      setScreen("table");
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  function requestAction(action: GameAction): void {
    if (busy) return;
    if (settings.confirmCardPlay && (action.type === "PLAY_CARD" || action.type === "DISCARD")) {
      setPendingAction(action);
      return;
    }
    void submitAction(action);
  }

  async function submitAction(action: GameAction): Promise<void> {
    if (!snapshot) return;
    setPendingAction(null);
    setBusy(true);
    setNotice(null);
    try {
      const next = await soloGame.submitHumanAction(snapshot.loaded.game.id, action);
      setSnapshot(next);
      await emitHaptic(actionHaptic(action), settings.haptics);
      await handleTerminalTransition(next);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }


  async function abandonAndStart(): Promise<void> {
    setConfirmNewGame(false);
    if (activeGameId) {
      setBusy(true);
      try {
        await soloGame.abandon(activeGameId);
        setActiveGameId(null);
        setSnapshot(null);
      } catch (error) {
        setNotice(readableError(error));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setScreen("new");
  }

  async function deleteHistory(): Promise<void> {
    setBusy(true);
    try {
      await eventStore.deleteCompletedHistory();
      await refreshHistory();
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateSettings(next: MobileSettings): Promise<void> {
    setSettings(next);
    try {
      setSettings(await soloGame.saveSettings(next));
    } catch (error) {
      setNotice(readableError(error));
    }
  }

  async function resetLocalData(): Promise<void> {
    setBusy(true);
    try {
      await eventStore.clear();
      setSettings(DEFAULT_MOBILE_SETTINGS);
      setSnapshot(null);
      setActiveGameId(null);
      setHistory([]);
      setReviewItem(null);
      setNotice("Local games and settings were removed.");
      setScreen("home");
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  function navigatePrimary(next: "home" | "history" | "settings"): void {
    setNotice(null);
    if (next === "history") void refreshHistory();
    setScreen(next);
  }

  function openReview(item: CompletedGameListItem): void {
    setReviewItem(item);
    setScreen("review");
  }

  const content = (() => {
    if (screen === "new") {
      return <NewGameScreen busy={busy} onBack={() => setScreen("home")} onStart={(selection) => void startGame(selection)} />;
    }
    if (screen === "table" && snapshot) {
      if (snapshot.table.phase === "gameComplete" && currentResult) {
        return (
          <GameResultScreen
            item={currentResult}
            busy={busy}
            shareAvailable
            onReview={() => openReview(currentResult)}
            onShare={() => void shareText("Euchre Club result", resultShareText(currentResult))
              .then((status) => {
                if (status === "unavailable") setNotice("Sharing is not available in this browser.");
              })
              .catch((error) => setNotice(readableError(error)))}
            onPlayAgain={() => setScreen("new")}
            onHome={() => setScreen("home")}
          />
        );
      }
      if (snapshot.table.phase === "handComplete") {
        return (
          <HandResultScreen
            table={snapshot.table}
            autoDeal={settings.autoDealNextHand}
            busy={busy}
            onContinue={() => void dealNextHand()}
            onHome={() => setScreen("home")}
          />
        );
      }
      return (
        <TableScreen
          table={snapshot.table}
          busy={busy}
          animationLevel={settings.animationLevel}
          onAction={requestAction}
          onHome={() => setScreen("home")}
          onNewGame={() => setConfirmNewGame(true)}
        />
      );
    }
    if (screen === "history") {
      return (
        <HistoryScreen
          games={history}
          busy={busy}
          onOpenReview={openReview}
          onDeleteHistory={() => void deleteHistory()}
          onNavigate={navigatePrimary}
        />
      );
    }
    if (screen === "review" && reviewItem) {
      return <ReviewScreen item={reviewItem} onBack={() => setScreen("history")} />;
    }
    if (screen === "settings") {
      return (
        <SettingsScreen
          settings={settings}
          busy={busy}
          onChange={(next) => void updateSettings(next)}
          onReset={() => void resetLocalData()}
          onNavigate={navigatePrimary}
        />
      );
    }
    if (screen === "how") return <HowToPlayScreen onBack={() => setScreen("home")} />;
    if (screen === "privacy") return <PrivacyScreen onBack={() => setScreen("home")} />;
    if (screen === "support") return <SupportScreen onBack={() => setScreen("home")} />;
    return (
      <HomeScreen
        hasActiveGame={Boolean(activeGameId)}
        onNewGame={() => {
          if (activeGameId) setConfirmNewGame(true);
          else setScreen("new");
        }}
        onResume={() => void resumeGame()}
        onNavigate={(next) => {
          if (next === "history" || next === "settings") navigatePrimary(next);
          else setScreen(next);
        }}
      />
    );
  })();

  return (
    <div className="mobile-app">
      {notice ? (
        <div className="app-notice" role="alert">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>{"\u00d7"}</button>
        </div>
      ) : null}
      {content}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === "DISCARD" ? "Discard this card?" : "Play this card?"}
        message={pendingAction && "card" in pendingAction ? cardLabel(pendingAction.card) : "Confirm this action."}
        confirmLabel={pendingAction?.type === "DISCARD" ? "Discard" : "Play Card"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) void submitAction(pendingAction);
        }}
      />
      <ConfirmDialog
        open={confirmNewGame}
        title="Leave the current game?"
        message="The current game will be marked abandoned. Completed history is preserved."
        confirmLabel="Leave and Start New"
        destructive
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => void abandonAndStart()}
      />
    </div>
  );
}

function readableError(error: unknown): string {
  if (error instanceof GameNotFoundError) return "That local game is no longer available.";
  if (error instanceof Error) return error.message;
  return "An unexpected local error occurred.";
}

function actionHaptic(action: GameAction): "selection" | "play" | "trump" {
  if (action.type === "ORDER_UP" || action.type === "CALL_TRUMP") return "trump";
  if (action.type === "PLAY_CARD" || action.type === "DISCARD") return "play";
  return "selection";
}

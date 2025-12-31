import { MenuBarExtra, Icon, showHUD } from "@raycast/api";
import { useState, useEffect } from "react";
import {
  getCurrentState,
  setState,
  endCurrentSession,
  getSessions,
  getSessionsForPeriod,
  calculateStats,
  formatDuration,
  getCurrentSessionElapsedTime,
  type DeskState,
} from "./utils/standing-desk-utils";

export default function Command() {
  const [currentState, setCurrentState] = useState<DeskState | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [dailyStats, setDailyStats] = useState<{ standing: number; sitting: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { state } = await getCurrentState();
    setCurrentState(state);
    
    // Calculate elapsed time - this will be accurate even if component only updates every 10s
    if (state) {
      const elapsed = await getCurrentSessionElapsedTime();
      setElapsedTime(elapsed);
    } else {
      setElapsedTime(0);
    }
    
    await loadDailyStats();
    setIsLoading(false);
  }

  async function loadDailyStats() {
    try {
      const allSessions = await getSessions();
      const daySessions = getSessionsForPeriod(allSessions, "day");
      const stats = calculateStats(daySessions);

      // Also include current session if active
      let totalStanding = stats.totalStanding;
      let totalSitting = stats.totalSitting;

      if (currentState) {
        const currentElapsed = await getCurrentSessionElapsedTime();
        if (currentState === "standing") {
          totalStanding += currentElapsed;
        } else {
          totalSitting += currentElapsed;
        }
      }

      setDailyStats({
        standing: totalStanding,
        sitting: totalSitting,
      });
    } catch (error) {
      console.error("Error loading daily stats:", error);
    }
  }

  async function handleToggleState(newState: DeskState) {
    try {
      // End current session if exists
      if (currentState) {
        await endCurrentSession();
      }

      // Start new session
      const now = Date.now();
      await setState(newState, now);
      setCurrentState(newState);
      setElapsedTime(0);
      await loadDailyStats();
      await showHUD(`Started ${newState === "standing" ? "Standing" : "Sitting"}`);
    } catch (error) {
      await showHUD(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (isLoading) {
    return <MenuBarExtra isLoading={true} />;
  }

  const getStateSymbol = (state: DeskState | null) => {
    if (state === "standing") return "↑";
    if (state === "sitting") return "↓";
    return "—";
  };

  const getStateLabel = (state: DeskState | null) => {
    if (state === "standing") return "Standing";
    if (state === "sitting") return "Sitting";
    return "Not Tracking";
  };

  const nextState: DeskState | null = currentState === "standing" ? "sitting" : currentState === "sitting" ? "standing" : null;
  const nextStateLabel = nextState === "standing" ? "Standing" : "Sitting";

  const title = currentState
    ? `${getStateSymbol(currentState)} ${formatDuration(elapsedTime)}`
    : "— Not Tracking";

  return (
    <MenuBarExtra title={title}>
      <MenuBarExtra.Section title="Current Status">
        <MenuBarExtra.Item
          title={getStateLabel(currentState)}
          subtitle={currentState ? `Elapsed: ${formatDuration(elapsedTime)}` : "Start tracking"}
          icon={currentState === "standing" ? Icon.ArrowUp : currentState === "sitting" ? Icon.ArrowDown : Icon.Circle}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section title="Today's Stats">
        {dailyStats ? (
          <>
            <MenuBarExtra.Item
              title="Standing"
              subtitle={formatDuration(dailyStats.standing)}
              icon={{ source: Icon.ArrowUp, tintColor: "#22c55e" }}
            />
            <MenuBarExtra.Item
              title="Sitting"
              subtitle={formatDuration(dailyStats.sitting)}
              icon={{ source: Icon.ArrowDown, tintColor: "#3b82f6" }}
            />
            <MenuBarExtra.Item
              title="Total"
              subtitle={formatDuration(dailyStats.standing + dailyStats.sitting)}
              icon={Icon.Clock}
            />
          </>
        ) : (
          <MenuBarExtra.Item title="No data yet" />
        )}
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>
        {currentState ? (
          <MenuBarExtra.Item
            title={`Switch to ${nextStateLabel}`}
            icon={nextState === "standing" ? Icon.ArrowUp : Icon.ArrowDown}
            onAction={() => handleToggleState(nextState!)}
          />
        ) : (
          <>
            <MenuBarExtra.Item
              title="Start Standing"
              icon={Icon.ArrowUp}
              onAction={() => handleToggleState("standing")}
            />
            <MenuBarExtra.Item
              title="Start Sitting"
              icon={Icon.ArrowDown}
              onAction={() => handleToggleState("sitting")}
            />
          </>
        )}
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}


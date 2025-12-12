import { List, ActionPanel, Action, Clipboard, showHUD, LocalStorage, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "IST (India)", value: "Asia/Kolkata" },
  { label: "PST (US Pacific)", value: "America/Los_Angeles" },
  { label: "EST (US Eastern)", value: "America/New_York" },
  { label: "CET (Central Europe)", value: "Europe/Berlin" },
  { label: "JST (Japan)", value: "Asia/Tokyo" },
  { label: "AEST (Australia)", value: "Australia/Sydney" },
  { label: "MSK (Moscow)", value: "Europe/Moscow" },
  { label: "CST (China)", value: "Asia/Shanghai" },
  { label: "GMT (London)", value: "Europe/London" },
];

function formatDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

function getNowEpoch() {
  return Math.floor(Date.now() / 1000).toString();
}

export default function Command() {
  const [lastUsedTz, setLastUsedTz] = useState("UTC");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    LocalStorage.getItem("epoch-to-utc-last-tz").then((tz) => {
      if (tz && typeof tz === "string") setLastUsedTz(tz);
    });
  }, []);

  function parseEpoch(epochStr: string): Date | null {
    if (!/^-?\d+$/.test(epochStr.trim())) return null;
    const epochNum = Number(epochStr.trim());
    if (epochNum > 1e12) return new Date(epochNum);
    return new Date(epochNum * 1000);
  }

  const date = parseEpoch(searchText);
  const isValid = date && !isNaN(date.getTime());

  useEffect(() => {
    setError(undefined);
    if (searchText.length === 0) return;
    if (!isValid) setError("Enter a valid epoch (seconds or ms)");
  }, [searchText]);

  return (
    <List
      searchBarPlaceholder="Type or paste epoch timestamp (seconds or ms)"
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      isLoading={false}
      actions={
        <ActionPanel>
          <Action
            title="Paste Current Time (Now)"
            onAction={() => setSearchText(getNowEpoch())}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
          />
        </ActionPanel>
      }
    >
      {error && searchText.length > 0 && <List.EmptyView title="Invalid Input" description={error} />}
      {isValid && (
        <>
          {TIMEZONES.map((tz) => {
            const formatted = formatDate(date!, tz.value);
            return (
              <List.Item
                key={tz.value}
                title={tz.label}
                subtitle={formatted}
                actions={
                  <ActionPanel>
                    <Action.CopyToClipboard
                      content={formatted}
                      title={`Copy ${tz.label} Time`}
                      onCopy={async () => {
                        await LocalStorage.setItem("epoch-to-utc-last-tz", tz.value);
                        await showHUD(`Copied: ${formatted}`);
                      }}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </>
      )}
      {searchText.length === 0 && (
        <List.EmptyView
          title="Epoch to Timezone Converter"
          description={"Type or paste an epoch timestamp (seconds or milliseconds) above. Press ⌘N for current time."}
        />
      )}
    </List>
  );
}

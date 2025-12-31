import { Clipboard, showHUD, BrowserExtension } from "@raycast/api";

export default async function main() {
  try {
    const tabs = await BrowserExtension.getTabs();
    
    if (!tabs || tabs.length === 0) {
      await showHUD("No browser tabs found. Make sure the Raycast browser extension is installed and Dia is open.");
      return;
    }

    // Try to find active tab first, fallback to first tab if no active tab found
    let activeTab = tabs.find((tab) => tab.active);
    if (!activeTab && tabs.length > 0) {
      // If no active tab is found, use the first tab (common in some browsers)
      activeTab = tabs[0];
    }

    // Try to find a Zendesk ticket URL in any tab, starting with the active one
    let url: string | undefined = activeTab?.url;
    let ticketNumber: string | undefined;

    // First, try the active/first tab
    if (url) {
      // More flexible regex to handle various Zendesk URL formats
      // Matches: zendesk.com/agent/tickets/123 or zendesk.com/agent/tickets/123?query or zendesk.com/agent/tickets/123#fragment
      const match = url.match(/zendesk\.com\/agent\/tickets\/(\d+)/i);
      if (match && match[1]) {
        ticketNumber = match[1];
      }
    }

    // If not found in active tab, search all tabs for a Zendesk URL
    if (!ticketNumber) {
      for (const tab of tabs) {
        if (tab.url) {
          const match = tab.url.match(/zendesk\.com\/agent\/tickets\/(\d+)/i);
          if (match && match[1]) {
            ticketNumber = match[1];
            url = tab.url;
            break;
          }
        }
      }
    }

    if (!url) {
      await showHUD("No browser tab URL found");
      return;
    }

    if (ticketNumber) {
      await Clipboard.copy(ticketNumber);
      await showHUD(`Ticket number: ${ticketNumber} (copied!)`);
    } else {
      // Show a more helpful error with the URL we checked (truncated if too long)
      const displayUrl = url.length > 50 ? url.substring(0, 50) + "..." : url;
      await showHUD(`No ticket number found. URL: ${displayUrl}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await showHUD(`Failed to get browser tab URL: ${errorMessage}`);
  }
}

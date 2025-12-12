import { Clipboard, showHUD, BrowserExtension } from "@raycast/api";

export default async function main() {
  try {
    const tabs = await BrowserExtension.getTabs();
    const activeTab = tabs.find((tab) => tab.active);
    const url = activeTab?.url;
    if (!url) {
      await showHUD("No browser tab URL found");
      return;
    }

    // Regex to extract ticket number from Zendesk URL
    const match = url.match(/zendesk\.com\/agent\/tickets\/(\d+)/);
    if (match && match[1]) {
      const ticketNumber = match[1];
      await Clipboard.copy(ticketNumber);
      await showHUD(`Ticket number: ${ticketNumber} (copied!)`);
    } else {
      await showHUD("No ticket number found in URL");
    }
  } catch (error) {
    await showHUD("Failed to get browser tab URL");
  }
}

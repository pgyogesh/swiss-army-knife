import { open, showHUD, BrowserExtension } from "@raycast/api";

export default async function main() {
  try {
    const tabs = await BrowserExtension.getTabs();
    const activeTab = tabs.find((tab) => tab.active);
    const url = activeTab?.url;
    if (!url) {
      await showHUD("No browser tab URL found");
      return;
    }

    // Extract ticket number from Zendesk URL
    const match = url.match(/zendesk\.com\/agent\/tickets\/(\d+)/);
    if (match && match[1]) {
      const ticketNumber = match[1];
      const obsidianUrl = `obsidian://adv-uri?vault=work_notes&filepath=Work%20Brain%2FYugabyte%2FTickets%2F${ticketNumber}.md`;
      await open(obsidianUrl);
      await showHUD(`Opened ticket ${ticketNumber} in Obsidian`);
    } else {
      await showHUD("No ticket number found in URL");
    }
  } catch (error) {
    await showHUD("Failed to open ticket in Obsidian");
  }
}

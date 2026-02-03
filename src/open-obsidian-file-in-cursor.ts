import { showHUD } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

export default async function main() {
  try {
    // Use AppleScript to get the active file from Obsidian
    // First check if Obsidian is running, then get the window title
    const appleScript = `
      tell application "System Events"
        -- Check if Obsidian is running
        set obsidianRunning to false
        try
          set obsidianRunning to (name of processes) contains "Obsidian"
        end try
        
        if not obsidianRunning then
          return "NOT_RUNNING"
        end if
        
        -- Try to get the window title
        try
          tell process "Obsidian"
            set windowCount to count of windows
            if windowCount = 0 then
              return "NO_WINDOWS"
            end if
            
            -- Try to get the frontmost window or first window
            try
              set windowTitle to name of window 1
              return windowTitle
            on error
              -- Try to find any window with a title
              repeat with i from 1 to windowCount
                try
                  set windowTitle to name of window i
                  if windowTitle is not "" then
                    return windowTitle
                  end if
                end try
              end repeat
              return "NO_TITLE"
            end try
          end tell
        on error errMsg
          return "ERROR: " & errMsg
        end try
      end tell
    `;

    let windowTitle = "";
    let tempScriptPath: string | null = null;
    try {
      console.log("Running AppleScript to get Obsidian window title...");
      // Write AppleScript to a temporary file to avoid escaping issues
      tempScriptPath = join(tmpdir(), `obsidian-window-title-${Date.now()}.applescript`);
      writeFileSync(tempScriptPath, appleScript);
      const result = await execAsync(`osascript "${tempScriptPath}"`);
      windowTitle = result.stdout.trim();
      console.log(`AppleScript result: "${windowTitle}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const fullError = error instanceof Error ? error.stack || error.toString() : String(error);
      console.error("Error running AppleScript:", fullError);
      await showHUD(`Failed to get Obsidian window: ${errorMessage}. Make sure Obsidian is running and a file is open.`);
      return;
    } finally {
      // Clean up temporary script file
      if (tempScriptPath) {
        try {
          unlinkSync(tempScriptPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    if (!windowTitle || windowTitle === "" || windowTitle === "NOT_RUNNING") {
      console.log("Obsidian is not running or returned empty title");
      await showHUD("Obsidian is not running. Please open Obsidian and try again.");
      return;
    }

    if (windowTitle === "NO_WINDOWS" || windowTitle === "NO_TITLE") {
      console.log("Obsidian is running but no windows with titles found");
      await showHUD("No open file found in Obsidian. Please open a file in Obsidian and try again.");
      return;
    }

    if (windowTitle.startsWith("ERROR:")) {
      console.error("AppleScript error:", windowTitle);
      await showHUD(`Error accessing Obsidian: ${windowTitle}. Make sure Obsidian is running and a file is open.`);
      return;
    }

    // Extract the file name from the window title
    // Obsidian window titles can be in various formats:
    // - "filename.md - Vault Name - Obsidian v1.x.x"
    // - "filename - Vault Name - Obsidian v1.x.x"
    // - "filename.md"
    let fileName = windowTitle.split(" - ")[0].trim();
    console.log(`Extracted filename: "${fileName}" from window title: "${windowTitle}"`);

    // If no extension, assume it's a markdown file (common in Obsidian)
    const searchFileNames: string[] = [];
    if (fileName.includes(".")) {
      // Has extension, use as-is
      searchFileNames.push(fileName);
    } else {
      // No extension, try with .md extension
      searchFileNames.push(`${fileName}.md`);
      // Also try without extension in case it exists
      searchFileNames.push(fileName);
    }
    console.log(`Will search for files: ${searchFileNames.join(", ")}`);

    // Get the home directory using shell command
    let homeDir = "";
    try {
      const homeResult = await execAsync("echo $HOME");
      homeDir = homeResult.stdout.trim();
    } catch {
      // Fallback to environment variable if available
      homeDir = process.env.HOME || process.env.USERPROFILE || "";
    }

    if (!homeDir) {
      await showHUD("Could not determine home directory");
      return;
    }

    // Common Obsidian vault locations
    const commonVaultPaths = [
      `${homeDir}/Documents/Obsidian`,
      `${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents`,
      `${homeDir}/.obsidian`,
      `${homeDir}/Documents`,
    ];

    // First, try to find the file using mdfind (Spotlight) - faster
    let filePath = "";
    for (const searchFileName of searchFileNames) {
      try {
        // Escape the filename for shell: replace single quotes with '\'' and wrap in single quotes
        const escapedFileName = searchFileName.replace(/'/g, "'\\''");
        const findFileScript = `mdfind -name '${escapedFileName}' -onlyin ~ 2>/dev/null | grep -i '\\.md$' | head -1`;
        console.log(`Searching for file with mdfind: "${searchFileName}"`);
        const filePathResult = await execAsync(findFileScript);
        const foundPath = filePathResult.stdout.trim();
        if (foundPath) {
          filePath = foundPath;
          console.log(`Found file with mdfind: ${filePath}`);
          break;
        }
      } catch (error) {
        // mdfind failed for this filename, continue to next
        console.log(`mdfind failed for "${searchFileName}":`, error instanceof Error ? error.message : String(error));
      }
    }
    if (!filePath) {
      console.log("mdfind returned no results for any filename variant");
    }

    // If mdfind didn't work, try searching in common Obsidian vault locations
    if (!filePath) {
      console.log("Trying to find file in common Obsidian vault locations...");
      for (const vaultPath of commonVaultPaths) {
        for (const searchFileName of searchFileNames) {
          try {
            // Escape both vault path and filename
            const escapedVaultPath = vaultPath.replace(/'/g, "'\\''");
            const escapedFileName = searchFileName.replace(/'/g, "'\\''");
            const findInVaultScript = `find '${escapedVaultPath}' -name '${escapedFileName}' -type f 2>/dev/null | head -1`;
            console.log(`Searching in vault path: ${vaultPath} for "${searchFileName}"`);
            const result = await execAsync(findInVaultScript);
            const foundPath = result.stdout.trim();
            if (foundPath) {
              filePath = foundPath;
              console.log(`Found file in vault: ${filePath}`);
              break;
            }
          } catch (error) {
            // Continue to next vault path
            console.log(`Search failed in ${vaultPath} for "${searchFileName}":`, error instanceof Error ? error.message : String(error));
          }
        }
        if (filePath) break;
      }
    }

    // If still not found, try a broader search in the home directory
    if (!filePath) {
      console.log("Trying broader search in home directory...");
      for (const searchFileName of searchFileNames) {
        try {
          const escapedHomeDir = homeDir.replace(/'/g, "'\\''");
          const escapedFileName = searchFileName.replace(/'/g, "'\\''");
          const broadSearchScript = `find '${escapedHomeDir}' -name '${escapedFileName}' -type f 2>/dev/null | grep -i '\\.md$' | head -1`;
          console.log(`Broad search for: "${searchFileName}"`);
          const result = await execAsync(broadSearchScript);
          const foundPath = result.stdout.trim();
          if (foundPath) {
            filePath = foundPath;
            console.log(`Found file in broad search: ${filePath}`);
            break;
          }
        } catch (error) {
          // Broad search also failed for this filename
          console.log(`Broad search failed for "${searchFileName}":`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (!filePath) {
      console.error(`Could not find file: ${searchFileNames.join(" or ")} in any searched location`);
      await showHUD(`Could not find file: ${fileName}. Make sure the file exists in your Obsidian vault.`);
      return;
    }

    console.log(`Final file path: ${filePath}`);

    // Get the display name for the HUD message
    const displayFileName = fileName.includes(".") ? fileName : `${fileName}.md`;

    // Open the file in Cursor
    // Try multiple methods to open the file
    try {
      // Method 1: Try using `cursor` command directly
      console.log(`Attempting to open file with 'cursor' command: ${filePath}`);
      await execAsync(`cursor "${filePath.replace(/"/g, '\\"')}"`);
      console.log("Successfully opened file with 'cursor' command");
      await showHUD(`Opened ${displayFileName} in Cursor`);
    } catch (error1) {
      console.log("Method 1 (cursor command) failed:", error1 instanceof Error ? error1.message : String(error1));
      try {
        // Method 2: Try using `open -a Cursor`
        console.log(`Attempting to open file with 'open -a Cursor': ${filePath}`);
        await execAsync(`open -a Cursor "${filePath.replace(/"/g, '\\"')}"`);
        console.log("Successfully opened file with 'open -a Cursor'");
        await showHUD(`Opened ${displayFileName} in Cursor`);
      } catch (error2) {
        console.log("Method 2 (open -a Cursor) failed:", error2 instanceof Error ? error2.message : String(error2));
        try {
          // Method 3: Try using cursor:// URI scheme
          const cursorUri = `cursor://file/${encodeURIComponent(filePath)}`;
          console.log(`Attempting to open file with cursor:// URI: ${cursorUri}`);
          await execAsync(`open "${cursorUri.replace(/"/g, '\\"')}"`);
          console.log("Successfully opened file with cursor:// URI");
          await showHUD(`Opened ${displayFileName} in Cursor`);
        } catch (error3) {
          const errorMessage = error3 instanceof Error ? error3.message : "Unknown error";
          const fullError = error3 instanceof Error ? error3.stack || error3.toString() : String(error3);
          console.error("All methods to open Cursor failed. Last error:", fullError);
          await showHUD(`Failed to open file in Cursor: ${errorMessage}. Make sure Cursor is installed and the 'cursor' command is available in PATH.`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const fullError = error instanceof Error ? error.stack || error.toString() : String(error);
    console.error("Unexpected error:", fullError);
    await showHUD(`Failed to open Obsidian file in Cursor: ${errorMessage}`);
  }
}

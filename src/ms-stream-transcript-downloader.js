(function () {
  "use strict";

  // Bookmarklets run with the current page's privileges, so keep this script self-contained.
  // Do not add network calls or external dependencies here; transcript text stays in the tab.
  const GLOBAL_NAME = "MSStreamTranscriptDownloader";
  const SCRIPT_VERSION = "0.7.0";
  const BUTTON_ID = "ms-stream-transcript-download-button";

  if (window[GLOBAL_NAME] && window[GLOBAL_NAME].version === SCRIPT_VERSION) {
    window[GLOBAL_NAME].extractTranscript();
    return;
  }

  const config = {
    scrollPauseMs: 650,
    initialPauseMs: 900,
    bottomPauseMs: 1200,
    stableRoundsToStop: 12,
    maxIterations: 700,
    minScrollStepPx: 250
  };

  const entrySelectors = [
    ".ms-List-cell",
    "[data-list-index]",
    "[id^='listItem-']",
    "[role='listitem']"
  ];

  const speakerSelectors = [
    "[class*='itemDisplayName']",
    "[class*='displayName']",
    "[class*='eventSpeakerName']",
    "[id^='Header-speaker-']",
    "[class*='speaker']"
  ];

  const timestampSelectors = [
    "[id^='Header-timestamp-']",
    "button[id^='Left-timestamp-']",
    "[id^='Left-timestamp-']",
    "[class*='timestamp']",
    "time"
  ];

  const textSelectors = [
    // Preferred: the dedicated span that holds ONLY the spoken text. Selecting this
    // avoids the speaker name, the screen-reader spoken-timestamp label, and the
    // inline edit button that live in sibling elements of the entry.
    "[id^='text-']",
    "[class*='entryText']",
    "[id^='sub-entry-']",
    "[class*='transcriptText']",
    "[class*='captionText']"
  ];

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function getText(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const value = normalizeText(element && element.textContent);

      if (value) {
        return value;
      }
    }

    return "";
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function timestampToSpokenText(timestamp) {
    const timeParts = timestamp
      .replace(/[^\d:]/g, "")
      .split(":")
      .map((part) => Number.parseInt(part, 10));

    if (
      timeParts.length < 2 ||
      timeParts.length > 3 ||
      timeParts.some((part) => !Number.isFinite(part))
    ) {
      return "";
    }

    const [hours, minutes, seconds] =
      timeParts.length === 3 ? timeParts : [0, timeParts[0], timeParts[1]];
    const segments = [];

    if (hours > 0) {
      segments.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    }

    if (timeParts.length === 2 || hours > 0) {
      segments.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
    }

    segments.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);

    return segments.join(" ");
  }

  function formatTimestamp(hours, minutes, seconds) {
    const paddedSeconds = String(seconds).padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
    }

    return `${minutes}:${paddedSeconds}`;
  }

  function parseSpokenTimestampPrefix(value) {
    const match = normalizeText(value).match(
      /^\s*(?:(\d+)\s+hours?\s*)?(?:(\d+)\s+minutes?\s*)?(\d+)\s+seconds?/i
    );

    if (!match || (!match[1] && !match[2])) {
      return null;
    }

    const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
    const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
    const seconds = Number.parseInt(match[3], 10);

    return {
      spoken: match[0].trim(),
      timestamp: formatTimestamp(hours, minutes, seconds)
    };
  }

  function stripPrefix(value, prefix) {
    if (!prefix) {
      return value;
    }

    return value
      .replace(new RegExp(`^\\s*${escapeRegExp(prefix)}\\s*:?\\s*`, "i"), "")
      .trim();
  }

  function stripUiAffordances(text) {
    return text
      // The active/hovered transcript row renders an inline edit button. Its icon is a
      // Private Use Area glyph (e.g. U+E70F); everything from that glyph to the end of the
      // string is button chrome ("Edit" + the "Use enter key to enable transcript edit mode"
      // tooltip). Real transcript text never contains icon-font glyphs, so cut there.
      .replace(/[\ue000-\uf8ff][\s\S]*$/, "")
      // Fallback for cases where the icon glyph is absent but the tooltip text is present.
      .replace(/\s*(?:Edit\s*)?Use enter key to enable transcript edit mode\s*$/i, "")
      .trim();
  }

  function stripTranscriptChrome(value, speaker, timestamp) {
    let text = normalizeText(value);
    const spokenTimestamp = timestampToSpokenText(timestamp);

    // Remove inline UI chrome (edit button icon/label/tooltip) before anything else.
    text = stripUiAffordances(text);

    // Stream can include accessibility labels in textContent, for example:
    // "Speaker Name 1 minute 2 secondsYeah." Keep the useful text and remove that chrome.
    text = stripPrefix(text, speaker);
    text = stripPrefix(text, timestamp);
    text = stripPrefix(text, spokenTimestamp);

    const inferredTimestamp = parseSpokenTimestampPrefix(text);

    if (inferredTimestamp) {
      text = stripPrefix(text, inferredTimestamp.spoken);
    }

    if (speaker && timestamp) {
      text = text
        .replace(
          new RegExp(
            `^\\s*${escapeRegExp(speaker)}\\s*${escapeRegExp(timestamp)}\\s*:?\\s*`,
            "i"
          ),
          ""
        )
        .trim();
    }

    if (speaker && spokenTimestamp) {
      text = text
        .replace(
          new RegExp(
            `^\\s*${escapeRegExp(speaker)}\\s*${escapeRegExp(spokenTimestamp)}`,
            "i"
          ),
          ""
        )
        .trim();
    }

    return text;
  }

  function getTranscriptText(root) {
    for (const selector of textSelectors) {
      const element = root.querySelector(selector);
      const value = normalizeText(element && element.textContent);

      if (value) {
        return value;
      }
    }

    return "";
  }

  function getVideoTitle() {
    const heading = document.querySelector("h1");
    const headingText = normalizeText(heading && heading.textContent);

    if (headingText) {
      return headingText;
    }

    const title = normalizeText(document.title)
      .replace(/\s+-\s+Microsoft Stream.*$/i, "")
      .replace(/\s+-\s+Stream.*$/i, "")
      .replace(/\.mp4$/i, "")
      .trim();

    return title || "Microsoft Stream Transcript";
  }

  function sanitizeFilename(filename) {
    const sanitized = filename
      // Replace path separators, Windows-reserved characters and control chars.
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      // Strip leading dots so we never produce a hidden file or a ".."-style name.
      .replace(/^[._]+/, "")
      .replace(/_+$/, "")
      .slice(0, 180);

    return sanitized || "microsoft-stream-transcript";
  }

  function isScrollable(element) {
    if (!element) {
      return false;
    }

    return element.scrollHeight > element.clientHeight + 20;
  }

  function findScrollableDescendant(root) {
    if (isScrollable(root)) {
      return root;
    }

    const descendants = Array.from(root.querySelectorAll("*"))
      .filter(isScrollable)
      .sort((a, b) => b.scrollHeight - a.scrollHeight);

    return descendants[0] || null;
  }

  function findScrollableContainer() {
    const transcriptRoots = [
      "#scrollToTargetTargetedFocusZone",
      "[id*='scrollToTarget']",
      "#OneTranscript",
      "[aria-label='Transcript']",
      "#pluginContent"
    ];

    for (const selector of transcriptRoots) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const scroller = findScrollableDescendant(element);

        if (scroller) {
          return scroller;
        }
      }
    }

    const listCells = document.querySelector(".ms-List-cell, [id^='listItem-']");

    if (listCells) {
      let current = listCells.parentElement;

      while (current && current !== document.body) {
        if (isScrollable(current)) {
          return current;
        }

        current = current.parentElement;
      }
    }

    return null;
  }

  function getEntryIndex(item) {
    const dataIndex = Number.parseInt(item.getAttribute("data-list-index"), 10);

    if (Number.isFinite(dataIndex)) {
      return dataIndex;
    }

    const listItemMatch = (item.id || "").match(/^listItem-(\d+)/);

    if (listItemMatch) {
      return Number.parseInt(listItemMatch[1], 10);
    }

    return null;
  }

  function getCandidateItems(container) {
    // Use the FIRST selector that matches, not the union of all of them. The
    // selectors are ordered from most to least specific; "[role='listitem']" also
    // matches inner elements (sub-entries, item headers), so unioning would harvest
    // each utterance multiple times and produce duplicate, header-less entries.
    for (const root of [container, document]) {
      for (const selector of entrySelectors) {
        const matches = root.querySelectorAll(selector);

        if (matches.length > 0) {
          return Array.from(matches);
        }
      }
    }

    return [];
  }

  function readEntry(item, fallbackSpeaker) {
    const speaker = getText(item, speakerSelectors) || fallbackSpeaker;
    const timestamp = getText(item, timestampSelectors);
    const rawText = getTranscriptText(item);
    // The preferred selector returns clean text; stripTranscriptChrome is a defensive
    // fallback for older/other Stream layouts where chrome leaks into the text element.
    const text = stripTranscriptChrome(rawText, speaker, timestamp);

    if (!text) {
      return null;
    }

    return {
      index: getEntryIndex(item),
      speaker,
      timestamp,
      text
    };
  }

  function createHarvester(container) {
    const entries = new Map();
    let lastSpeaker = "";
    let sequence = 0;

    function harvest() {
      let newEntries = 0;

      for (const item of getCandidateItems(container)) {
        const entry = readEntry(item, lastSpeaker);

        if (!entry) {
          continue;
        }

        if (entry.speaker) {
          lastSpeaker = entry.speaker;
        }

        const key = Number.isFinite(entry.index)
          ? `index:${entry.index}`
          : `content:${entry.timestamp}|${entry.speaker}|${entry.text}`;

        if (entries.has(key)) {
          const existing = entries.get(key);

          if (!existing.speaker && entry.speaker) {
            existing.speaker = entry.speaker;
          }

          continue;
        }

        entries.set(key, {
          ...entry,
          order: Number.isFinite(entry.index) ? entry.index : Number.MAX_SAFE_INTEGER,
          sequence: sequence++
        });
        newEntries++;
      }

      return newEntries;
    }

    function getEntries() {
      return Array.from(entries.values()).sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }

        return a.sequence - b.sequence;
      });
    }

    return {
      harvest,
      getEntries
    };
  }

  function formatTranscript(title, entries) {
    const lines = [
      `TRANSCRIPT: ${title}`,
      `Extracted: ${new Date().toLocaleString()}`,
      `Total entries: ${entries.length}`,
      "=".repeat(80)
    ];

    // Stream only labels the row where the speaker changes with a name/timestamp;
    // consecutive rows from the same speaker are continuations. Group them under a
    // single "[timestamp] Speaker:" header so the output is consistent instead of
    // emitting a bare "Speaker:" line (with no timestamp) for every continuation row.
    let currentSpeaker = null;

    for (const entry of entries) {
      if (entry.speaker !== currentSpeaker) {
        currentSpeaker = entry.speaker;

        const header = [
          entry.timestamp ? `[${entry.timestamp}]` : "",
          entry.speaker ? `${entry.speaker}:` : ""
        ]
          .filter(Boolean)
          .join(" ");

        lines.push("");

        if (header) {
          lines.push(header);
        }
      }

      lines.push(entry.text);
    }

    return lines.join("\n").trim() + "\n";
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Revoke after the synthetic click so the browser can start the download first.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setButtonState(text, backgroundColor) {
    const button = document.getElementById(BUTTON_ID);

    if (!button) {
      return;
    }

    button.textContent = text;
    button.style.background = backgroundColor;
  }

  async function extractTranscript() {
    const button = ensureStatusButton();
    const container = findScrollableContainer();

    if (!container) {
      window.alert("Cannot find the transcript scroll container. Open the Transcript pane and try again.");
      setButtonState("Download transcript", "#0078d4");
      return;
    }

    const title = getVideoTitle();
    const harvester = createHarvester(container);

    button.disabled = true;
    button.style.cursor = "wait";
    setButtonState("Working... 0 entries", "#d83b01");

    container.scrollTop = 0;
    await wait(config.initialPauseMs);

    let stableRounds = 0;
    let iteration = 0;

    while (stableRounds < config.stableRoundsToStop && iteration < config.maxIterations) {
      iteration++;

      const newEntries = harvester.harvest();
      const entries = harvester.getEntries();
      const totalHeight = Math.max(container.scrollHeight - container.clientHeight, 1);
      const progress = Math.min(99, Math.round((container.scrollTop / totalHeight) * 100));
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;

      setButtonState(`Working... ${progress}% (${entries.length} entries)`, "#d83b01");

      if (newEntries === 0) {
        stableRounds++;
      } else {
        stableRounds = 0;
      }

      if (isAtBottom) {
        await wait(config.bottomPauseMs);
        harvester.harvest();

        if (stableRounds >= 4) {
          break;
        }
      }

      const scrollStep = Math.max(
        Math.floor(container.clientHeight * 0.8),
        config.minScrollStepPx
      );

      container.scrollBy(0, scrollStep);
      await wait(config.scrollPauseMs);
    }

    harvester.harvest();

    const entries = harvester.getEntries();

    if (entries.length === 0) {
      window.alert("No transcript entries found. Make sure the transcript is visible before running this.");
      button.disabled = false;
      button.style.cursor = "pointer";
      setButtonState("Download transcript", "#0078d4");
      return;
    }

    const transcript = formatTranscript(title, entries);
    const filename = `${sanitizeFilename(title)}_transcript.txt`;

    downloadText(filename, transcript);

    button.disabled = false;
    button.style.cursor = "pointer";
    setButtonState(`Saved ${entries.length} entries`, "#107c10");

    window.setTimeout(() => {
      setButtonState("Download transcript", "#0078d4");
    }, 8000);
  }

  function ensureStatusButton() {
    const existingButton = document.getElementById(BUTTON_ID);

    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement("button");

    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Download transcript";
    button.style.cssText = [
      "position:fixed",
      "top:150px",
      "right:20px",
      "z-index:2147483647",
      "padding:12px 18px",
      "background:#0078d4",
      "color:#fff",
      "border:0",
      "border-radius:4px",
      "box-shadow:0 2px 8px rgba(0,0,0,.3)",
      "cursor:pointer",
      "font:600 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      extractTranscript();
    });

    document.body.appendChild(button);
    return button;
  }

  function init() {
    ensureStatusButton();
    console.log("Microsoft Stream transcript downloader loaded. Click the Download transcript button to start.");
  }

  const publicApi = {
    version: SCRIPT_VERSION,
    ensureStatusButton,
    extractTranscript
  };

  if (window.__MS_STREAM_TRANSCRIPT_DOWNLOADER_TEST__) {
    publicApi._private = {
      formatTimestamp,
      formatTranscript,
      getCandidateItems,
      getTranscriptText,
      parseSpokenTimestampPrefix,
      readEntry,
      sanitizeFilename,
      stripTranscriptChrome,
      stripUiAffordances,
      timestampToSpokenText
    };
  }

  window[GLOBAL_NAME] = publicApi;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(rootDir, "src", "ms-stream-transcript-downloader.js");
const distDir = path.join(rootDir, "dist");

const source = (await readFile(sourcePath, "utf8")).trim();
const versionMatch = source.match(/const SCRIPT_VERSION = "([^"]+)";/);

if (!versionMatch) {
  throw new Error("Could not find SCRIPT_VERSION in source file.");
}

const scriptVersion = versionMatch[1];
const bookmarkletPayload = `if(!window.MSStreamTranscriptDownloader||window.MSStreamTranscriptDownloader.version!=="${scriptVersion}"){${source}}\nwindow.MSStreamTranscriptDownloader.extractTranscript();`;
const bookmarklet = `javascript:${encodeURIComponent(bookmarkletPayload)}`;

await mkdir(distDir, { recursive: true });
await writeFile(path.join(distDir, "browser-snippet.js"), `${source}\n`);
await writeFile(path.join(distDir, "bookmarklet.txt"), `${bookmarklet}\n`);
await writeFile(path.join(distDir, "site.js"), createSiteJs());
await writeFile(path.join(distDir, "index.html"), createBookmarkletHtml(bookmarklet));
await writeFile(path.join(distDir, "bookmarklet.html"), createBookmarkletHtml(bookmarklet));

console.log("Built dist/browser-snippet.js");
console.log("Built dist/bookmarklet.txt");
console.log("Built dist/site.js");
console.log("Built dist/index.html");
console.log("Built dist/bookmarklet.html");

function createBookmarkletHtml(href) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <meta name="referrer" content="no-referrer">
    <title>Microsoft Stream Transcript Downloader Bookmarklet</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        margin: 0 auto;
        max-width: 820px;
        padding: 40px 20px;
        line-height: 1.5;
      }

      a.bookmarklet,
      button {
        background: #0078d4;
        border: 0;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font: inherit;
        font-weight: 600;
        margin: 4px 8px 4px 0;
        padding: 12px 16px;
        text-decoration: none;
      }

      textarea {
        box-sizing: border-box;
        font: 13px ui-monospace, SFMono-Regular, Consolas, monospace;
        min-height: 140px;
        width: 100%;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <h1>Microsoft Stream Transcript Downloader</h1>
    <p>Use this page to install or copy the bookmarklet that downloads the visible Microsoft Stream or Teams transcript from the current browser tab.</p>

    <h2>Install by dragging</h2>
    <p>Drag this link to your bookmarks bar:</p>
    <p><a class="bookmarklet" href="${escapeHtml(href)}">Download Stream Transcript</a></p>

    <h2>Install by copying</h2>
    <p>If dragging does not work, copy the bookmarklet URL below and paste it into a new bookmark's URL/location field.</p>
    <p><button type="button" id="copy">Copy bookmarklet URL</button><span id="status" role="status"></span></p>
    <textarea id="bookmarklet" readonly>${escapeHtml(href)}</textarea>

    <h2>Use it</h2>
    <ol>
      <li>Open a Microsoft Stream or Teams recording page.</li>
      <li>Open the transcript pane and confirm transcript rows are visible.</li>
      <li>Click the <strong>Download Stream Transcript</strong> bookmark.</li>
      <li>Wait for the text file download.</li>
    </ol>

    <script src="site.js"></script>
  </body>
</html>
`;
}

function createSiteJs() {
  return `const button = document.getElementById("copy");
const status = document.getElementById("status");
const textarea = document.getElementById("bookmarklet");

button.addEventListener("click", async () => {
  textarea.select();

  try {
    await navigator.clipboard.writeText(textarea.value);
    status.textContent = " Copied.";
    return;
  } catch {
    // Fall back for browsers or policies that block the async clipboard API.
  }

  const copied = document.execCommand("copy");
  status.textContent = copied ? " Copied." : " Copy failed; select the text and copy it manually.";
});
`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

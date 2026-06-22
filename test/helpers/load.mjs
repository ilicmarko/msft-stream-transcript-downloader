import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, "..", "..", "src", "ms-stream-transcript-downloader.js");

/**
 * Loads the browser script inside an isolated VM context that mimics just enough
 * of the DOM for the script to initialise without throwing. The test-only flag
 * `__MS_STREAM_TRANSCRIPT_DOWNLOADER_TEST__` is set so the script exposes its
 * internal pure helpers on `window.MSStreamTranscriptDownloader._private`.
 *
 * @returns {Promise<{ api: object, _private: object, context: object }>}
 */
export async function loadScript() {
  const source = await readFile(sourcePath, "utf8");
  const context = createBrowserLikeContext();

  context.window.__MS_STREAM_TRANSCRIPT_DOWNLOADER_TEST__ = true;
  vm.runInNewContext(source, context);

  const api = context.window.MSStreamTranscriptDownloader;

  return { api, _private: api._private, context };
}

function createBrowserLikeContext() {
  const noopElement = {
    addEventListener() {},
    appendChild() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    style: {}
  };

  const document = {
    body: noopElement,
    readyState: "complete",
    addEventListener() {},
    createElement() {
      return {
        ...noopElement,
        click() {},
        remove() {}
      };
    },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    title: ""
  };

  const window = {
    alert() {},
    setTimeout() {},
    URL: {
      createObjectURL() {
        return "blob:test";
      },
      revokeObjectURL() {}
    }
  };

  return {
    Blob,
    console,
    document,
    window
  };
}

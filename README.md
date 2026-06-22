# Microsoft Stream Transcript Downloader

Download a visible Microsoft Stream or Teams recording transcript directly from your browser, even when the built-in transcript download option is unavailable.

The script runs locally in the current browser tab. It scrolls the transcript pane, collects the virtualized transcript rows that Microsoft Stream renders on screen, formats them as a text file, and downloads the result. It does not call any external service.

## What it captures

- Transcript timestamps
- Speaker names when Microsoft Stream exposes them in the transcript row
- Transcript text
- The video title, used as the downloaded filename

The output is a `.txt` file named like `Video_Title_transcript.txt`.

## Before running it

1. Open the Microsoft Stream or Teams recording page.
2. Open the **Transcript** pane and make sure transcript rows are visible.
3. Keep the tab open while the script scrolls the transcript. Long recordings can take a few minutes.

If Microsoft changes Stream's page markup, the script may need selector updates in `src/ms-stream-transcript-downloader.js`.

## Option 1: Bookmarklet

Use this when you want a reusable bookmark that starts the extraction from the browser toolbar.

### Build the bookmarklet

```bash
npm run build
```

This creates:

- `dist/bookmarklet.txt` - the full `javascript:` bookmarklet URL
- `dist/index.html` - the GitHub Pages-ready bookmarklet page
- `dist/bookmarklet.html` - the same page with a descriptive filename
- `dist/site.js` - the small copy-button script for the GitHub Pages page
- `dist/browser-snippet.js` - the same script for DevTools snippets

## GitHub Pages

This repo includes a GitHub Actions workflow that builds and deploys the generated bookmarklet page from `dist/` to GitHub Pages.

### Enable Pages

1. Push the repo to GitHub.
2. Open the repository **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push to `main` or run the **Deploy GitHub Pages** workflow manually.

After deployment, the page will be available at:

```text
https://<your-github-username>.github.io/msft-stream-transcript-downloader/
```

For this repository, that should be:

```text
https://ilicmarko.github.io/msft-stream-transcript-downloader/
```

Use that page to drag the bookmarklet to the bookmarks bar or copy the bookmarklet URL.

### Install the bookmarklet

1. Run `npm run build`.
2. Open `dist/bookmarklet.txt`.
3. Copy the entire `javascript:` URL.
4. Create a new browser bookmark.
5. Paste the copied URL into the bookmark's URL/location field.
6. Name it something like `Download Stream Transcript`.

You can also open `dist/bookmarklet.html` and drag **Download Stream Transcript** to your bookmarks bar.

### Use the bookmarklet

1. Open a Stream or Teams recording page.
2. Open the transcript pane.
3. Click the bookmarklet.
4. Wait for the script to finish scrolling and downloading the `.txt` file.

The bookmarklet starts extraction immediately. The floating **Download transcript** control that appears on the Stream page is used for progress/status and can be clicked later to run the extraction again.

## Option 2: Browser snippet

Use this when you do not want to install a bookmarklet or when your browser blocks bookmarklet creation.

### Create the snippet

1. Open the Stream or Teams recording page.
2. Open browser DevTools.
3. Go to **Sources** > **Snippets**.
4. Create a new snippet named `stream-transcript-downloader`.
5. Copy the contents of `src/ms-stream-transcript-downloader.js` into the snippet.
6. Save it.

If you prefer using the generated file, run `npm run build` and copy from `dist/browser-snippet.js`.

### Use the snippet

1. Open the transcript pane on the recording page.
2. Run the saved snippet from DevTools.
3. Click the **Download transcript** button that appears in the upper-right corner.
4. Wait for the `.txt` download.

If you run the snippet again after it is already loaded, it starts extraction immediately.

## Development

Install dev dependencies (used only by the test suite):

```bash
npm install
```

Run syntax checks and the test suite:

```bash
npm run check
```

Build generated browser artifacts:

```bash
npm run build
```

Project layout:

```text
src/ms-stream-transcript-downloader.js  Main browser script
scripts/build-bookmarklet.mjs           Build script for bookmarklet/snippet artifacts
test/                                   Test suite (unit + DOM integration)
dist/                                   Generated files from npm run build
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for architecture, how the
selectors/extraction work, the testing approach, and release/versioning notes.

## Security notes

- The downloader does not send transcript content to any server. It reads visible DOM text, creates a local `Blob`, and triggers a local `.txt` download.
- Bookmarklets run with the privileges of the page where you click them. Only use the generated bookmarklet from this repository, and only on Stream or Teams recording pages you trust.
- The GitHub Pages install page uses a restrictive Content Security Policy and an external `site.js` file for the copy button.
- Transcript text is read with `textContent`, not interpreted as HTML.

## Troubleshooting

**Cannot find the transcript scroll container**  
Open the transcript pane first, confirm transcript rows are visible, then run the script again.

**The download has missing early or late transcript entries**  
Scroll the transcript pane to confirm Stream has loaded the transcript, then rerun the script. Very long recordings may need another pass if the browser throttles background tabs.

**The bookmarklet does nothing**  
Some browsers or enterprise policies restrict bookmarklets. Use the browser snippet method instead.

**The button appears but no entries are found**  
Microsoft may have changed the transcript DOM. Update the selectors in `src/ms-stream-transcript-downloader.js`.

## Disclaimer

This is an unofficial helper script. Only use it for recordings and transcripts you are allowed to access and retain.

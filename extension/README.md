# ScrapeConvert Image Grabber (Chrome extension)

A small Manifest V3 extension that finds the images on the page you are currently
viewing and lets you convert and download them, or send them to the
[ScrapeConvert](https://scrapeconvert.com) workbench for batch conversion.

## What it does

- Scans the **active tab** for images: visible `<img>`, CSS `background-image`,
  and `<picture>` sources.
- Lets you select a subset and either:
  - **Download** them locally (with optional in-browser conversion), or
  - **Open in Workbench** to batch-convert on scrapeconvert.com (WebP, AVIF, PNG,
    JPEG) with quality and resize control.

## Same-tab only, no proxy

The extension reads the page you already have open, so it makes **no network
request through the ScrapeConvert proxy and runs no bot check**. There is no
SSRF surface here. (Cross-page or whole-site crawling is a web-app feature, not
part of this extension.)

## Permissions

- `activeTab` + `scripting` — read images from the tab you click the extension on.
- `downloads` — save selected images.
- `storage` — remember your settings and pass the Workbench handoff payload.

It does **not** request the broad `tabs` permission.

## Install (unpacked, for development)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` directory.

## Package for the store

Zip the `extension/` directory contents (manifest at the root of the zip):

    cd extension && zip -r ../scrapeconvert-extension.zip . -x '*/test/*'

## Workbench handoff

"Open in Workbench" stores the selected images under `sc.handoff` in extension
storage and opens `<base>/workbench`, where `<base>` defaults to
`https://scrapeconvert.com` and is overridable in extension storage for
self-hosting or staging.

## Tests

    node --test test/

## License

MIT (same as the main project).

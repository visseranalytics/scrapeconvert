<div align="center">
<img width="1200" height="475" alt="Morphix Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Morphix

**Secure Client-Side Image Converter & URL Scraper**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## About

Morphix is a privacy-first image conversion tool built for developers and teams who need to batch process images without uploading them to external servers. All processing happens directly in your browser.

### Why We Built This

Existing image tools have limitations that slow down development workflows:

- **No batch URL support** - Most tools require manual file uploads one at a time
- **Manual format conversion** - Converting to WebP or other formats requires separate steps
- **Duplicate handling** - Downloaded images often have duplicates that need manual cleanup
- **Privacy concerns** - Images are uploaded to third-party servers for processing

Morphix solves these problems with a streamlined, client-side solution.

## Features

### Image Converter
- **Batch conversion** - Convert multiple images at once
- **Format support** - JPEG, PNG, WebP output formats
- **Quality control** - Adjustable compression quality (10-100%)
- **Resize options** - Set max width/height with aspect ratio lock
- **ZIP download** - Download all converted images in a single archive

### URL Scraper
- **Batch URL scraping** - Paste multiple URLs and extract all images
- **Smart filtering** - Filter by format, size, and search terms
- **Sorting options** - Sort by name, file size, or dimensions
- **Direct to converter** - Send scraped images directly to the converter
- **Duplicate detection** - Identifies and handles duplicate images

### Privacy & Security
- **100% client-side** - All processing happens in your browser
- **No uploads** - Your images never leave your device
- **No tracking** - GDPR compliant analytics only
- **No ads** - Clean, distraction-free interface
- **Open source** - Fully transparent codebase

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **JSZip** - ZIP file generation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tjvisser/morphix.git
   cd morphix
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── main.tsx              # App entry point
├── router.tsx            # Route configuration
├── features/
│   ├── home/             # Home page components
│   ├── converter/        # Image converter feature
│   └── scraper/          # URL scraper feature
└── shared/
    ├── components/       # Shared UI components
    ├── context/          # React context providers
    ├── services/         # Utility functions
    └── types/            # TypeScript type definitions
```

## Support

If you find Morphix useful, consider [buying me a coffee](https://buymeacoffee.com/tjvisser).

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. We make no guarantees regarding its performance, reliability, or fitness for any particular purpose. Use at your own risk.

## License

MIT License - see [LICENSE](LICENSE) for details.

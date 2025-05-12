# Chronotab Chrome Extension

Chronotab is a Chrome extension to schedule and auto-open sets of tabs at specific times. Built with Vite, React, TailwindCSS, and ShadCN UI.

## Download

[Chronotab - Chrome Web Store](https://chromewebstore.google.com/detail/panmfjbiocmhcfiocbpmpcjkkhjlmiil)

## Documentation

For detailed documentation, visit [chronotab.app](https://chronotab.app).

## Getting Started

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Start the dev server:
   ```sh
   pnpm run dev
   ```
3. Load the extension in Chrome:
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable "Developer mode".
    - Click "Load unpacked" and select the `dist` folder in this project.

## Project Structure
- `src/` - React source code for the extension's UI pages.
  - `main.jsx` - Entry point for the React application.
  - `App.jsx` - Main application component.
  - `pages/` - Contains components for different views like Dashboard, ScheduleEditor.
  - `components/` - Reusable UI components.
    - `ui/` - ShadCN UI components.
  - `lib/` - Utility functions.
  - `assets/` - Static assets used within the React app.
  - `manifest.json` - The Chrome extension manifest file.
- `src/background.js` - Chrome extension background script for managing alarms and tab operations.
- `src/utils/scheduler.js` - Logic for scheduling tab openings.
- `public/` - Static assets like icons for the extension.
- `dist/` - The build output directory (after running `pnpm run build`). This is the directory you load as an unpacked extension in Chrome.
- `docs/` - Project documentation.

## Development

- **Build for production:**
  ```sh
  pnpm run build
  ```
- **Linting:**
  ```sh
  pnpm run lint
  ```
- **Formatting:**
  Ensure you have Prettier configured in your editor or run:
  ```sh
  pnpm run format
  ```

See the [development guide](https://chronotab.app/development) and [features list](https://chronotab.app/features) for more details.

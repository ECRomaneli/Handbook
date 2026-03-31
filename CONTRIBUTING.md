# Contributing to Handbook

Thank you for your interest in contributing to Handbook! Contributions are welcome and appreciated.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an [issue](https://github.com/ECRomaneli/Handbook/issues) with:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Your OS and Handbook version
- Screenshots, if applicable

### Suggesting Features

Feature suggestions are welcome! Open an [issue](https://github.com/ECRomaneli/Handbook/issues) with:

- A clear description of the feature
- The problem it solves or the use case it enables
- Any ideas on how it could be implemented

### Submitting Pull Requests

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/Handbook.git
   cd Handbook
   ```
3. **Create a branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies** and verify the app runs:
   ```bash
   npm install
   npm start
   ```
5. **Make your changes** — keep commits focused and descriptive
6. **Test** your changes manually across platforms if possible
7. **Push** your branch and open a Pull Request against `master`

### Development Setup

See the [Build Guide](docs/BUILD.md) for full instructions on setting up the development environment.

#### Quick Start

```bash
npm install       # Install dependencies
npm run build:dev # Build in development mode
npm start         # Start the application
npm run watch     # Build in watch mode (auto-rebuild on changes)
```

#### Linting

```bash
npx eslint .      # Run ESLint
```

### Code Style

- Follow the existing code style and conventions
- Use TypeScript for all source files under `src/`
- Use vanilla JavaScript for web-facing files under `web/`
- Keep changes minimal and focused on the issue or feature

### Project Structure

```
src/               # Main process (TypeScript)
  ├── service/     # Core services (Frame, Page, Tray, etc.)
  ├── propagator/  # State propagation between main and renderer
  ├── model/       # Data models
  ├── data/        # Constants and storage
  ├── locale/      # Internationalization
  └── util/        # Utilities, modals, debug tools
web/               # Renderer process (HTML/CSS/JS)
  ├── preferences/ # Settings window
  ├── navigation-bar/
  ├── quick-menu/
  ├── screen-share/
  └── dialog/
```

### Out of Scope

To maintain the primary goal of enhancing user efficiency and focus while minimizing RAM usage, the following are intentionally out of scope:

- Multiple visible windows simultaneously
- Tab-based browsing
- Widget-like functionality
- Full web browser features

These would detract from the focused, lightweight nature of the app.

## Code of Conduct

Be respectful and constructive. We are all here to make Handbook better.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

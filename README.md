# Naavn DDBMS - Enterprise Dashboard Frontend

This project is a production-grade enterprise dashboard frontend built with React, Tailwind CSS, Redux Toolkit, and TypeScript.

## Features

- **Modular Architecture**: Feature-based structure (`features/`, `shared/`, `app/`).
- **Authentication**: Complete flow including Login, Registration, and Password Recovery.
- **State Management**: Redux Toolkit for global state and auth management.
- **Styling**: Tailwind CSS v4 with custom design tokens and enterprise-grade theming.
- **Performance**: Code-splitting via React Router lazy loading.

## Project Structure

```
src/
  app/          # App-wide configurations (store, router, layout)
  features/     # Feature-based modules (auth, dashboard, etc.)
  shared/       # Shared reusable components and utilities
    ui/         # Atomic UI components (Button, Input, Checkbox, etc.)
    icons/      # Icon wrapper
    utils/      # Helper functions
    styles/     # Global styles and tokens
  types/        # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd naavn-ddbms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Testing

To run the test suite:

```bash
npm run test
```

## Technologies

- **React 19**
- **Vite**
- **TypeScript**
- **Redux Toolkit**
- **Tailwind CSS v4**
- **Iconify**
- **React Router v6+**

## License

Private - Nigerian Army Aviation Database

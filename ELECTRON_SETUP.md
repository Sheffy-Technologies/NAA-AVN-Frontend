# Electron Setup for Windows Desktop App

This project now supports building a Windows desktop application using Electron alongside the existing Tauri setup.

## Getting Started with Electron

### Development
To run the Electron app in development mode:

```bash
npm run electron-dev
```

This will start:
- Vite dev server on `http://localhost:5173`
- Electron window connected to the dev server

### Building for Production

#### Build Windows Installer (NSIS):
```bash
npm run electron-build:win
```

#### Build Windows MSI Installer:
```bash
npm run electron-build:msi
```

#### Build All Configured Formats:
```bash
npm run electron-build
```

The built installers will be in the `dist/` directory.

## File Structure

```
electron/
├── main.js          # Main Electron process
└── preload.js       # Preload script for secure IPC
electron-builder.yml # Build configuration for Windows
```

## Configuration

### electron-builder.yml
Contains all the build settings for Windows:
- `NSIS`: Creates an installer with uninstaller
- `MSI`: Creates a Windows MSI package

### Signing & Certificates
To sign the Windows app (recommended for production):
1. Obtain a code signing certificate
2. Update `electron-builder.yml` with certificate path and password

```yaml
win:
  certificateFile: ./path/to/certificate.pfx
  certificatePassword: your-password
```

## IPC Communication

Example of communicating between Electron main process and renderer:

**In preload.js:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcMain.invoke('get-app-version'),
});
```

**In React component:**
```javascript
const version = await window.electronAPI.getAppVersion();
```

## Debugging

### Enable Dev Tools
Dev tools automatically open in development mode. You can toggle them with `F12` or `Ctrl+Shift+I`.

### Common Issues

1. **Blank Window**: Check that Vite dev server is running on `http://localhost:5173`
2. **Module not found**: Ensure all dependencies are installed with `npm install`
3. **Build fails**: Clear previous builds: `rm -rf dist/ && npm run build`

## Windows Store Deployment (Optional)

To publish to Microsoft Store:
1. Get a developer account and app listing
2. Configure Microsoft Store publishing in `electron-builder.yml`
3. Use `electron-builder` with proper credentials

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Vite Documentation](https://vitejs.dev/)

# BDent - Dental Practice Management

Professional dental practice management software by Better Clinic. Built with Tauri, React, and PostgreSQL.

## Architecture

This app supports two modes:

### Server Mode (Main Computer)
- Runs PostgreSQL database locally
- Runs FastAPI backend
- Serves as the central data store for all clients
- Typically installed on the doctor's or admin's computer

### Client Mode (Other Computers)
- Connects to the server over LAN
- No local database required
- For receptionists, nurses, and other staff

## System Requirements

### Server Computer
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space + data storage
- **Network**: Static IP recommended

### Client Computers
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: 2GB minimum
- **Storage**: 500MB free space
- **Network**: LAN connection to server

## Installation

### Prerequisites

1. **Rust** (for building): https://rustup.rs/
2. **Node.js 18+**: https://nodejs.org/
3. **PostgreSQL Portable** (bundled with server installer)

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building for Production

```bash
# Build the application
npm run tauri build
```

This creates installers in `src-tauri/target/release/bundle/`.

## Bundling Sidecars

### PostgreSQL (Server Mode Only)

1. Download PostgreSQL Portable from https://www.enterprisedb.com/download-postgresql-binaries
2. Extract to `src-tauri/sidecars/postgresql/`
3. Required binaries:
   - `bin/postgres`
   - `bin/initdb`
   - `bin/pg_ctl`
   - `lib/` (all shared libraries)
   - `share/` (timezone and locale data)

### FastAPI Backend

1. Use PyInstaller to bundle the backend:
   ```bash
   cd ../backend
   pip install pyinstaller
   pyinstaller --onefile --name backend main.py
   ```
2. Copy the executable to `src-tauri/sidecars/backend`

## Configuration

### First Run Setup

On first launch, the app shows a setup wizard:

1. **Server Mode**: Select if this is the main computer
   - PostgreSQL and backend will be initialized
   - Displays the server IP for clients to connect

2. **Client Mode**: Select for other computers
   - Enter the server IP address
   - Test connection before completing setup

### Data Storage

- **Windows**: `%APPDATA%/com.dentalclinic.app/`
- **macOS**: `~/Library/Application Support/com.dentalclinic.app/`
- **Linux**: `~/.config/com.dentalclinic.app/`

Database files are stored in `pgdata/` subdirectory.

## Firewall Configuration

### Server Computer

The following ports need to be accessible on LAN:
- **8000**: FastAPI backend
- **5432**: PostgreSQL (optional, for direct DB access)

On Windows, the app will prompt to add firewall exceptions.

## Backup

### Automatic Backup (Recommended)

Configure automatic backups in Settings > Backup:
- Daily backup to specified folder
- Keep last 7 days of backups

### Manual Backup

```bash
# On server computer, backup the database
pg_dump -U postgres dental_clinic > backup.sql
```

## Troubleshooting

### Server Won't Start

1. Check if PostgreSQL is already running on port 5432
2. Check logs in app data directory (`postgresql.log`)
3. Ensure firewall allows the application

### Client Can't Connect

1. Verify server IP address is correct
2. Check if server app is running
3. Ensure both computers are on same network
4. Check firewall on server computer

### Database Errors

1. Check PostgreSQL logs
2. Ensure sufficient disk space
3. Try restarting the application

## Development

### Project Structure

```
desktop-app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── contexts/           # React contexts
│   ├── pages/              # Page components
│   └── tauri.js            # Tauri API utilities
├── src-tauri/              # Tauri/Rust backend
│   ├── src/
│   │   ├── main.rs         # App entry point
│   │   ├── commands.rs     # Tauri commands
│   │   ├── server.rs       # Server management
│   │   └── config.rs       # Configuration
│   ├── sidecars/           # Bundled executables
│   └── tauri.conf.json     # Tauri configuration
├── package.json
└── vite.config.js
```

### Adding New Features

1. Add Tauri commands in `src-tauri/src/commands.rs`
2. Export in `src-tauri/src/main.rs`
3. Call from frontend via `invoke()` in `src/tauri.js`

## License

Proprietary - All rights reserved.

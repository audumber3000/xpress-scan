"""
PyInstaller build script for FastAPI backend.
Run this script to create a standalone executable.

Usage:
    python build_executable.py
"""

import subprocess
import sys
import os

def main():
    # Ensure PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",                          # Single executable
        "--name", "backend",                  # Output name
        "--add-data", f"templates:templates", # Include templates folder
        "--add-data", f".env:.env",           # Include .env file (optional)
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.lifespan.off",
        "--hidden-import", "sqlalchemy.dialects.postgresql",
        "--hidden-import", "psycopg2",
        "--hidden-import", "reportlab.graphics.barcode.code128",
        "--hidden-import", "reportlab.graphics.barcode.code39",
        "--hidden-import", "weasyprint",
        "--collect-all", "weasyprint",
        "--collect-submodules", "reportlab",
        "main.py"                             # Entry point
    ]
    
    print("Building backend executable...")
    print(f"Command: {' '.join(cmd)}")
    
    # Run PyInstaller
    result = subprocess.run(cmd, cwd=script_dir)
    
    if result.returncode == 0:
        print("\n✅ Build successful!")
        print(f"Executable created at: {os.path.join(script_dir, 'dist', 'backend')}")
        print("\nNext steps:")
        print("1. Copy dist/backend to desktop-app/src-tauri/sidecars/")
        print("2. Test the executable: ./dist/backend")
    else:
        print("\n❌ Build failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

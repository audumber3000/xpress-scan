#!/usr/bin/env python3
"""
Debug script to check Playwright installation and browser availability
"""
import os
import sys
import subprocess

def check_playwright_installation():
    """Check if Playwright is properly installed"""
    try:
        import playwright
        print(f"✓ Playwright version: {playwright.__version__}")
        return True
    except ImportError as e:
        print(f"✗ Playwright not installed: {e}")
        return False

def check_browser_installation():
    """Check if browsers are installed"""
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            # Check if chromium is available
            try:
                browser = p.chromium.launch(headless=True)
                browser.close()
                print("✓ Chromium browser is available and can be launched")
                return True
            except Exception as e:
                print(f"✗ Chromium browser error: {e}")
                return False
    except Exception as e:
        print(f"✗ Playwright browser check failed: {e}")
        return False

def check_system_dependencies():
    """Check if required system dependencies are available"""
    dependencies = [
        'libxss1', 'libnss3', 'libnspr4', 'libatk-bridge2.0-0',
        'libdrm2', 'libxkbcommon0', 'libxcomposite1', 'libxdamage1',
        'libxrandr2', 'libgbm1', 'libpango-1.0-0', 'libcairo2', 'libasound2'
    ]
    
    missing_deps = []
    for dep in dependencies:
        try:
            result = subprocess.run(['ldconfig', '-p'], capture_output=True, text=True)
            if dep in result.stdout:
                print(f"✓ {dep}")
            else:
                print(f"✗ {dep} - MISSING")
                missing_deps.append(dep)
        except Exception as e:
            print(f"✗ Error checking {dep}: {e}")
            missing_deps.append(dep)
    
    return len(missing_deps) == 0

def main():
    print("=== Playwright Debug Information ===")
    print()
    
    print("1. Checking Playwright installation...")
    playwright_ok = check_playwright_installation()
    print()
    
    print("2. Checking browser installation...")
    browser_ok = check_browser_installation()
    print()
    
    print("3. Checking system dependencies...")
    deps_ok = check_system_dependencies()
    print()
    
    print("=== Summary ===")
    if playwright_ok and browser_ok and deps_ok:
        print("✓ All checks passed! Playwright should work correctly.")
    else:
        print("✗ Some checks failed. Please fix the issues above.")
        if not playwright_ok:
            print("  - Install Playwright: pip install playwright")
        if not browser_ok:
            print("  - Install browsers: playwright install --with-deps chromium")
        if not deps_ok:
            print("  - Install system dependencies (see Dockerfile for reference)")

if __name__ == "__main__":
    main() 
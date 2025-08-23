# BetterClinic PWA Setup

Your BetterClinic app is now configured as a Progressive Web App (PWA) that can be installed on desktop and mobile devices.

## What's Been Added

### 1. Web App Manifest (`/public/manifest.json`)
- App name: "BetterClinic - Radiology Clinic Management"
- Short name: "BetterClinic"
- Theme color: Green (#22c55e)
- Display mode: Standalone (app-like experience)
- Icons for various sizes

### 2. Service Worker (`/public/sw.js`)
- Caches essential app resources
- Provides offline functionality
- Handles app updates

### 3. PWA Install Component (`/src/components/PWAInstall.jsx`)
- Shows install button when PWA can be installed
- Handles installation process
- Positioned at bottom-right corner

### 4. Updated HTML (`/public/index.html`)
- PWA meta tags
- Manifest link
- Icon links
- Service worker registration

## How to Test

### 1. Generate Icons
First, run the icon generator to create all required icon sizes:
```bash
cd frontend
node generate-icons.js
```

### 2. Build and Serve
```bash
npm run build
npm run preview
```

### 3. Test PWA Installation
1. Open Chrome and navigate to your app
2. Look for the install icon in the address bar (📱)
3. Click it to install the app
4. Or use the "Install App" button in the bottom-right corner

### 4. PWA Features to Test
- **Install**: Should show install prompt
- **Offline**: App should work without internet
- **App-like**: Should open in its own window
- **Icons**: Should appear on home screen/desktop

## Browser Support

- **Chrome/Edge**: Full PWA support
- **Firefox**: Good PWA support
- **Safari**: Limited PWA support (iOS 11.3+)
- **Mobile**: Works on Android Chrome, iOS Safari

## Customization

### Colors
Update the green theme color in:
- `manifest.json` (theme_color)
- `index.html` (meta theme-color)
- `browserconfig.xml` (TileColor)

### Icons
Replace the generated SVG icons with your own PNG versions:
- Convert SVG to PNG using online tools
- Ensure all sizes are available (16x16 to 512x512)
- Place in `/public/icons/` directory

### App Details
Modify `manifest.json` to change:
- App name and description
- Start URL
- Display mode
- Categories

## Troubleshooting

### Install Button Not Showing
- Ensure HTTPS is enabled (required for PWA)
- Check browser console for errors
- Verify service worker is registered

### Icons Not Loading
- Check icon paths in manifest.json
- Ensure icons exist in public/icons/
- Verify icon formats (PNG recommended)

### Service Worker Issues
- Clear browser cache
- Check browser console for errors
- Verify sw.js is accessible

## Next Steps

1. **Custom Icons**: Replace placeholder icons with your brand
2. **Offline Strategy**: Customize what gets cached
3. **Push Notifications**: Add notification support
4. **Background Sync**: Enable offline data sync

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

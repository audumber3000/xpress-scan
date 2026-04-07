// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (isLocalDev) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        console.log('Service workers unregistered for local dev');
      } catch (err) {
        console.log('Failed to unregister service workers in dev:', err);
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button or notification
  showInstallPromotion();
});

function showInstallPromotion() {
  // You can customize this to show a custom install button
  console.log('PWA install prompt available');
  
  // Example: Show a custom install button
  // const installButton = document.getElementById('install-button');
  // if (installButton) {
  //   installButton.style.display = 'block';
  // }
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  }
}

// Make installPWA available globally
window.installPWA = installPWA;


// Minimal service worker whose only job is to make the app installable ("Add to Home Screen").
//
// Deliberately NO caching and NO offline support: classroom rosters, live polls and AI tutor
// replies must always come fresh from the server — a stale cached copy could show a student or
// teacher wrong data in the middle of a live class. The fetch listener below never calls
// event.respondWith(), so every request goes to the network exactly as if no worker existed.
// If caching is ever added, keep it to truly static assets (e.g. /icons/*) and bump a version.

self.addEventListener('install', () => {
  // Activate a new version immediately instead of waiting for every open tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally empty: pass-through to the network.
});

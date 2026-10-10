// Shared by the page and the service worker. Bump APP_VERSION to refresh the offline cache.
self.APP_VERSION = '2.0.0';
self.ASSETS = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'counter.js',
  'sentences.js',
  'assets.js',
  'timings.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'audio/normal/s1.mp3', 'audio/normal/s2.mp3', 'audio/normal/s3.mp3', 'audio/normal/s4.mp3', 'audio/normal/s5.mp3', 'audio/normal/s6.mp3', 'audio/normal/s7.mp3', 'audio/normal/s8.mp3', 'audio/normal/s9.mp3', 'audio/normal/s10.mp3', 'audio/normal/s11.mp3',
  'audio/slow/s1.mp3', 'audio/slow/s2.mp3', 'audio/slow/s3.mp3', 'audio/slow/s4.mp3', 'audio/slow/s5.mp3', 'audio/slow/s6.mp3', 'audio/slow/s7.mp3', 'audio/slow/s8.mp3', 'audio/slow/s9.mp3', 'audio/slow/s10.mp3', 'audio/slow/s11.mp3',
  'audio/buildup/1-1.mp3', 'audio/buildup/1-2.mp3', 'audio/buildup/1-3.mp3', 'audio/buildup/1-4.mp3', 'audio/buildup/1-5.mp3', 'audio/buildup/1-6.mp3', 'audio/buildup/1-7.mp3', 'audio/buildup/1-8.mp3', 'audio/buildup/1-9.mp3', 'audio/buildup/1-10.mp3', 'audio/buildup/1-11.mp3',
  'audio/tutorial.mp3',
  'audio/slow-loop-1-2.mp3'
];

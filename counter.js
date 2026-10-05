/* Pater Noster Practice: anonymous visit counter.
   Only bumps a few plain numbers on https://abacus.jasoncameron.dev (a free, open counting API).
   No cookies, no IDs, no IP logging by this app, no referrer, nothing personal is sent: just "+1".
   This device remembers locally when it last counted, so reloads within 30 minutes count once.
   Opt out on this device from stats.html. */
(function () {
  'use strict';
  var NS = 'jbl-pater-noster';
  var API = 'https://abacus.jasoncameron.dev/hit/' + NS + '/';
  if (location.hostname !== 'janbaggerudlarsen.github.io') return; // never count local tests
  if (!('fetch' in window) || navigator.onLine === false) return;

  function get(k) { try { return localStorage.getItem('pn.count.' + k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem('pn.count.' + k, v); } catch (e) { /* private mode */ } }
  if (get('optout') === '1') return;

  function warsawDay(d) { // YYYYMMDD in Jan's time zone, so the daily numbers line up with his days
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(d).replace(/-/g, '');
    } catch (e) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
  }
  function hit(key) {
    return fetch(API + key, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: true })
      .catch(function () { /* offline or service down: just skip */ });
  }

  setTimeout(function () {
    var now = Date.now();
    var today = warsawDay(new Date(now));
    var last = parseInt(get('lastOpen') || '0', 10);
    var keys = [];
    if (!get('seen')) { keys.push('devices'); set('seen', '1'); }          // first time on this device
    if (get('lastDay') !== today) { keys.push('v-' + today); set('lastDay', today); } // visitor today
    if (!last || now - last > 30 * 60 * 1000) { keys.push('opens', 'd-' + today); } // an app open
    set('lastOpen', String(now));
    keys.forEach(hit);
  }, 1500);
})();

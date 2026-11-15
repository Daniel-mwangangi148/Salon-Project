(()=>{'use strict';
// Shared persistence boundary for the public catalogue, bookings and owner tools.
// Keep the existing key and document shape so current browser data is preserved.
const KEY='hairBySara.v1';
window.HairBySaraDataStore={
 load(fallback){try{return JSON.parse(localStorage.getItem(KEY))||fallback}catch{return fallback}},
 save(value){localStorage.setItem(KEY,JSON.stringify(value))},
 key:KEY
};
})();

// DIDI Service Worker v9 — 30-min offline notifications
const CACHE = "didi-v9";
const ASSETS = ["./index.html","./manifest.json","./icon.svg","./icon-192.png","./icon-512.png"];

const MSGS = [
  {t:"🔥 DIDI — Stay on track!",         b:"30 minutes gone. Have you ticked your habits yet?"},
  {t:"⚡ DIDI — Half hour check",         b:"Discipline is doing it even when you don't feel like it."},
  {t:"💪 DIDI — Habit reminder",          b:"Every 30 minutes is a chance to make progress. What are you doing?"},
  {t:"🎯 DIDI — Focus check",             b:"Your goals are waiting. Tick your habits and keep moving."},
  {t:"🌟 DIDI — Stay disciplined",        b:"Champions don't take breaks from discipline. Check your habits."},
  {t:"⏱ DIDI — 30 minutes passed",       b:"Small consistent actions build massive results. Stay consistent."},
  {t:"🔔 DIDI — Reminder",               b:"Your future self is watching. Make them proud right now."},
  {t:"◆ DIDI — Habit check",             b:"Momentum is built in 30-minute blocks. Don't lose yours."},
  {t:"🚀 DIDI — Keep going",             b:"You didn't start to quit. Open DIDI and tick your habits."},
  {t:"💎 DIDI — Consistency wins",        b:"It's been 30 minutes. Discipline today means freedom tomorrow."},
  {t:"🌅 DIDI — Morning push",           b:"The day is still young. Lock in your habits before it slips away."},
  {t:"🌙 DIDI — Evening reminder",       b:"How many habits have you completed today? Check in with DIDI."},
];

function getRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function fireNotification(){
  const msg = getRandom(MSGS);
  return self.registration.showNotification(msg.t, {
    body: msg.b,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    vibrate: [200,100,200,100,200],
    tag: "didi-30min",
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: { url: "./index.html" }
  });
}

// ── Install ─────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ────────────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Start the 30-minute alarm loop as soon as SW activates
        startAlarmLoop();
      })
  );
});

// ── Fetch (offline cache) ────────────────────────────────────────
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  if(!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached){
        fetch(e.request).then(res => {
          if(res && res.status === 200)
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }).catch(()=>{});
        return cached;
      }
      return fetch(e.request).then(res => {
        if(res && res.status === 200 && res.type !== "opaque")
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// ── 30-minute alarm loop ─────────────────────────────────────────
// Strategy: use setTimeout chained recursively to fire every 30 min.
// SW is kept alive by Notification API permission + the chained promise chain.
// Additionally, we register a periodicsync for browsers that support it.
let alarmLoopRunning = false;
const THIRTY_MIN = 30 * 60 * 1000;

function startAlarmLoop(){
  if(alarmLoopRunning) return;
  alarmLoopRunning = true;
  scheduleNext();
}

function scheduleNext(){
  // Wait 30 minutes then fire a notification and schedule again
  setTimeout(async () => {
    try {
      await fireNotification();
    } catch(e){}
    // Schedule next one immediately after
    scheduleNext();
  }, THIRTY_MIN);
}

// ── Messages from the app (page) ─────────────────────────────────
self.addEventListener("message", e => {
  if(!e.data) return;

  if(e.data.type === "START_ALARM"){
    startAlarmLoop();
  }

  if(e.data.type === "FIRE_NOTIF"){
    // Immediate one-off notification (for motivation toasts)
    const msgs = [
      {t:"🔥 DIDI", b:"Discipline today. Freedom tomorrow."},
      {t:"⚡ DIDI", b:"Stay on track. Your goals need you."},
      {t:"💪 DIDI", b:"One habit at a time. Keep going."},
    ];
    const m = getRandom(msgs);
    self.registration.showNotification(m.t, {
      body: e.data.body || m.b,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [200,100,200,100,200],
      tag: "didi-motiv-" + Date.now(),
      renotify: true,
      requireInteraction: false
    });
  }

  if(e.data.type === "SCHEDULE_NOTIFS"){
    startAlarmLoop();
  }
});

// ── Push from server ─────────────────────────────────────────────
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : {title:"DIDI",body:"Check your habits!"};
  e.waitUntil(
    self.registration.showNotification(data.title || "DIDI", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [200,100,200,100,200],
      tag: "didi-push",
      renotify: true
    })
  );
});

// ── Periodic background sync ─────────────────────────────────────
// Fires even when app is completely closed, on supported devices (Chrome Android)
self.addEventListener("periodicsync", e => {
  if(e.tag === "didi-30min-notif"){
    e.waitUntil(fireNotification());
  }
});

// ── Notification click ───────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then(cls => {
      for(const c of cls){
        if(c.url.includes("index.html") && "focus" in c) return c.focus();
      }
      return clients.openWindow("./index.html");
    })
  );
});

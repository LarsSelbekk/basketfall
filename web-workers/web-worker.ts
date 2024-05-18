const images = {
  player: "img/player.png",
  hoop: "img/hoop.png",
  ball: "img/ball.png",
  basket: "img/basket.png",
  touchZones: "img/bg_title_touch_zones_small.jpg",
  deathVideo: "video/trynings_bak.mp4",
};

const bgImages: string[] = [
  "img/bg_dovre_small.jpg",
  "img/bg_dovre2_small.jpg",
  "img/bg_galdhopiggen_small.jpg",
  "img/bg_oy_small.jpg",
  "img/bg_rosa_small.jpg",
  "img/bg_skog_small.jpg",
  "img/bg_strand_small.jpg",
];

// TODO: make hostable
// const pathRoot = self.location.pathname.slice(0, self.location.pathname.lastIndexOf("/"));
const pathRoot = "";

const cacheName = "v1";

const addResourcesToCache = async (resources: string[]) => {
  console.log(`Caching ${resources.join("\n")}`);
  const cache = await caches.open(cacheName);
  await cache.addAll(resources.map(resource => `${pathRoot}/${resource}`));
};

self.addEventListener("install", (event) => {
  console.log("Installing...");
  console.log("pathRoot: ", pathRoot);
  (
    event as ExtendableEvent
  ).waitUntil(
    addResourcesToCache([
      ...staticAssetUrls,
      ...bgImages,
      ...Object.values(images),
    ]),
  );
});

self.addEventListener('fetch', async (event) => {
  const fetchEvent = event as FetchEvent;
  const retrieve = async () => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(fetchEvent.request);
    if (cachedResponse) {
      // TODO: refresh at some point; now we can't update code :cowboy:
      return cachedResponse;
    }
    return await fetch(fetchEvent.request);
  }
  fetchEvent.respondWith(retrieve());
});

const staticAssetUrls = [
  "",
  "index.html",
  "css/stylesheet.css",
  "script/main.js",
  "web-worker.js",

  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "apple-touch-icon.png",
  "browserconfig.xml",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "manifest.webmanifest",
  "mstile-150x150.png",
  "safari-pinned-tab.svg",
];

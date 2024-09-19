refresh().then();

// TODO: make hostable
// const pathRoot = self.location.pathname.slice(0, self.location.pathname.lastIndexOf("/"));
const pathRoot = "";
const cacheName = "v1";

self.addEventListener("install", (event) => {
  console.log("Installing...");
  console.log("pathRoot: ", pathRoot);
  (
    event as ExtendableEvent
  ).waitUntil(refresh());
});

self.addEventListener("message", (ev: MessageEvent) => {
  if (ev.data === "refresh") {
    refresh().then();
  }
});

self.addEventListener('fetch', async (event) => {

  const fetchEvent = event as FetchEvent;

  const retrieve = async () => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(fetchEvent.request);

    if (cachedResponse) {
      return cachedResponse;
    }
    console.error(`Cache miss: ${fetchEvent.request.url}`);

    return await refetch(cache, fetchEvent);
  };
  fetchEvent.respondWith(retrieve().catch((cause) => {
    throw new Error("Failed to retrieve " + fetchEvent.request.url, { cause });
  }));
});

async function refetch(cache: Cache, fetchEvent: FetchEvent): Promise<Response> {
  const response = await fetch(fetchEvent.request);
  await cache.put(fetchEvent.request, response);
  return response;
}

async function refresh() {
  console.log("Fetching hashes");
  await fetch(`${pathRoot}/hashes.json`).then(async res => await handleRefresh(await res.json()));
}

type Hashes = {
  name: string,
  hash: string,
  children?: Hashes[],
};

async function handleRefresh(hashes: Hashes) {
  const hashCache = await caches.open("hashcache");
  const oldHashes: Hashes | undefined = await (
    await hashCache.match(`${pathRoot}/hashes.json`)
  )?.json();
  const toRefetch: string[] = [];

  function markChanged(node: Hashes, oldNode?: Hashes, prefix: string = ""): void {
    const path = prefix + node.name;
    if (node.hash !== oldNode?.hash) {
      if (!node.children || node.children.length === 0) {
        toRefetch.push(path);
        console.log(`Refetching ${path}`);
      } else {
        for (const child of node.children) {
          markChanged(
            child,
            oldNode?.children?.find(c => c.name === child.name),
            path + "/",
          );
        }
      }
    }
  }

  markChanged(hashes, oldHashes, pathRoot);

  const cache = await caches.open(cacheName);
  await cache.addAll(toRefetch);
  await hashCache.put(`${pathRoot}/hashes.json`, new Response(JSON.stringify(hashes)));
}

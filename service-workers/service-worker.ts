const pathRoot = self.location.pathname.slice(0, self.location.pathname.lastIndexOf("/"));
const cacheName = "v1";

refresh().then();

self.addEventListener("install", (event) => {
  console.log("Installing...");
  console.log("pathRoot:", pathRoot);
  (
    event as ExtendableEvent
  ).waitUntil(refresh());
});

self.addEventListener("message", (ev: MessageEvent) => {
  if (ev.data === "refresh") {
    refresh().then();
  }
});

function normalizeRequest(request: Request): Request {
  return new Request(request, {
    headers: {
      ...request.headers,
      range: undefined,
    },
  });
}

self.addEventListener('fetch', async (event) => {

  const fetchEvent = event as FetchEvent;
  const normalizedRequest = normalizeRequest(fetchEvent.request);

  const retrieve = async () => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(normalizedRequest);

    if (cachedResponse) {
      return cachedResponse;
    }
    console.error(`Cache miss: ${normalizedRequest.url}`);

    return await refetch(cache, fetchEvent);
  };
  fetchEvent.respondWith(retrieve().catch((cause) => {
    throw new Error("Failed to retrieve " + normalizedRequest.url, { cause });
  }));
});

async function refetch(cache: Cache, fetchEvent: FetchEvent): Promise<Response> {
  const normalizedRequest = normalizeRequest(fetchEvent.request);
  const response = await fetch(normalizedRequest);
  await cache.put(normalizedRequest, response);
  return response;
}

var refreshLock = Promise.resolve();

async function refresh() {
  await refreshLock;
  let releaseLock;
  refreshLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  console.log("Fetching hashes");
  await fetch(`${pathRoot}/hashes.json`)
    .then(async res => await handleRefresh(await res.json()))
    .catch(() => console.warn("Failed to fetch hashes; operating in offline-mode"));

  releaseLock!();
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
    let path = stripIndexHtml(node.name === "." ? prefix : `${prefix}/${node.name}`);

    if (node.hash !== oldNode?.hash) {
      if (!node.children || node.children.length === 0) {
        toRefetch.push(path);
        console.log(`Refetching ${path}`);
      } else {
        for (const child of node.children) {
          markChanged(
            child,
            oldNode?.children?.find(c => c.name === child.name),
            path,
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

function stripIndexHtml(path: string): string {
  if (path.endsWith("/index.html")) {
    return path.substring(0, path.lastIndexOf("/") + 1);
  }

  return path;
}
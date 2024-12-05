import { hashElement, HashElementNode, HashElementOptions } from "folder-hash";
import { writeFile } from "node:fs/promises";

const options: HashElementOptions = {
  folders: { exclude: ['.*', 'node_modules', 'psd', 'build-tools'] },
  files: {
    include: [
      '*.js',
      '*.html',
      '*.css',
      '*.mp4',
      '*.png',
      '*.jpg',
      '*.jpeg',
      'browserconfig.xml',
      'manifest.webmanifest',
      '*.ico',
      '*.svg',
    ],
  },
};

const hashes = withoutEmptyFolders(await hashElement('.', options))!;
const serialized: Record<string, string> = {};

function toAbsolutePath(node: HashElementNode, prefix: string = ""): void {
  const path = prefix + node.name;
  serialized[path] = node.hash;
  node.children?.forEach(child => toAbsolutePath(child, path + "/"));
}

toAbsolutePath(hashes);

function withoutEmptyFolders(input: HashElementNode): HashElementNode | null {
  if ((
    input.children?.length ?? 0
  ) === 0 && !input.name.includes(".")) {
    return null;
  }
  return {
    ...input, ...(
      input.children && {
        children: input.children.map(withoutEmptyFolders)
          .filter(node => node !== null),
      }
    ),
  };
}

await writeFile(
  "hashes.json",
  JSON.stringify(hashes, undefined, 2),
  { encoding: "utf-8" },
);

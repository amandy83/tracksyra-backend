const fs = require("node:fs");
const path = require("node:path");

const outputRoot = path.resolve("dist");

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.isFile() && fullPath.endsWith(".js")) rewrite(fullPath);
  }
}

function rewrite(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let updated = original.replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (match, prefix, specifier, suffix) => {
    if (/\.[a-z0-9]+$/i.test(specifier)) return match;
    const target = path.resolve(path.dirname(filePath), specifier);
    const resolved = fs.existsSync(`${target}.js`) ? `${specifier}.js` : `${specifier}/index.js`;
    return `${prefix}${resolved}${suffix}`;
  });
  updated = updated.replace(
    'return entry.replace(/\\\\/g, "/").endsWith("server/src/bootstrap/startServer.ts");',
    'return entry.replace(/\\\\/g, "/").endsWith("server/src/bootstrap/startServer.ts") || entry.replace(/\\\\/g, "/").endsWith("dist/server/src/bootstrap/startServer.js");',
  );
  updated = updated.replace(
    'return entry.replace(/\\\\/g, "/").endsWith("server/src/workers/bootstrap/startWorkers.ts");',
    'return entry.replace(/\\\\/g, "/").endsWith("server/src/workers/bootstrap/startWorkers.ts") || entry.replace(/\\\\/g, "/").endsWith("dist/server/src/workers/bootstrap/startWorkers.js");',
  );
  if (updated !== original) fs.writeFileSync(filePath, updated);
}

visit(outputRoot);

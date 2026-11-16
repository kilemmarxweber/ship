import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/kilemmarxweber/Desktop/ShipShop";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "android", "ios", "scripts"].includes(name))
      continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file, out);
    else if (file.endsWith(".tsx")) out.push(file);
  }
  return out;
}

for (const file of walk(root)) {
  const src = fs.readFileSync(file, "utf8");
  const next = src.replace(/\n[ \t]*\n([ \t]*minWidth: 44,)/g, "\n$1");
  if (next !== src) fs.writeFileSync(file, next);
}

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
  let src = fs.readFileSync(file, "utf8");
  const next = src.replace(
    /(\n[ \t]*)back:\s*\{([^{}]*)\}/g,
    (full, indent, body) => {
      if (body.includes("minHeight")) return full;
      if (!body.includes("alignItems") && !body.includes("flexDirection")) {
        return full;
      }
      const pad = indent.replace("\n", "") + "  ";
      return `${indent}back: {${body}\n${pad}minWidth: 44,\n${pad}minHeight: 44,\n${indent}}`;
    },
  );
  if (next !== src) {
    fs.writeFileSync(file, next);
    console.log(path.relative(root, file));
  }
}

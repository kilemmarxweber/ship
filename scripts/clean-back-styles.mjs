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

const changed = [];
for (const file of walk(root)) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  if (!src.includes("styles.backText")) {
    src = src.replace(/\n[ \t]*backText:\s*\{[^{}]*\},?/g, "");
  }
  if (file.endsWith("TicketScreen.tsx") && !src.includes("styles.link")) {
    src = src.replace(/\n[ \t]*link:\s*\{[^{}]*\},?/g, "");
  }
  src = src.replace(/<Pressable\b[\s\S]*?<\/Pressable>/g, (block) => {
    if (!block.includes('name="chevron-back"')) return block;
    if (block.includes("accessibilityLabel")) return block;
    return block.replace(
      "<Pressable",
      '<Pressable accessibilityLabel="Retour"',
    );
  });
  if (src !== before) {
    fs.writeFileSync(file, src);
    changed.push(path.relative(root, file));
  }
  if (src.includes("const t = useT(") && !/\bt\(/.test(src)) {
    console.log("UNUSED_T", path.relative(root, file));
  }
}
console.log(changed.join("\n"));
console.log("COUNT", changed.length);

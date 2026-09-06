import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Expand explicitly: Node 20 on Windows does not expand shell globs.
const root = fileURLToPath(new URL("../", import.meta.url));
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mjs"))
  .sort()
  .map(name => "tests/" + name);
if (!files.length) throw new Error("No unit tests found");
const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root, stdio: "inherit"
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

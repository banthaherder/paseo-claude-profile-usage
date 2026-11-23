import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// server/claude-usage-source is an unmodified copy of Paseo's built-in Claude usage source.
// Paseo won't bundle imports from outside the plugin folder, so it's copied instead.
const FILES = ["server/usage.ts", "server/stores.ts", "shared/input.ts"];

/**
 * Finds the installed Paseo's built-in claude-usage-source by walking up from the plugin
 * runtime script (in the macOS app it lives in Contents/Resources/builtin-plugins).
 */
export function findBuiltinSource(): string | null {
  let dir = process.argv[1] ? dirname(process.argv[1]) : "";
  while (dir && dir !== dirname(dir)) {
    for (const parent of ["builtin-plugins", "plugins"]) {
      const candidate = join(dir, parent, "claude-usage-source");
      if (existsSync(join(candidate, FILES[0]))) return candidate;
    }
    dir = dirname(dir);
  }
  return null;
}

/** Names the copied files that differ from the installed Paseo's built-in source. */
export function changedBuiltinFiles(pluginDir: string, builtinDir: string): string[] {
  return FILES.filter((file) => {
    try {
      const ours = readFileSync(join(pluginDir, "server/claude-usage-source", file), "utf8");
      return ours !== readFileSync(join(builtinDir, file), "utf8");
    } catch {
      return true;
    }
  });
}

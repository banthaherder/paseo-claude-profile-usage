import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** A Paseo provider that runs Claude Code with its own CLAUDE_CONFIG_DIR. */
export interface ClaudeProfile {
  providerId: string;
  label: string;
  configDir: string;
  /** The provider's env from config.json, merged along its `extends` chain. */
  env: Record<string, string>;
}

interface ProviderConfig {
  extends?: string;
  enabled?: boolean;
  label?: string;
  env?: Record<string, string>;
}

const BUILTIN_CLAUDE = "claude";

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

/** The daemon's config.json (provider definitions and plugin paths). */
export function readPaseoConfig(): any {
  const paseoHome = expandHome(process.env.PASEO_HOME || join(homedir(), ".paseo"));
  return JSON.parse(readFileSync(join(paseoHome, "config.json"), "utf8"));
}

/**
 * Returns every enabled provider based on the built-in `claude` provider whose env sets
 * CLAUDE_CONFIG_DIR, one per config directory. Providers without CLAUDE_CONFIG_DIR use the
 * default ~/.claude login, which Paseo's own Claude card covers.
 */
export function readClaudeProfiles(config: any): ClaudeProfile[] {
  const providers: Record<string, ProviderConfig> = config?.agents?.providers ?? {};

  // Walk `extends` to the root provider, merging env so a child's values win.
  function resolve(id: string): { root: string; env: Record<string, string> } {
    const chain: ProviderConfig[] = [];
    let current: string | undefined = id;
    let root = id;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      root = current;
      const provider: ProviderConfig | undefined = providers[current];
      if (!provider) break;
      chain.unshift(provider);
      current = provider.extends;
    }
    return { root, env: Object.assign({}, ...chain.map((p) => p.env ?? {})) };
  }

  const profiles: ClaudeProfile[] = [];
  const seenDirs = new Set<string>();
  for (const [providerId, provider] of Object.entries(providers)) {
    if (provider.enabled === false) continue;
    const { root, env } = resolve(providerId);
    if (root !== BUILTIN_CLAUDE || !env.CLAUDE_CONFIG_DIR) continue;
    const configDir = expandHome(env.CLAUDE_CONFIG_DIR);
    if (seenDirs.has(configDir)) continue;
    seenDirs.add(configDir);
    profiles.push({
      providerId,
      label: provider.label ?? providerId,
      configDir,
      env: { ...env, CLAUDE_CONFIG_DIR: configDir },
    });
  }
  return profiles;
}

export function tildify(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/** The local folder this plugin was installed from, if it is a directory install. */
export function findOwnDirectory(config: any, manifestId: string): string | null {
  for (const entry of Object.values<any>(config?.plugins ?? {})) {
    const path = typeof entry?.path === "string" ? expandHome(entry.path) : null;
    if (!path || !existsSync(join(path, "paseo-plugin.json"))) continue;
    try {
      if (JSON.parse(readFileSync(join(path, "paseo-plugin.json"), "utf8")).id === manifestId)
        return path;
    } catch {
      // Not ours.
    }
  }
  return null;
}

import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  hashAccountKey,
  type UsageAccount,
  type UsageReport,
  type UsageScope,
} from "@getpaseo/plugin/server/usage";
import {
  claudeKeychainAccount,
  discover,
  fetchUsage,
  resolveClaudeCredentials,
} from "./server/claude-usage-source/server/usage";
import { inputSchema, type UsageInput } from "./server/claude-usage-source/shared/input";
import { changedBuiltinFiles, findBuiltinSource } from "./server/drift";
import {
  type ClaudeProfile,
  findOwnDirectory,
  readClaudeProfiles,
  readPaseoConfig,
  tildify,
} from "./server/profiles";

const PLUGIN_ID = "claude-profile-usage";

// Paseo's own Claude card reads the daemon's environment, which has no CLAUDE_CONFIG_DIR, so it
// only sees the default ~/.claude login. This plugin adds one card per Claude provider that sets
// its own CLAUDE_CONFIG_DIR, reusing the built-in source's discovery and usage parsing.

/**
 * Where Claude Code keeps a config directory's login: a Keychain item on macOS (named as in
 * the built-in source), otherwise .credentials.json in the directory.
 */
function loginInput(profile: ClaudeProfile): UsageInput {
  if (process.platform !== "darwin")
    return { route: { store: "claude", path: join(profile.configDir, ".credentials.json") } };
  const suffix = hashAccountKey(profile.configDir.normalize("NFC")).slice(0, 8);
  return {
    route: {
      store: "keychain",
      service: `Claude Code-credentials-${suffix}`,
      account: claudeKeychainAccount(profile.env.USER ?? process.env.USER),
    },
  };
}

async function discoverProfile(profile: ClaudeProfile, scope: UsageScope): Promise<UsageAccount[]> {
  // Agent popovers use the built-in source, which already follows the agent's own env.
  if (scope.kind !== "global") return [];
  const env = { ...process.env, ...profile.env } as Record<string, string>;
  // A session scope makes the built-in discovery look up only this directory's login.
  const accounts = (await discover({ kind: "session", provider: "claude", env })).filter(
    (account) => {
      const input = inputSchema.safeParse(account.input);
      return input.success && ["keychain", "claude"].includes(input.data.route.store);
    },
  );
  if (accounts.length)
    return accounts.map((account) => ({
      ...account,
      label: account.label ?? tildify(profile.configDir),
    }));
  // No usable login (missing, or blanked after a failed refresh). Keep a card so it shows.
  return [
    {
      key: hashAccountKey(`signed-out:${profile.configDir}`),
      label: tildify(profile.configDir),
      harness: "Claude",
      input: loginInput(profile),
    },
  ];
}

async function fetchProfile(profile: ClaudeProfile, value: unknown): Promise<UsageReport> {
  const input = inputSchema.parse(value);
  if (!(await resolveClaudeCredentials(input))) {
    const dir = tildify(profile.configDir);
    return {
      status: "error",
      error: `Signed out: ${dir} has no Claude login. Run CLAUDE_CONFIG_DIR=${dir} claude and use /login.`,
    };
  }
  return fetchUsage(input);
}

export default function contribute(server: PluginServerContext) {
  let profiles: ClaudeProfile[] = [];
  try {
    const config = readPaseoConfig();
    profiles = readClaudeProfiles(config);
    // Only a local directory install can be re-synced; Git installs update from the repo.
    const pluginDir = findOwnDirectory(config, PLUGIN_ID);
    const builtinDir = findBuiltinSource();
    const changed = pluginDir && builtinDir ? changedBuiltinFiles(pluginDir, builtinDir) : [];
    if (changed.length)
      console.warn(
        `Paseo's built-in Claude usage source changed (${changed.join(", ")}). In ${pluginDir}, run ` +
          `\`PASEO_BUILTIN="${builtinDir}" npm run sync-builtin\`, then reload the plugin.`,
      );
  } catch (error) {
    console.error("Could not read Claude providers from config.json", error);
  }
  for (const profile of profiles) {
    server.registerUsageSource({
      id: `profile-${profile.providerId}`,
      label: profile.label,
      icon: "icon.svg",
      providers: [profile.providerId],
      input: inputSchema,
      discover: (scope) => discoverProfile(profile, scope),
      fetch: (value) => fetchProfile(profile, value),
    });
  }
  console.log(
    `Registered ${profiles.length} Claude profile(s): ${profiles
      .map((p) => `${p.label} -> ${tildify(p.configDir)}`)
      .join(", ")}`,
  );
  return () => {};
}

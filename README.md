# Claude profile usage for Paseo

A Paseo plugin that shows Claude plan usage in the Usage panel for each Claude provider configured with its own `CLAUDE_CONFIG_DIR`.

## Why

If you use multiple Claude accounts in Paseo, you typically configure providers that extend `claude` with separate config directories:

```json
{
  "agents": {
    "providers": {
      "claude": {
        "label": "Claude (Personal)",
        "env": { "CLAUDE_CONFIG_DIR": "/Users/you/.claude-personal" }
      },
      "claude-work": {
        "extends": "claude",
        "label": "Claude (Work)",
        "env": { "CLAUDE_CONFIG_DIR": "/Users/you/.claude-work" }
      }
    }
  }
}
```

Paseo's built-in Claude card reads the daemon's environment, which has no `CLAUDE_CONFIG_DIR`. As a result, it only sees the default `~/.claude` login (which may be stale or missing) and none of the accounts your agents actually use.

## What it does

- Adds one usage card per provider, titled with the provider's label, showing session and weekly limits, plan, and account email.
- Discovers enabled providers based on `claude` (directly or via `extends`) that set `CLAUDE_CONFIG_DIR` in their `env`. Disabled providers and providers without `CLAUDE_CONFIG_DIR` are skipped.
- Shows a signed-out card with the login command when a directory has no usable credentials.
- Only reads credentials and never refreshes or writes tokens, so a card stays current only while agents use that provider.
- Leaves agent usage popovers unchanged, as the built-in source already follows each agent's environment there.

## Install

```sh
paseo plugin install github:banthaherder/paseo-claude-profile-usage
```

Open the Usage panel's Sources list and hide the built-in "Claude" card if it only shows a stale login. After adding or renaming a provider, run `paseo plugin reload claude-profile-usage`.

Requires Paseo 0.17.3 or later. Tested on macOS, where Claude Code stores each config directory's login in the Keychain. On other platforms, it reads `.credentials.json` from the config directory (untested).

## How it works

Paseo does not bundle code from outside a plugin's folder, so `server/claude-usage-source/` is an unmodified copy of Paseo's built-in Claude usage source. The plugin runs that source's discovery once per provider with the provider's environment and uses its usage API parsing for the cards.

When installed from a local checkout, the plugin log warns if your installed Paseo's copy of that source differs from this one. To update the copy, run `npm run sync-builtin` (set `PASEO_BUILTIN` if Paseo is not at `/Applications/Paseo.app`), then run `npm run typecheck` and `paseo plugin reload claude-profile-usage`.

## License

MIT for this plugin's code. `server/claude-usage-source/` comes from [Paseo](https://github.com/getpaseo/paseo) and is licensed under Apache-2.0; see its `LICENSE`.

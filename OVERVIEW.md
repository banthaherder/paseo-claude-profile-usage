# Claude profile usage

Adds a plan usage card to the Usage panel for each Claude provider that runs Claude Code with its own `CLAUDE_CONFIG_DIR` (for example, one provider per account).

Paseo's built-in Claude card reads the daemon's environment, so it only sees the default `~/.claude` login. This plugin reads providers from the daemon's `config.json`, selects each one based on `claude` (directly or via `extends`) whose env sets `CLAUDE_CONFIG_DIR`, and displays that directory's login under the provider's label. A directory without a usable login shows a signed-out card instead of disappearing. You can hide the built-in Claude card in the panel's Sources list.

For each directory, the plugin reads Claude Code's login (the macOS Keychain item, or `.credentials.json` elsewhere) and calls Anthropic's OAuth usage and profile endpoints, matching the built-in card. It never refreshes or writes a login; agents using that provider keep the token fresh. Agent usage popovers are unchanged.

Requires Paseo 0.17.3 or later. Tested on macOS. Adding or renaming providers requires a plugin reload.

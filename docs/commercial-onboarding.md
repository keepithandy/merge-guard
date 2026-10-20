# Phase 5A — Customer onboarding and licensing diagnostics

Use `merge-guard onboard` (or `merge-guard onboard --json`) to check whether the selected Polar environment, organization, benefits, gateway, customer portal, and local activation are configured. This is **read-only, offline and redacted**; it does not contact Polar or infer that a stored license is granted.

Use `Get-Clipboard -Raw | node src/cli.js activate --stdin` after copying your key from the customer portal. Clear your clipboard afterward. `merge-guard license` forces a live entitlement check, while `merge-guard account` only prints an explicitly configured HTTPS customer portal URL that contains no credentials, query or fragment.

An absent gateway/portal is a setup limitation, not a reason to block the Free scanner. A saved key is not evidence of paid access. Polar Sandbox and production remain separate. Production checkout is **not** enabled. Team benefit is not yet customer-ready; no hosted customer onboarding was executed.

# Contributing to D-Link for Homey

Thanks for helping improve this community-maintained Homey app.

## Bug reports and device requests

Open an issue at https://github.com/JohanBendz/com.dlink/issues after checking whether the problem has already been reported.

Include the device model, hardware/firmware version if known, Homey model and firmware, expected versus actual behavior, reproducible steps, and relevant diagnostic logs. Do not include passwords, PINs or other credentials in publicly shared logs.

## Pull requests

The active development baseline uses Homey Apps SDK v3. Target the appropriate maintained branch:

- `SDK3` for changes to the stable SDK v3 baseline
- `Test` for a fix specifically required by the pending Test release
- the relevant `release/*` branch for version-specific development

Keep each PR focused, describe how it was verified, and explain any device-specific assumptions. If a change requires hardware you cannot test, call that out and ask for community verification.

Install dependencies with `npm ci`. Change `.homeycompose/` and `driver.compose.json` files rather than generated `app.json`; run `homey app validate --level publish` before proposing a release.

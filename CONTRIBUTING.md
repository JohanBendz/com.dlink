# Contributing to D-Link for Homey

Thanks for helping maintain and test this community-supported Homey app.

## Before opening an issue

Please search the existing [issues](https://github.com/JohanBendz/com.dlink/issues) and choose the matching template:

- **Hardware validation:** Tested a real device, especially DSP-W215 or DCH-S220. Pass/fail data, firmware versions and sanitized logs are especially useful.
- **Bug report:** Reproducible failure in an already-supported model.
- **Device request:** A new model or unsupported revision. Requests are welcome as reference material, but do not guarantee that support will be implemented.

Include the device's **model, hardware revision, firmware, Homey model/OS, steps to reproduce, and observed versus expected behavior** when known. Use "unknown" for details you cannot determine; do not invent values.

**Never share credentials, PINs, secret tokens, public IP addresses or unredacted home-network identifiers.** Mask sensitive fields in logs and HNAP captures. For sensitive reports, see [SECURITY.md](SECURITY.md).

## Pull requests

- Target **`main`** for new work. The maintainer coordinates promotion to `Test`, `release/*` and the preserved `SDK3` baseline.
- Keep changes focused; link a relevant issue and explain what was tested.
- Report uncertainty about hardware/firmware behavior and include real-device results when available.
- Preserve Homey App SDK v3 compatibility and behavior of existing paired devices.
- When changing Homey Compose, edit `.homeycompose/` or `driver.compose.json` first, then regenerate and verify tracked `app.json`. Do not remove `app.json`.
- Avoid unrelated dependency updates, device renaming, capability removal, or changes to established polling/reporting without test evidence.

### Local checks

```sh
npm ci
npm test
homey app validate --level publish
```

Include the outcome (or explain which checks you could not run) in your PR. The maintainer decides which contributions to merge and when releases are published.

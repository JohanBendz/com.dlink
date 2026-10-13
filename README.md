# D-Link for Homey

Community-maintained support for compatible D-Link Z-Wave and local Wi-Fi devices on **Homey Apps SDK v3**.

## Supported devices

| Model | Connection | Device | Features |
| --- | --- | --- | --- |
| DCH-Z110 | Z-Wave | Door/window sensor | Contact, tamper and low-battery alarms, battery level, light and temperature |
| DCH-Z120 | Z-Wave | Motion sensor | Motion, tamper and low-battery alarms, battery level, light and temperature |
| DCH-Z122 | Z-Wave | Motion sensor | Motion, tamper and low-battery alarms, battery level |
| DCH-Z310 | Z-Wave | Smoke detector | Smoke alarm and battery level |
| DCH-Z510 | Z-Wave | Multisound siren | On/off, tamper alarm and siren Flow actions |
| DSP-W215 | Wi-Fi / LAN | Smart plug | On/off, power measurement and internal plug temperature |
| DCH-S220 | Wi-Fi / LAN | Siren | On/off status, six sound types, adjustable volume and duration, Flow actions |

Individual functions and reported values depend on the device's firmware, hardware revision and network conditions.

### Local Wi-Fi devices

**DSP-W215** supports local HNAP discovery, manual IP addressing when needed, device PIN authentication, on/off switching and power/temperature polling. See [DSP-W215 testing and troubleshooting](docs/DSP-W215_TESTING.md).

**DCH-S220** supports local HNAP discovery or manual IP addressing, device PIN authentication, sounding status, six selectable tones, configurable volume (1–100) and duration (1–300 seconds), plus Flow actions to play a selected sound or stop the siren. See [DCH-S220 testing and troubleshooting](docs/DCH-S220_TESTING.md).

Both Wi-Fi integrations are new and **still need verification across real hardware revisions and firmware versions**. We especially welcome tests on physical **DSP-W215** and **DCH-S220** units. Please use the [Hardware validation report](https://github.com/JohanBendz/com.dlink/issues/new/choose) and follow [DSP-W215 testing](docs/DSP-W215_TESTING.md) or [DCH-S220 testing](docs/DCH-S220_TESTING.md).

Pairing diagnostics were added in 0.3.0: record whether mDNS discovery finds a device, whether manual-IP identification works, PIN-authentication success/failure, and the firmware revision (without sharing the PIN). **Do not rely on the experimental DCH-S220 integration for emergency or life-safety alerting.**

### DCH-Z510 Flow actions

The Z-Wave DCH-Z510 provides siren on/off, sound selection, and alarm enable/disable Flow actions.

## Getting started

Install **D-Link** from the [Homey App Store](https://homey.app/a/com.dlink/). Add your Z-Wave devices using Homey's regular inclusion procedure. For DSP-W215 and DCH-S220, keep Homey and your device on the same local network, follow the pairing instructions, and use the six-digit device PIN from its label or setup card. If discovery does not find the Wi-Fi device, use its IP address.

For support, device requests or bug reports, visit [GitHub Issues](https://github.com/JohanBendz/com.dlink/issues). Include the model, hardware/firmware revision, Homey model and OS version, steps to reproduce, and a diagnostic report ID if relevant. Never post the device PIN, credentials or other secrets.

## Development and branches

- `main`: current community development and documentation; the 0.3.0 starting point is **not proof of physical Wi-Fi hardware compatibility**.
- `SDK3`: preserved SDK v3 stable baseline (0.2.x), maintained separately from new Wi-Fi development.
- `Test`: source for the Homey App Store Test channel.
- `release/0.3.0`: 0.3.0 release integration branch.
- `master`: archived original SDK v2 history.

Please target new contributions to `main` unless a maintainer asks for a release-specific PR. Merging into `main` does not automatically publish to Homey Test or Live.

```sh
npm ci
npm test
homey app validate --level publish
```

**Keep the root `app.json` tracked.** In this repository, Homey Compose populates it from `.homeycompose/` and the per-driver `*.compose.json` files. Change Compose sources first and verify the regenerated manifest before committing it.

Neither `node_modules/` nor `.homeybuild/` belongs in Git. Keep `package-lock.json` committed; runtime modules are installed by `npm ci`. The `.homeyignore` file excludes development resources from Homey's uploaded app package without excluding runtime dependencies.

## License

[MIT](LICENSE).

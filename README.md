# D-Link for Homey

Community-maintained support for compatible D-Link smart-home devices using **Homey Apps SDK v3**.

## Supported devices

| Model | Connection | Device | Supported Homey features |
| --- | --- | --- | --- |
| DCH-Z110 | Z-Wave | Door/window sensor | Contact, tamper and low-battery alarms; battery level, light and temperature |
| DCH-Z120 | Z-Wave | Motion sensor | Motion, tamper and low-battery alarms; battery level, light and temperature |
| DCH-Z122 | Z-Wave | Motion sensor | Motion, tamper and low-battery alarms; battery level |
| DCH-Z310 | Z-Wave | Smoke detector | Smoke alarm and battery level |
| DCH-Z510 | Z-Wave | Multisound siren | On/off control, tamper alarm and Flow actions for sounds and alarm controls |
| DSP-W215 | Wi-Fi / local LAN | Smart plug | On/off, power measurement and internal plug temperature |

Measurement and control behavior may vary with device hardware, firmware and configuration.

### DSP-W215 development status

The DSP-W215 local HNAP integration is under development for **v0.3.0**. It includes network discovery with manual address fallback, PIN authentication, on/off control and polling for power and temperature. **The Homey driver has not yet been verified on physical DSP-W215 hardware.**

Community hardware testing and troubleshooting instructions are in [DSP-W215 testing](docs/DSP-W215_TESTING.md). The design and protocol assumptions are documented in [Wi-Fi architecture](docs/WIFI_ARCHITECTURE.md) and [DSP-W215 notes](docs/DSP-W215.md).

### DCH-Z510 Flow actions

- Turn the siren on or off
- Select and play a siren sound
- Enable or disable its alarm

## Installation and support

Install **D-Link** from the [Homey App Store](https://homey.app/a/com.dlink/). Add supported Z-Wave devices using Homey's Z-Wave inclusion instructions. Local DSP-W215 setup will be available when the Wi-Fi-enabled version is released.

For problems or feature requests, check [GitHub Issues](https://github.com/JohanBendz/com.dlink/issues) before opening a new issue. Include the device model, hardware/firmware revision, Homey version, reproducible steps and a diagnostic report where available. Never share credentials, PINs or keys.

## Development

The original Homey SDK v2 code remains in `master`. Active SDK v3 development uses:

- `SDK3` for the stable SDK v3 base
- `Test` for the current Homey App Store Test candidate
- `release/0.3.0` for the Wi-Fi/HNAP development version

Install dependencies and validate the app with:

```sh
npm ci
homey app validate --level publish
```

Homey Compose populates the **tracked root `app.json`** from `.homeycompose/` and the driver Compose files. The root file must exist in a fresh checkout and must not be excluded through `.gitignore`. Edit Compose sources, then regenerate and verify the manifest before publishing.

`node_modules/` and `.homeybuild/` are not tracked by Git. Keep `package-lock.json` committed for repeatable dependency installation.

## License

[MIT](LICENSE).

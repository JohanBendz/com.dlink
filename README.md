# D-Link for Homey

Community-maintained support for compatible D-Link Z-Wave devices on Homey. This app uses **Homey Apps SDK v3**.

## Supported devices

| Model | Device | Homey features |
| --- | --- | --- |
| DCH-Z110 | Door/window sensor | Contact, tamper and low-battery alarms; battery level, light and temperature |
| DCH-Z120 | Motion sensor | Motion, tamper and low-battery alarms; battery level, light and temperature |
| DCH-Z122 | Motion sensor | Motion, tamper and low-battery alarms; battery level |
| DCH-Z310 | Smoke detector | Smoke alarm and battery level |
| DCH-Z510 | Siren | On/off control, tamper alarm and siren-specific Flow actions |

Availability of individual measurements depends on the device, its configuration and Z-Wave communication.

### DCH-Z510 Flow actions

- Turn siren on or off
- Select and play a siren sound
- Enable or disable the siren alarm

## Installation and support

Install **D-Link** from the [Homey App Store](https://homey.app/a/com.dlink/) and add a supported device through Homey's Z-Wave pairing interface. Follow the inclusion instructions shown during pairing.

For problems or requests, use [GitHub Issues](https://github.com/JohanBendz/com.dlink/issues). Include the device model, Homey model and firmware, the steps to reproduce the problem and a diagnostic report when available. Please check existing issues first.

## Development

This repository retains the original Homey SDK v2 code in `master`. The active SDK v3 branches are:

- `SDK3`: maintained SDK v3 baseline
- `Test`: next candidate for the Homey App Store Test channel
- `release/0.3.0`: upcoming Wi-Fi/LAN work, still under development

The **0.2.2** source branch contains only the existing Z-Wave devices. Wi-Fi support is not part of that release.

To work on the SDK v3 app:

```sh
npm ci
homey app validate --level publish
```

Homey Compose updates the tracked root `app.json` from `.homeycompose/` and the driver Compose files during the build process. The root `app.json` must exist in a fresh checkout for Compose to populate it. Edit the Compose sources instead of manually changing generated manifest details.

The `node_modules/` folder and Homey build artifacts are not kept in source control. Keep `package-lock.json` committed so dependencies can be reinstalled consistently.

## License

[MIT](LICENSE).

# DCH-S220: first local HNAP driver (experimental)

**Status:** untested on real DCH-S220 hardware. Keep this version on a development/release branch until community verification is available.

## Protocol research

- Manufacturer: [DCH-S220 product specifications](https://www.dlink.com/se/sv/products/dch-s220-mydlink-home-siren) (Wi-Fi, six selectable sounds, maximum 100 dB).
- [mtflud/DCH-S220-Web-Control](https://github.com/mtflud/DCH-S220-Web-Control) demonstrates HNAP `SetSoundPlay`, `SetAlarmDismissed` and `GetSirenAlarmSettings`, with `ModuleID=1` and `Controller=1`.
- [ldotlopez/python-hnap](https://github.com/ldotlopez/python-hnap) and [ha-hnap-device](https://github.com/ldotlopez/ha-hnap-device) independently implement local polling and the same six sound identifiers.
- [Real-world HNAP example, firmware 1.22, hardware A2](https://github.com/bikerp/dsp-w215-hnap/issues/11): `GetDeviceSettings` reports model name `DCH-S220` and `Audio Renderer` module.

The external repositories were used as **protocol references**. Their GPL code is **not copied** into this MIT-licensed app. This driver uses the project's own existing HNAP transport/authentication.

## Initial features

- Wi-Fi LAN HNAP authentication using the printed six-digit PIN; no cloud service.
- mDNS discovery using the app's existing `dlink-hnap` discovery definition, plus manual IP address fallback.
- `onoff` capability reflects whether the siren is sounding (polled, default 30 seconds).
- `onoff=true` plays a configurable sound, volume and duration; `onoff=false` stops sound.
- Flow actions: Play a selected sound, Stop.
- Default: Police sound, 50% volume, 15 seconds. Adjustable in advanced settings.
- Maximum automatic play duration: 300 seconds. No endless alarming for the first version.

## Test checklist (real hardware required)

- [ ] Discovery finds a DCH-S220 without accidentally identifying another D-Link HNAP device.
- [ ] Manual IP pairing works when mDNS is absent; reject other models.
- [ ] PIN challenge/login works, wrong PIN fails safely, credentials are never logged.
- [ ] Status correctly reports off / sounding.
- [ ] All six sound IDs (1–6) produce the expected sound; record actual output per firmware.
- [ ] Volume works at several settings. **Start with a very low level; the siren can be extremely loud.**
- [ ] Duration works and does not unexpectedly loop or keep sounding.
- [ ] On/off and both Flow actions work; stopping silences immediately.
- [ ] Existing Z-Wave devices and DSP-W215 remain unaffected.
- [ ] Device handles app restart, IP changes and temporary network loss.
- [ ] Tested firmware/hardware, Homey model/version, response codes and errors recorded without PIN.

> Please test in a safe setting, not near sleeping people, children, pets or sensitive hearing. Avoid long high-volume runs.

## Open questions

- Confirm discovery advertisement on all firmware versions; manual addressing remains available.
- Confirm precise device-reported `GetSirenAlarmSettingsResult` variants.
- Investigate whether older firmware interprets `Duration` differently.
- Homey SDK 3 CLI validation and device pairing must be completed before release.

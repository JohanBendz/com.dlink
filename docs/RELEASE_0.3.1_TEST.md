# D-Link 0.3.1: Homey Test validation

**Scope:** Targeted DCH-S220 Wi-Fi pairing fix. The existing DCH-Z110/Z120/Z122/Z310/Z510 drivers and DSP-W215 code are unchanged. This is a **Test** release for physical hardware validation, not a confirmed fix for every firmware.

## Reporter and device

- DCH-S220, hardware **A2**, firmware **V1.22 / V1.22b03**
- 0.3.0 Test failed after manual IP and before PIN handling with `GetDeviceSettings failed: ERROR`.

## Expected pairing in 0.3.1 Test

1. Enter the local DCH-S220 IP or hostname if discovery does not find the siren.
2. The PIN screen should appear **without the old `GetDeviceSettings failed: ERROR` popup**.
3. Enter the six-digit device PIN. Homey should authenticate the HNAP session **before** obtaining model/vendor/MAC via authenticated `GetDeviceSettings`.
4. If model identification succeeds, the siren is added and its current sounding status can be read.
5. Try on/off and both Flow cards at a **low volume** and for a short duration; stop must silence the siren.
6. If mDNS presents a generic HNAP device, pairing must only succeed after PIN authentication and confirmed D-Link DCH-S220 model identity.
7. Wrong PINs and a different HNAP model must be rejected safely.

**Important:** The independent working DCH-S220 app did not need to call `GetDeviceSettings`. If the authenticated `GetDeviceSettings` still returns `ERROR`, collect the exact error and a **redacted** Homey diagnostic report; do not claim pairing success or bypass model validation without a new review.

**Security:** Never publish device PIN, login/cookie, credentials or public IP addresses.

## Maintainer pre-publication

- Run `npm ci`, `npm test`, `homey app validate --level publish`.
- Confirm Compose-generated `app.json` is still **0.3.1**, with **seven existing drivers**.
- Upload **0.3.1 to Homey App Store Test**, not Live.
- Do not advance Live or stable SDK3 based on this unverified fix.
- Collect results in [Issue #26](https://github.com/JohanBendz/com.dlink/issues/26) and [PR #27](https://github.com/JohanBendz/com.dlink/pull/27).

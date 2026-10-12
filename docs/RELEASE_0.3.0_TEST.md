# D-Link v0.3.0: Homey Test channel verification

**Status:** Test candidate. Code reviews and simulated HNAP protocol checks do not prove compatibility with the physical devices. This version contains two new LAN integrations.

## Installation and environment

1. Install **D-Link v0.3.0 from Homey App Store Test**, after the maintainer publishes it.
2. Confirm your Homey model, Homey OS version, device model, hardware revision and firmware version.
3. Keep the Wi-Fi device on a network accessible from Homey. For pairing, have its six-digit local PIN available.
4. Never paste PINs or passwords in GitHub issues or diagnostic reports.

## DSP-W215 (smart plug)

- [ ] mDNS discovery shows the correct **DSP-W215**, without showing unrelated models.
- [ ] Manual IP pairing works when discovery fails.
- [ ] Correct PIN succeeds, incorrect PIN fails without leaking credentials.
- [ ] Switch **on** and **off** from the Homey device tile and Flow.
- [ ] Power reports plausible values as load changes; note whether zero/idle is reported.
- [ ] Plug temperature reports plausible values; note if this measurement is absent.
- [ ] Homey recovers after app restart, temporary Wi-Fi interruption and IP change.
- [ ] Existing device remains paired after app updates.

## DCH-S220 (Wi-Fi siren)

**Caution:** Loud audible device (rated up to 100 dB). Test briefly at a low volume away from people or animals sensitive to loud noises. Never use this experimental integration as a life-safety system.

- [ ] Discovery identifies only a **DCH-S220**; manual IP pairing also works.
- [ ] PIN authentication succeeds/fails appropriately.
- [ ] Playing and stopping sound reflects the correct `onoff` status in Homey.
- [ ] Try the six sound IDs at **low volume** and record the actual output:
      1 Emergency, 2 Fire, 3 Ambulance, 4 Police, 5 Door chime, 6 Beep.
- [ ] Confirm volume settings (e.g. 10, 25, 50) influence the output.
- [ ] Confirm duration (e.g. 2 s and 5 s) stops the sound as expected.
- [ ] Test both Flow actions: **Play a siren sound** and **Stop siren**.
- [ ] Homey restores the connection after app restart and temporary network loss.
- [ ] Record any firmware-specific behavior.

## Existing Z-Wave regressions

- [ ] DCH-Z110, Z120, Z122: available and update their supported sensor values.
- [ ] DCH-Z310: device remains available and shows normal status; do not interfere with smoke protection solely for this test.
- [ ] DCH-Z510: check on/off and each siren Flow card (sound selection, enable/disable) if you have the physical hardware.

## Reporting

Please report **Pass / Fail / Not tested** for each applicable item, together with hardware revision and firmware. Include reproducible steps, Homey version, and a diagnostic report ID if possible. No secrets.

Find ongoing feedback and issues at https://github.com/JohanBendz/com.dlink/issues.

## Maintainer publication checklist

- [ ] `npm ci` completed.
- [ ] `npm test` passed.
- [ ] `homey app validate --level publish` passed (inspect warnings).
- [ ] Confirm Homey Compose regenerates the tracked root `app.json` with v0.3.0, **7 drivers**, correct PNG/SVG asset paths, and `dlink-hnap` discovery.
- [ ] Confirm Git has no regenerated `node_modules/` or `.homeybuild/` files staged or committed.
- [ ] Confirm this version is published to **Test**, not Live.
- [ ] Collect physical-device feedback before a Live decision.

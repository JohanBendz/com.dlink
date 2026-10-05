# DSP-W215 field test checklist

The first Homey release of the DSP-W215 driver is intended to collect real-device evidence across hardware and firmware revisions.

Do not post the six-digit device PIN in GitHub issues or diagnostic comments.

## Pairing

Record:

- hardware revision (A1/A2/B1 if visible)
- firmware version
- Homey model/version
- whether Homey discovered the plug automatically
- whether manual IP/hostname fallback was needed

Expected flow:

1. Homey discovers the `_dhnap._tcp` service.
2. The driver identifies the device through HNAP `GetDeviceSettings`.
3. The user selects the DSP-W215.
4. The user enters the six-digit device PIN.
5. The driver authenticates and verifies `GetSocketSettings`.
6. The device is created using its HNAP `DeviceMacId` as the stable Homey ID.

## Functional checks

### On/off

- Toggle from Homey.
- Confirm the physical outlet changes.
- Toggle using the physical button.
- Confirm Homey follows the changed state within the configured state polling interval.

### Power

Connect a load with a reasonably stable draw and check whether Homey's Power value is plausible.

Record the Homey reading and, when available, a reference reading from another power meter.

### Plug temperature

The temperature is the DSP-W215 internal thermal sensor, not room temperature.

Check that:

- the value is plausible
- it changes gradually
- it does not jump between obviously unrelated scales

### Restart

- Restart the D-Link app.
- Restart Homey if practical.
- Confirm the device reconnects without re-pairing.

### Address change

For automatically discovered devices:

- allow the router to assign a new IP address, or renew DHCP if practical
- confirm Homey reconnects through discovery without editing Advanced settings

## Stability

Leave the driver running for at least several hours.

The default polling is intentionally conservative:

- socket state: 60 seconds
- power: 5 minutes
- internal temperature: 5 minutes

If the plug becomes unstable, increase the polling intervals in Advanced settings and report whether that changes the behaviour.

## Diagnostic report

Diagnostic logging is enabled by default for this first release.

Useful events start with:

`[DSP-W215][diag]`

They include:

- discovery and endpoint changes
- hardware/firmware metadata
- learned module layout for power and temperature
- communication errors and retry counts
- power/temperature readings

The device PIN is never written to these log lines.

When reporting a problem, include:

1. a short description of what failed
2. hardware revision
3. firmware version
4. whether discovery or manual address was used
5. approximate time of the failure
6. a Homey diagnostic report if possible

Reference GitHub issue #2 when reporting DSP-W215 test results.

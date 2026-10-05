# DSP-W215 implementation notes

The DSP-W215 is the reference device for the D-Link local HNAP transport.

## Verified protocol mapping

The original JavaScript implementation for the DSP-W215 and a maintained 2026 client agree on the common B1 / firmware 2.x mapping:

- socket state: `GetSocketSettings`, module 1, field `OPStatus`
- set socket: `SetSocketSettings`, module 1
- current power: `GetCurrentPowerConsumption`, module 2, field `CurrentConsumption`
- internal temperature: `GetCurrentTemperature`, module 3, field `CurrentTemperature`

An A1 / firmware 1.24 report documents power on module 3 and temperature on module 2. The client therefore probes the common ordering first and automatically learns the reversed layout when the response is a protocol-level error.

Some older implementations include `Controller=1` in `SetSocketSettings`, while currently maintained B1 code does not. The client first sends the smaller payload and retries once with `Controller=1` only on a protocol-level failure.

## Deliberately excluded for the first driver

`GetPMWarningThreshold/TotalConsumption` is not mapped to Homey's `meter_power` yet. Existing implementations disagree on whether that value represents lifetime or monthly energy, so it needs physical verification before we expose it as a cumulative Homey energy meter.

The reported temperature is the plug's internal thermal sensor used for overheat protection. A Homey capability should label it accordingly rather than implying it is room temperature.

## Polling

Historical reports describe some firmware becoming unreliable under aggressive SOAP polling. The Homey driver should therefore use conservative staggered polling rather than querying state, power and temperature every few seconds.

Initial recommendation:

- socket state: 60 seconds
- current power: 5 minutes
- internal temperature: 5 minutes
- immediate refresh after a Homey on/off command
- immediate refresh after Homey reports a discovery address change

These values should remain adjustable after physical testing.

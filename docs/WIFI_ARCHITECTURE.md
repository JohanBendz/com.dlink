# D-Link Wi-Fi architecture

This document defines the app's standard for network-connected D-Link devices.

## Homey model

Wi-Fi is the physical network, not the driver architecture. Drivers declare the transport they actually use:

| Device transport | Homey platform | Homey connectivity |
| --- | --- | --- |
| Z-Wave | local | zwave |
| Local HNAP / HTTP | local | lan |
| Local WebSocket | local | lan |
| Vendor cloud API | local | cloud |
| Hybrid LAN + cloud | local | lan + cloud |

The app remains a Homey Pro/local app. LAN access requires no additional app permission.

## Discovery

Homey's built-in Discovery is the default for LAN devices. Manual IP entry is a fallback only when a device genuinely cannot be discovered.

Legacy D-Link Home devices have been observed advertising the `_dhnap._tcp` mDNS-SD service. The Compose strategy is therefore:

- strategy: `dlink-hnap`
- service: `dhnap`
- protocol: `tcp`
- discovery result ID: hostname, provisionally

The discovery result ID is used to follow a device when its IP address changes. It is not the permanent Homey device identity.

During pairing, the driver should call unauthenticated `GetDeviceSettings` and use `DeviceMacId` as `data.id` when available. Store the Homey discovery result ID separately as `store.discoveryId`, then override `Device#onDiscoveryResult()` using `matchesStoredDiscovery()`.

If real-device captures show a stable unique TXT field, prefer that field over hostname in the discovery strategy.

## HNAP

HNAP is isolated under `lib/dlink/hnap/`:

- `HnapTransport`: HTTP(S), timeouts and response limits.
- `HnapAuth`: D-Link challenge/response authentication. The DSP-W215 family signs HNAP requests with Unix epoch seconds, matching the original device JavaScript/protocol implementations.
- `HnapXml`: minimal SOAP/XML helpers.
- `HnapClient`: protocol orchestration.
- `HnapDiscovery`: Homey discovery probing and stable device identity helpers.
- `HnapErrors`: typed errors.

Homey capabilities and Flow cards do not belong in this layer.

## Pairing standard

A device driver should use Homey's built-in pairing templates wherever possible:

1. Homey mDNS discovery.
2. Probe `GetDeviceSettings`.
3. Filter by supported model(s).
4. Show discovered devices.
5. Ask for the D-Link PIN/credentials.
6. Authenticate before adding the device.
7. Add using `DeviceMacId` as the durable Homey device ID.

Credentials should never be placed in `data` or logged. A driver that can lose authentication must provide a Repair flow rather than requiring delete/re-pair.

## Runtime standard

Each LAN device instance owns its own client and polling lifecycle.

- Use Homey lifecycle timers for polling.
- Refresh immediately after discovery address changes.
- Back off after communication failures.
- Do not store or depend on a fixed IP address.
- Keep protocol parsing outside `device.js`.
- Prefer push/webhooks when a future protocol supports them.

## Planned families

- DSP-W215: HNAP LAN reference socket.
- DCH-S160 / DCH-S161: HNAP LAN water sensors.
- DCH-S220: HNAP LAN siren.
- DSP-W115 / DSP-W245: separate local WebSocket transport.
- Newer mydlink devices: cloud adapter only after a current API/authentication path is verified.

The HNAP foundation deliberately adds no Wi-Fi driver yet, so existing Z-Wave behavior is unchanged.

'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

const SOUNDS = Object.freeze({
  1: {
    notificationType: 'Home Security',
    event: 0x01,
  },
  2: {
    notificationType: 'Emergency',
    event: 0x02,
  },
  3: {
    notificationType: 'Emergency',
    event: 0x03,
  },
  4: {
    notificationType: 'Emergency',
    event: 0x01,
  },
  5: {
    notificationType: 'Access Control',
    event: 0x16,
  },
});

class DCHZ510 extends ZwaveDevice {

  async onNodeInit() {
    // SWITCH_BINARY is the siren on/off control. BASIC is not a sound selector.
    this.registerCapability('onoff', 'SWITCH_BINARY');

    // Parameter 7 = 0 makes the device report tamper through Notification CC.
    // Explicitly avoid GET on init/online because some units can return a stale tamper state.
    this.registerCapability('alarm_tamper', 'NOTIFICATION', {
      getOpts: {
        getOnStart: false,
        getOnOnline: false,
      },
    });

    // Backwards compatibility for already-installed devices that still have
    // configuration parameter 7 set to 16 (Sensor Binary reporting).
    this.registerReportListener('SENSOR_BINARY', 'SENSOR_BINARY_REPORT', report => {
      if (
        !report
        || !report.hasOwnProperty('Sensor Value')
        || !report.hasOwnProperty('Sensor Type')
        || report['Sensor Type'] !== 'Tamper'
      ) {
        return null;
      }

      const detected = report['Sensor Value'] === 'detected an event';

      if (this.tamperTimeout) {
        clearTimeout(this.tamperTimeout);
        this.tamperTimeout = null;
      }

      this.setCapabilityValue('alarm_tamper', detected).catch(err => this.error(err));

      const cancellationSeconds = Number(this.getSetting('tamper_cancellation'));
      if (detected && Number.isFinite(cancellationSeconds) && cancellationSeconds > 0) {
        this.tamperTimeout = setTimeout(() => {
          this.tamperTimeout = null;
          this.setCapabilityValue('alarm_tamper', false).catch(err => this.error(err));
        }, cancellationSeconds * 1000);
      }

      return null;
    });
  }

  setSirenState(enabled) {
    if (!this.hasCommandClass('SWITCH_BINARY')) {
      throw new Error('DCH-Z510 does not expose SWITCH_BINARY');
    }

    return this.getCommandClass('SWITCH_BINARY').SWITCH_BINARY_SET({
      'Switch Value': enabled ? 0xFF : 0x00,
    });
  }

  playSound(soundId) {
    const id = String(soundId);

    if (id === '0') {
      return this.setSirenState(false);
    }

    const sound = SOUNDS[id];
    if (!sound) {
      throw new Error(`Unsupported DCH-Z510 sound: ${id}`);
    }

    if (!this.hasCommandClass('NOTIFICATION')) {
      throw new Error('DCH-Z510 does not expose NOTIFICATION');
    }

    return this.getCommandClass('NOTIFICATION').NOTIFICATION_REPORT({
      'V1 Alarm Type': 0,
      'V1 Alarm Level': 0,
      Reserved: 0,
      'Notification Status': 'On',
      'Notification Type': sound.notificationType,
      Event: sound.event,
      Properties1: {
        'Event Parameters Length': 0,
        Sequence: true,
      },
      'Event Parameter': Buffer.alloc(0),
      'Sequence Number': 0,
    });
  }

  setAlarmEnabled(enabled) {
    return this.configurationSet({
      index: 29,
      size: 1,
      signed: false,
    }, enabled ? 0 : 1);
  }

}

module.exports = DCHZ510;

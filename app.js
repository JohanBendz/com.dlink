'use strict';

const Homey = require('homey');

class DLinkApp extends Homey.App {

  onInit() {
    this._registerDCHZ510FlowCards();
    this._registerDCHS220FlowCards();
    this.log('D-Link app is running...');
  }

  _registerDCHZ510FlowCards() {
    this.homey.flow
      .getActionCard('DCH-Z510-siren_on')
      .registerRunListener(({ device }) => device.setSirenState(true));

    this.homey.flow
      .getActionCard('DCH-Z510-siren_off')
      .registerRunListener(({ device }) => device.setSirenState(false));

    this.homey.flow
      .getActionCard('DCH-Z510-alarm_sound')
      .registerRunListener(({ device, sound }) => device.playSound(sound));

    this.homey.flow
      .getActionCard('DCH-Z510-enable_siren')
      .registerRunListener(({ device }) => device.setAlarmEnabled(true));

    this.homey.flow
      .getActionCard('DCH-Z510-disable_siren')
      .registerRunListener(({ device }) => device.setAlarmEnabled(false));
  }

  _registerDCHS220FlowCards() {
    this.homey.flow
      .getActionCard('DCH-S220-play-sound')
      .registerRunListener(({ device, sound }) => device.playSound(sound));

    this.homey.flow
      .getActionCard('DCH-S220-stop')
      .registerRunListener(({ device }) => device.stopSound());
  }

}

module.exports = DLinkApp;

'use strict';
const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class Siren extends ZwaveDevice {
	
	async onMeshInit() {
		
		// enable debugging
		// this.enableDebug();
		
		// print the node's info to the console
		 this.printNode();


		// register device capabilities
		this.registerCapability('onoff', 'SWITCH_BINARY');
		this.registerCapability('onoff', 'BASIC');

		// timeout to reset the tamper capability
		this.registerReportListener('SENSOR_BINARY', 'SENSOR_BINARY_REPORT', report => {
			if (report &&
				report.hasOwnProperty('Sensor Value') &&
				report.hasOwnProperty('Sensor Type') &&
				report['Sensor Type'] === 'Tamper') {
					if (report['Sensor Value'] === 'detected an event') {
						this.setCapabilityValue('alarm_tamper', true);
						this.tamperTimeOut = setTimeout(() => {
							this.setCapabilityValue('alarm_tamper', false);
						},
						this.getSetting('tamper_cancellation') || 120);
						return true;
					}
				};
			return null;
		});

		// turn alarm on
		let turnAlarmOnFlow = new Homey.FlowCardAction('DCH-Z510-siren_on');
		turnAlarmOnFlow
		.register()
		.registerRunListener(( args, state ) => {
			return args.device.getCommandClass("SWITCH_BINARY").SWITCH_BINARY_SET({
				'Switch Value': 255
			});
		});
	
		// turn alarm off
		let turnAlarmOffFlow = new Homey.FlowCardAction('DCH-Z510-siren_off');
		turnAlarmOffFlow
		.register()
		.registerRunListener(( args, state ) => {
			return args.device.getCommandClass("SWITCH_BINARY").SWITCH_BINARY_SET({
				'Switch Value': 0
			});
		});
	
		// play sound
		let playSoundFlow = new Homey.FlowCardAction('DCH-Z510-alarm_sound');
		playSoundFlow
		.register()
		.registerRunListener((args, state) => {
			if (args.device.hasCommandClass('BASIC')) {
				return args.device.getCommandClass("BASIC").BASIC_SET({
					'Value': Math.round(args.sound * 1),
				});
			}
			return Promise.reject('Device has no valid command class to play sound');
		});
	
		// disable siren
		let disableSirenFlow = new Homey.FlowCardAction('DCH-Z510-disable_siren')
		disableSirenFlow
		.register()
		.registerRunListener((args, state) => {
			return this.configurationSet({
				index: 29,
				size: 1,
			}, 1);
		});
	
		// enable siren
		let enableSirenFlow = new Homey.FlowCardAction('DCH-Z510-enable_siren');
		enableSirenFlow
		.register()
		.registerRunListener((args, state) => {
			return this.configurationSet({
				index: 29,
				size: 1,
			}, 0);
		});

	}
}
module.exports = Siren;

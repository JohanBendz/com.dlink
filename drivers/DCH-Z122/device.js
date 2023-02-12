'use strict';
const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

class DCHZ122 extends ZwaveDevice {
	
	async onNodeInit() {
		
		// enable debugging
		// this.enableDebug();
		
		// print the node's info to the console
		// this.printNode();


		// register device capabilities
		this.registerCapability('alarm_motion', 'SENSOR_BINARY', {
			getOpts: {
				getOnOnline: true,
			},
			reportParser: report => {
				if (report &&
					report.hasOwnProperty('Sensor Value') &&
					report.hasOwnProperty('Sensor Type') &&
					report['Sensor Type'] === 'Motion') {
						if (report['Sensor Value'] === 'detected an event') {
							this.driver().motionTimeout(this.getData(), this.getSetting('motion_cancellation') || 30);
							return true;
						}
					if (this.getSetting('motion_cancellation') <= 0) return false;
					}
					return null;
			},
			reportParserOverride: true
		});

		this.registerCapability('alarm_tamper', 'SENSOR_BINARY', {
			reportParser: report => {
				if (report &&
					report.hasOwnProperty('Sensor Value') &&
					report.hasOwnProperty('Sensor Type') &&
					report['Sensor Type'] === 'Tamper') {
						if (report['Sensor Value'] === 'detected an event') {
							this.driver().tamperTimeout(this.getData(), this.getSetting('tamper_cancellation') || 120);
							return true;
						}
					}
					return null;
			},
			reportParserOverride: true
		});

		this.registerCapability('alarm_battery', 'BATTERY');
		this.registerCapability('measure_battery', 'BATTERY');

	}
}
module.exports = DCHZ122;

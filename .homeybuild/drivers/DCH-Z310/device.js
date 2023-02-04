'use strict';
const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

const TAMPER_TIMEOUT = 30 * 1000;

class DCHZ310 extends ZwaveDevice {
	
	async onNodeInit() {
		
		// enable debugging
		// this.enableDebug();
		
		// print the node's info to the console
		// this.printNode();


		// register device capabilities
		this.registerCapability('onoff', 'SWITCH_BINARY');
		this.registerCapability('onoff', 'BASIC');

		// This device does not send a timeout when the tamper period is over. Use a timeout to reset the capability
		this.registerReportListener('SENSOR_BINARY', 'SENSOR_BINARY_REPORT', report => {
		
			if (!report || !report.hasOwnProperty('Sensor Value') || !report.hasOwnProperty('Sensor Type')) return null;
	
			if (report['Sensor Type'] === 'Tamper' && report['Sensor Value'] === 'detected an event') {
			this.setCapabilityValue('alarm_tamper', true);
			this.tamperTimeOut = setTimeout(() => {
				this.setCapabilityValue('alarm_tamper', false);
			}, TAMPER_TIMEOUT);
			}
	
		});

	}
}
module.exports = DCHZ310;

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

		// register the measure_battery capability with COMMAND_CLASS_BATTERY
		this.registerCapability('measure_battery', 'BATTERY');

		// register the alarm_smoke capability with COMMAND_CLASS_NOTIFICATION or SENSOR_BINARY
		this.registerCapability('alarm_smoke', 'NOTIFICATION');
		this.registerCapability('alarm_smoke', 'SENSOR_BINARY');

	}
}
module.exports = DCHZ310;

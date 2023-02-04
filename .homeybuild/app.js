'use strict';

const Homey = require('homey');

class dlink extends Homey.App {
	
	onInit() {
		this.log('D-Link app is running...');
	}
	
}

module.exports = dlink;

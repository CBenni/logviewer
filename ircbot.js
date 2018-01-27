var net = require('net');
var events = require('events');
var winston = require('winston');
var parseIRCMessage = require("./messagecompressor").parseIRCMessage;

var rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)([^:]+?))?(?: [:](.*))?$/;
var rx2 = /([^=;]+)=([^;]*)/g;
var rx3 = /\r\n|\r|\n/;
var STATE_V3 = 1
var STATE_PREFIX = 2
var STATE_COMMAND = 3
var STATE_PARAM = 4
var STATE_TRAILING = 5


function IRCBot(host, port) {
	var self = this;
	self.client = new net.Socket();
	
	self.send = function(data) {
		if(data.indexOf("\n") >= 0) {
			winston.warn("Tried to send newline character!");
			return;
		}
		winston.debug("--> "+data);
		self.client.write(data+'\n');
	}
	
	self._buffer = "";
	self.connect = function() {
		self.client.connect(port, host, function() {
			self.emit('connect');
		});
	}
	
	var buffer = new Buffer('');

	self.client.on('data', function(chunk) {
		if (typeof (chunk) === 'string') {
			buffer += chunk;
		} else {
			buffer = Buffer.concat([buffer, chunk]);
		}

		var lines = buffer.toString().split(rx3);

		if (lines.pop()) {
			return;
		} else {
			buffer = new Buffer('');
		}

		lines.forEach(function(line) {
			if(line.length>0) {
				var parsed = parseIRCMessage(line);
				parsed[STATE_COMMAND] == "PING" && self.send("PONG");
				try {
					self.emit('raw', parsed);
					self.emit(parsed[STATE_COMMAND], parsed);
				} catch (error) {
					winston.error(error);
				}
			}
		});
	});

	self.client.on('close', function() {
		self.emit('disconnect');
	});
	
	
	// client.destroy();
}
IRCBot.prototype = new events.EventEmitter;
exports = module.exports = IRCBot;

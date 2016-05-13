var net = require('net');
var events = require('events');

var rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/;
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
		console.log("--> "+data);
		self.client.write(data+'\n');
	}
	
	self._buffer = "";
	self.connect = function() {
		self.client.connect(port, host, function() {
			self.emit('connect');
		});
	}
	
	self.parseIRCMessage = function(message) {
		var data = rx.exec(message);
		if(data == null) {
			console.log("==================== ERROR ====================");
			console.log("Couldnt parse message");
			console.log("'"+message+"'");
			console.log("===============================================");
			return null;
		}
		var tagdata = data[STATE_V3];
		if (tagdata) {
			var tags = {};
			do {
				m = rx2.exec(tagdata);
				if (m) {
					tags[m[1]] = m[2];
				}
			} while (m);
			data[STATE_V3] = tags;
		}
		return data;
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
				var parsed = self.parseIRCMessage(line);
				parsed[STATE_COMMAND] == "PING" && self.send("PONG");
				self.emit('raw', parsed);
				self.emit(parsed[STATE_COMMAND], parsed);
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
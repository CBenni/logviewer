var winston = require('winston');
var WebSocket = require('ws');
var request = require("request");
var events = require('events');

function pubsub(settings, db, io) {
	this.settings = settings;
	this.db = db;
	this.io = io;
	this.connections = [];
	this.currenthead = 0;
	this.topics2conn = {};
}

pubsub.prototype = new events.EventEmitter;
var connID = 0;
function pubsubConnection(ps) {
	var self = this;
	self.ws = new WebSocket(ps.settings.pubsub.server);
	self.open = false;
	self.topics = [];
	self.buffer = [];
	self.id = connID++;
	
	self.ws.on("open", function() {
		winston.info("PubSub connected");
		self.open = true;
		for(var i=0;i<self.buffer.length;++i) {
			console.log("Sending buffer: "+self.buffer[i]);
			self.ws.send(self.buffer[i]);
		}
		self.buffer = [];
	});
	
	var pingInterval = setInterval(function(){
		try {
			self.ws.send(JSON.stringify({type: "PING"}));
		}
		catch(e) {
			winston.error(e);
			clearInterval(pingInterval);
		}
	}, 60*1000);
}

pubsubConnection.prototype.send = function(data) {
	var self = this;
	if(self.open) {
		console.log("Sending: "+data);
		self.ws.send(data);
	} else {
		self.buffer.push(data);
	}
}

pubsub.prototype.listenModLogs = function(channelObj) {
	winston.info("listening to mod logs of "+channelObj.name);
	var self = this;
	var ok = false;
	try {
		self.listen(self.settings.bot.oauth, ["chat_moderator_actions."+self.settings.bot.id+"."+channelObj.id]);
	} catch(e) {
		winston.error("Error: "+e+" in pubsub.listen("+channelObj.name+").");
	}
}

pubsub.prototype.unlistenModLogs = function(channelObj) {
	winston.info("unlistening from mod logs of "+channelObj.name);
	var self = this;
	var ok = false;
	self.unlisten(["chat_moderator_actions."+self.settings.bot.id+"."+channelObj.id]);
}

pubsub.prototype.listen = function(oauth, topics) {
	var self = this;
	for(var i=0;i<topics.length;++i) {
		var connection;
		// find a connection to use
		for(var j=0;j<self.connections.length;++j) {
			var index = (self.currenthead+j)%self.connections.length;
			var conn = self.connections[index];
			if(conn.topics.length < (self.settings.pubsub.maxtopics || 49)) { // by default, we can listen to max. 49 topics per connection >_<
				connection = conn;
				break;
			}
		}
		// no connection found, try to create a new one
		if(!connection) {
			// add a new connection
			var connection = self.addConnection();
		}
		
		if(connection) {
			// add the topic
			self.topics2conn[topics[i]] = connection;
			connection.topics.push(topics[i]);
			connection.send(JSON.stringify({"type":"LISTEN","data":{"topics":[topics[i]], "auth_token": oauth}}));
		} else {
			winston.error("Pubsub limit exceeded!");
		}
	}
}

pubsub.prototype.unlisten = function(topics) {
	var self = this;
	for(var i=0;i<topics.length;++i) {
		var connection = self.topics2conn[topics[i]];
		if(connection) {
			connection.send(JSON.stringify({"type":"UNLISTEN","data":{"topics":topics}}));
			delete self.topics2conn[topics[i]];
		}
	}
}

pubsub.prototype.addConnection = function() {
	var self = this;
	var conn = new pubsubConnection(self);
	conn.ws.on("open", function() {
		winston.info("pubsub connection opened");
	});
	
	conn.ws.on("close", function() {
		winston.warn("pubsub connection closed");
		self.connections.splice(self.connections.indexOf(conn),1);
		for(var i=0;i<conn.topics.length;++i) {
			winston.info("Re-listening to topic "+conn.topics[i])
		}
	});
	
	conn.ws.on("error", function(e) {
		winston.error(e);
	});
	
	self.connections.push(conn);
	
	conn.ws.on("message", function(data, flags) {
		//{"type":"MESSAGE","data":{"topic":"chat_moderator_actions.21018440","message":"{\"data\":{\"type\":\"chat_login_moderation\",\"moderation_action\":\"timeout\",\"args\":[\"ubenni\",\"1\",\"lul\"],\"created_by\":\"cbenni\"}}"}}
		var msg = JSON.parse(data);
		winston.debug("Pubsub connection "+conn.id+"/"+self.connections.length+" received message: "+JSON.stringify(msg));
		self.emit(msg.type, msg, flags);
	});
	
	return conn;
}

module.exports = pubsub;

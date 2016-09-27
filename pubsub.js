var WebSocket = require('ws');
var request = require("request");

function pubsub(settings, db, io, api) {
	this.settings = settings;
	this.db = db;
	this.io = io;
	this.api = api;
	this.connections = [];
	this.currenthead = 0;
	
	this.addConnection();
}

function pubsubConnection(ps) {
	var self = this;
	self.ws = new WebSocket(ps.settings.pubsub.server);
	self.open = false;
	self.topics = [];
	self.buffer = [];
	
	self.ws.on("open", function() {
		self.open = true;
		for(var i=0;i<self.buffer.length;++i) {
			self.ws.send(self.buffer[i]);
		}
	});
}

pubsubConnection.prototype.send = function(data) {
	var self = this;
	if(self.open) {
		self.ws.send(data);
	} else {
		self.buffer.push(data);
	}
}

var knownChannels = {};
pubsub.prototype.getChannelID = function(channel, callback) {
	var self = this;
	if(knownChannels[channel]) {
		callback(null, knownChannels[channel]);
		return;
	}
	request.get({
		url: "https://api.twitch.tv/kraken/channels/"+channel+"?client_id="+self.settings.auth.client_id
	},function(e,r,body){
		if(e) {
			console.error(e);
			callback(e);
		} else if(body === undefined) {
			console.error("Error: "+r.statusCode);
			callback("Error: "+r.statusCode);
		} else {
			try {
				var id = JSON.parse(body)._id
				knownChannels[channel] = id;
				callback(null, id);
			} catch(e) {
				console.error("Error: "+e+" in pubsub.listen("+channel+").");
				if(callback) callback(e);
			}
		}
	}, function(error){
		console.error("Couldnt load "+channel+" channel ID.\nError: "+error);
		if(callback) callback(error);
	});
}

pubsub.prototype.listenModLogs = function(channel, oauth, callback) {
	var self = this;
	var ok = false;
	self.getChannelID(channel, function(e, id) {
		try {
			self.listen(oauth, ["chat_moderator_actions."+id]);
		} catch(e) {
			console.error("Error: "+e+" in pubsub.listen("+channel+").");
			if(callback) callback(e);
		}
	});
}

pubsub.prototype.listen = function(oauth, topics, ignoreLimits) {
	var self = this;
	var connection;
	// find a connection to use
	for(var i=0;i<self.connections.length;++i) {
		var index = (self.currenthead+i)%self.connections.length;
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
		connection.send(JSON.stringify({"type":"LISTEN","data":{"topics":topics,"auth_token": oauth}}));
	} else throw "pubsub limit exceeded";
}

pubsub.prototype.addConnection = function() {
	var self = this;
	if(self.connections.length < (self.settings.pubsub.maxconnections || 10)) { // by default, we can create max. 10 connections
		var conn = new pubsubConnection(self);
		conn.ws.on("open", function() {
			console.log("pubsub connection opened");
		});
		
		conn.ws.on("close", function() {
			console.log("pubsub connection closed");
		});
		
		conn.ws.on("message", function(data, flags) {
			console.log("data received: "+data);
		});
		
		self.connections.push(conn);
		return conn;
	}
}


var stx = {
	auth: {
		client_id: ""
	},
	pubsub: {
		server: "wss://pubsub-edge.twitch.tv/v1",
		
	}
}

var ps = new pubsub(stx);
var channels = [
	{
		name: "cbenni",
	},
	{
		name: "cbanni",
	},
	{
		name: "nudragon",
	},
	{
		name: "logv",
	},
	{
		name: "invalid"
	}
]

for(let i=0;i<channels.length;++i) {
	let channel = channels[i];
	ps.listenModLogs(channel.name, channel.oauth, function(e){
		if(e) console.log(e);
		else console.log("Started listening to "+channel+"s mod logs");
	});
}
var ircbot = require('./ircbot');
var messagecompressor = require('./messagecompressor');
var TAGS = 1
var PREFIX = 2
var COMMAND = 3
var PARAM = 4
var TRAILING = 5
function logviewerBot(settings, db) {
	var self = this;
	
	var host = "irc.chat.twitch.tv";
	var port = 6667;
	var hostandport = /([^:^\/]+)(?:[:/](\d+))?/.exec(settings.bot.server);
	if(hostandport) {
		if(hostandport[1]) {
			host = hostandport[1];
		}
		if(hostandport[2]) {
			port = parseInt(hostandport[2]);
		}
	}
	var bot = new ircbot(host, port);
	self.userlevels = {}; // temporary user levels (mod etc)
	self.channels = [];
	
	self.inChannel = function(channel) {
		return self.channels.indexOf(channel)>=0;
	}
	
	self.joinChannel = function(channel) {
		if(!self.inChannel(channel)) self.channels.push(channel);
		self.userlevels[channel] = self.userlevels[channel] || {};
		bot.send("JOIN #"+channel);
		db.ensureTablesExist(channel);
	}
	
	self.partChannel = function(channel) {
		self.channels.splice(self.channels.indexOf(channel),1);
		bot.send("PART #"+channel);
	}
	
	bot.on("connect", function(){
		bot.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
		var oauth = settings.bot.oauth;
		if(!oauth.startsWith("oauth:")) oauth = "oauth:"+oauth;
		bot.send("PASS "+oauth);
		bot.send("NICK "+settings.bot.nick);
		db.getChannels(function(channels){
			for(var i=0;i<channels.length;++i) {
				self.joinChannel(channels[i].name);
			}
		});
		console.log("Connected!");
	});

	bot.on("raw", function(data){
		if(data[COMMAND] != "PRIVMSG") {
			console.log(data[0]);
		}
	});

	var newsubregex = new RegExp("(\\w+) just subscribed!");
	var resubregex = new RegExp("(\\w+) subscribed for (\\d+) months in a row!");
	bot.on("PRIVMSG", function(data){
		var user = /\w+/.exec(data[PREFIX])[0];
		var channel = data[PARAM].slice(1);
		var text = data[TRAILING];
		console.log("#" + channel + " <" + user +"> " + text);
		
		// if the user is a mod, set his level to 5
		if(data[TAGS] && data[TAGS]["mod"] === "1") self.userlevels[channel][user] = 5;
		
		db.addLine(channel, user, messagecompressor.compressMessage(user, data));
		if(user === "twitchnotify" || user === "gdqsubs") {
			var m = newsubregex.exec(text) || resubregex.exec(text);
			if(m) {
				db.addLine(channel, m[1].toLowerCase(), "dtwitchnotify "+text);
			}
		}
	});

	bot.on("CLEARCHAT", function(data){
		var user = data[TRAILING];
		var channel = data[PARAM].slice(1);
		if(user && user.length > 0) {
			console.log("#"+channel + " <" + user +" has been timed out>");
			db.addTimeout(channel, user, "djtv <" + user +" has been timed out>");
		} else {
			console.log("#"+channel + " <chat was cleared by a moderator>");
			db.addTimeout(channel, "__jtv__", "djtv <chat was cleared by a moderator>");
		}
	});
	
	bot.on("NOTICE", function(data){
		var m = /The moderators of this room are: (.*)/.exec(data[TRAILING]);
		if(m) {
			users = m[1].match(/\w+/g);
			var channel = data[PARAM].slice(1);
			var userlist = {};
			for(var i=0;i<users.length;++i) {
				userlist[users[i]] = 5;
			}
			self.userlevels[channel] = userlist;
		}
	});
	//:tmi.twitch.tv NOTICE #ox33 :The moderators of this room are: 0x33, andyroid, anoetictv, ...
	self.checkMods = function(channel) {
		bot.send("PRIVMSG #"+channel+" :/mods");
	}
	
	var currentchannel = 0;
	var checkNextMods = function() {
		self.checkMods(self.channels[currentchannel%(self.channels.length)]);
		currentchannel++;
	}
	setInterval(checkNextMods,(settings.bot.modcheckinterval || 2) * 1000);
	
	bot.connect();
}

module.exports = logviewerBot;
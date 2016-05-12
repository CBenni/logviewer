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
			var duration,reason;
			console.log(data[TAGS]);
			if(data[TAGS]) {
				if(data[TAGS]["ban-duration"]) duration = data[TAGS]["ban-duration"];
				if(data[TAGS]["ban-reason"]) reason = data[TAGS]["ban-reason"].replace(/\\s/," ");
			}
			if(duration) {
				if(reason) {
					console.log("#"+channel + " <" + user +" has been timed out for "+formatTimespan(duration)+" with reason: "+reason+">");
					db.addTimeout(channel, user, "djtv <" + user +" has been timed out for "+formatTimespan(duration)+" with reason: "+reason+">");
				} else {
					console.log("#"+channel + " <" + user +" has been timed out>");
					db.addTimeout(channel, user, "djtv <" + user +" has been timed out>");
				}
			} else {
				if(reason) {
					console.log("#"+channel + " <" + user +" has been banned with reason: "+reason+">");
					db.addTimeout(channel, user, "djtv <" + user +" has been banned with reason: "+reason+">");
				} else {
					console.log("#"+channel + " <" + user +" has been banned>");
					db.addTimeout(channel, user, "djtv <" + user +" has been banned>");
				}
			}
		} else {
			console.log("#"+channel + " <chat was cleared by a moderator>");
			db.addTimeout(channel, "__jtv__", "djtv <chat was cleared by a moderator>");
		}
	});
	
	bot.on("NOTICE", function(data){
		//:tmi.twitch.tv NOTICE #ox33 :The moderators of this room are: 0x33, andyroid, anoetictv
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
	var regexes_channel_user =
		[
			/^#(\w+)\s+(\w+)$/,
			/^(\w+)\s+(\w+)$/,
			/^logof (\w+)\s+(\w+)$/,
			/^!logs? (\w+)\s+(\w+)$/,
		];
	var regexes_user_channel =
		[
			/^(\w+)\s+#(\w+)$/,
			/^(\w+)\s+(\w+)/,
			/^(\w+) in (\w+)$/,
			/^logof (\w+)\s+(\w+)$/,
			/^!logs? (\w+)\s+(\w+)$/,
		];
		
	var getLogs = function(channel, nick, requestedby, callback) {
		db.getActiveChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				callback(undefined, nick);
			}
			if(channelObj.viewlogs > 0) {
				db.getUserLevel(channelObj.name, requestedby, function(level){
					if(level >= channelObj.viewlogs) {
						db.getLogsByNick(channelObj.name, nick, 2, function(messages){
							for(var i=0;i<messages.length;++i) {
								messages[i].text = messagecompressor.decompressMessage("#"+channelObj.name, messages[i].nick, messages[i].text);
							}
							callback(messages, nick);
						});
					} else {
						callback(undefined, nick);
					}
				});
			} else {
				db.getLogsByNick(channelObj.name, nick, 2, function(messages){
					for(var i=0;i<messages.length;++i) {
						messages[i].text = messagecompressor.decompressMessage("#"+channelObj.name, messages[i].nick, messages[i].text);
					}
					callback(messages, nick);
				});
			}
		});
	}
	
	var formatTimespan = function(timespan) {
		var age = Math.round(timespan);
		var periods = [
			{abbr:"y", len: 3600*24*365},
			{abbr:"m", len: 3600*24*30},
			{abbr:"d", len: 3600*24},
			{abbr:" hrs", len: 3600},
			{abbr:" min", len: 60},
			{abbr:" sec", len: 1},
		];
		var res = "";
		var count = 0;
		for(var i=0;i<periods.length;++i) {
			if(age >= periods[i].len) {
				var pval = Math.floor(age / periods[i].len);
				age = age % periods[i].len;
				res += (res?" ":"")+pval+periods[i].abbr;
				count ++;
				if(count >= 2) break;
			}
		}
		return res;
	}
	
	
	bot.on("WHISPER", function(data) {
		//:logv!logv@logv.tmi.twitch.tv WHISPER cbenni :Message text
		var matches = [];
		var user = /\w+/.exec(data[PREFIX])[0];
		for(var i=0;i<regexes_user_channel.length;++i) {
			var m = regexes_user_channel[i].exec(data[TRAILING]);
			if(m) {
				matches.push({channel: m[2], nick: m[1]});
			}
		}
		for(var i=0;i<regexes_channel_user.length;++i) {
			var m = regexes_channel_user[i].exec(data[TRAILING]);
			if(m) {
				matches.push({channel: m[1], nick: m[2]});
			}
		}
		var done = 0;
		var replied = false;
		if(matches.length > 0) {
			db.getChannels(function(channels) {
				db.getAliases(function(aliases) {
					for(var i=0;i<matches.length;++i) {
						var match = matches[i];
						var channel = match.channel;
						var nick = match.nick;
						var found = false;
						for(var k=0;k<channels.length;k++) {
							if(channels[k].name == channel) {
								found = true;
								break;
							}
						}
						if(!found) for(var k=0;k<aliases.length;k++) {
							if(aliases[k].alias == channel) {
								channel = aliases[k].name;
								found = true;
								break;
							}
						}
						if(found) {
							getLogs(channel, nick, user, function(messages, copyofnick) {
								done++;
								if(replied) return;
								if(messages !== undefined) {
									replied = true;
									if(messages.length == 0) {
										bot.send("PRIVMSG #jtv :/w "+user+" No logs for "+copyofnick+" found.");
									} else {
										for(var j=0;j<messages.length;++j) {
											var message = messages[j];
											var data = bot.parseIRCMessage(message.text);
											var dname = message.nick;
											if(data[TAGS] && data[TAGS]["display-name"]) {
												dname = data[TAGS]["display-name"];
											}
											var d = Date.now()/1000;
											bot.send("PRIVMSG #jtv :/w "+user+" ["+formatTimespan(d-message.time)+" ago] "+dname+": "+data[TRAILING]);
										}
										bot.send("PRIVMSG #jtv :/w "+user+" See http://beta.cbenni.com/"+channel+"/?user="+message.nick);
									}
								} else if(done >= matches.length) {
									replied = true;
									bot.send("PRIVMSG #jtv :/w "+user+" Channel "+channel+" not found or invalid access level.");
								}
							});
						} else {
							done ++;
							if(replied) return;
							if(done >= matches.length) {
								replied = true;
								bot.send("PRIVMSG #jtv :/w "+user+" Channel "+channel+" not found.");
							}
						}
					}
				});
			});
		} else {
			bot.send("PRIVMSG #jtv :/w Usage: /w logviewer #channel user");
		}
	});
	
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
var fs = require("fs");
var events = require('events');
var winston = require('winston');

var ircbot = require('./ircbot');
var pubsub = require('./pubsub');
var messagecompressor = require('./messagecompressor');
var TAGS = 1
var PREFIX = 2
var COMMAND = 3
var PARAM = 4
var TRAILING = 5
function logviewerBot(settings, db, io) {
	var self = this;
	self.settings = settings;
	self.nick = settings.bot.nick;
	self.API = null;
	self.db = db;
	self.io = io;
	
	self.pubsub = new pubsub(settings, db, io);
	
	var messagecompressor = require('./messagecompressor');
	
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
	self.bot = new ircbot(host, port);
	self.userlevels = {}; // temporary user levels (mod etc)
	self.channels = [];
	self.id2channelObj = {};
	self.name2channelObj = {};
	
	
	self.bot.on("connect", function(){
		self.bot.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
		var oauth = settings.bot.oauth;
		if(!oauth.startsWith("oauth:")) oauth = "oauth:"+oauth;
		self.bot.send("PASS "+oauth);
		self.bot.send("NICK "+settings.bot.nick);
		db.getChannels(function(channels){
			for(var i=0;i<channels.length;++i) {
				self.joinChannel(channels[i]);
				if(channels[i].modlogs == "1") {
					console.log("Channel "+channels[i].name+" has mod logs enabled");
					self.enableModLogs(channels[i]);
				}
			}
		});
		winston.info("Connected!");
	});

	self.bot.on("raw", function(data){
		if(data[COMMAND] != "PRIVMSG") {
			winston.debug(data[0]);
		}
	});

	var newsubregex = new RegExp("(\\w+) just subscribed( with Twitch Prime)?!");
	var resubregex = new RegExp("(\\w+) subscribed for (\\d+) months in a row!");
	self.bot.on("PRIVMSG", function(data){
		var user = /\w+/.exec(data[PREFIX])[0];
		var channel = data[PARAM].slice(1);
		var text = data[TRAILING];
		winston.debug("#" + channel + " <" + user +"> " + text);
		
		// if the user is a mod, set his level to 5
		if(data[TAGS] && data[TAGS]["mod"] === "1" && self.userlevels[channel]) {
			self.userlevels[channel][user] = 5;
		}
		
		// remove the user from the recent timeouts (unless they were VERY recent (<2s ago)
		var oldtimeout = (self.timeouts[channel] && self.timeouts[channel][user]) || (self.oldtimeouts[channel] && self.oldtimeouts[channel][user]);
		if(oldtimeout) {
			var age = Date.now()/1000 - oldtimeout.time;
			if(age >= 2) {
				if(self.timeouts[channel] && self.timeouts[channel][user]) self.timeouts[channel][user] = undefined;
				if(self.oldtimeouts[channel] && self.oldtimeouts[channel][user]) self.oldtimeouts[channel][user] = undefined;
			}
		}
		
		if(self.timeouts[channel] && self.timeouts[channel][user]) {
			var now = 
			self.timeouts[channel][user] = undefined;
		}
		if(self.oldtimeouts[channel] && self.oldtimeouts[channel][user]) self.oldtimeouts[channel][user] = undefined;
		
		
		var time = Math.floor(Date.now()/1000);
		db.addLine(channel, user, messagecompressor.compressMessage(user, data), true, function(id) {
			var emittedMsg = {id: id, time: time, nick: user, text: data[0]};
			io.to("logs-"+channel+"-"+user).emit("log-add", emittedMsg);
			io.to("logs-"+channel+"-"+user+"-modlogs").emit("log-add", emittedMsg);
		});
		if(user === "twitchnotify" || user === "gdqsubs") {
			var m = newsubregex.exec(text) || resubregex.exec(text);
			if(m) {
				var sub = m[1].toLowerCase();
				db.addLine(channel, sub, "dtwitchnotify "+text, false, function(id) {
					var emittedMsg = {id: id, time: time, nick: sub, text: `@display-name=twitchnotify;color=;subscriber=0;turbo=0;user-type=;emotes=;mod=0 :${sub}!${sub}@${sub}.tmi.twitch.tv PRIVMSG #${channel} :${text}`};
					io.to("logs-"+channel+"-"+user).emit("log-add", emittedMsg);
					io.to("logs-"+channel+"-"+user+"-modlogs").emit("log-add", emittedMsg);
				});
			}
		}
	});

	self.bot.on("USERNOTICE", function(data){
		if(data[TAGS] && data[TAGS]["msg-id"]=="resub") {
			var time = Math.floor(Date.now()/1000);
			var channel = data[PARAM].slice(1);
			var text = data[TAGS]["system-msg"].replace(/\\s/g," ");
			if(data[TRAILING]) text += " Message: "+data[TRAILING];
			var sub = data[TAGS]["login"];
			db.addLine(channel, "twitchnotify", "dtwitchnotify "+text, true, function(id) {
				var irccmd = `@display-name=twitchnotify;color=;subscriber=0;turbo=0;user-type=;emotes=;mod=0 :${sub}!${sub}@${sub}.tmi.twitch.tv PRIVMSG #${channel} :${text}`;
				io.to("logs-"+channel+"-twitchnotify").emit("log-add", {id: id, time: time, nick: "twitchnotify", text: irccmd});
				io.to("logs-"+channel+"-twitchnotify-modlogs").emit("log-add", {id: id, time: time, nick: "twitchnotify", text: irccmd});
			});
			db.addLine(channel, sub, "dtwitchnotify "+text, false, function(id) {
				var irccmd = `@display-name=twitchnotify;color=;subscriber=0;turbo=0;user-type=;emotes=;mod=0 :${sub}!${sub}@${sub}.tmi.twitch.tv PRIVMSG #${channel} :${text}`;
				io.to("logs-"+channel+"-"+sub).emit("log-add", {id: id, time: time, nick: sub, text: irccmd});
				io.to("logs-"+channel+"-"+sub+"-modlogs").emit("log-add", {id: id, time: time, nick: sub, text: irccmd});
			});
		}
	});

	// Everything having to do with timeouts/bans
	var ROTATECYCLE = 30000;
	var MAXDIFF = 5000;

	self.timeouts = {};
	self.oldtimeouts = {};

	function rotateTimeouts(){
		self.oldtimeouts = self.timeouts;
		self.timeouts = {};
	}
	setInterval(rotateTimeouts, ROTATECYCLE);

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

	function formatCount(i) {
		return i<=1?"":" ("+i+" times)"; 
	}

	function formatTimeout(channel, user, timeout) {
		if(isFinite(timeout.duration)){
			// timeout
			if(timeout.reasons.length==0)
				return "<"+user+" has been timed out for "+formatTimespan(timeout.duration)+formatCount(timeout.count)+">"
			else if(timeout.reasons.length==1)
				return "<"+user+" has been timed out for "+formatTimespan(timeout.duration)+". Reason: "+timeout.reasons.join(", ")+formatCount(timeout.count)+">"
			else
				return "<"+user+" has been timed out for "+formatTimespan(timeout.duration)+". Reasons: "+timeout.reasons.join(", ")+formatCount(timeout.count)+">"
		} else {
			// banned
			if(timeout.reasons.length==0)
				return "<"+user+" has been banned>"
			else if(timeout.reasons.length==1)
				return "<"+user+" has been banned. Reason: "+timeout.reasons.join(", ")+">"
			else
				return "<"+user+" has been banned. Reasons: "+timeout.reasons.join(", ")+">"
		}
	}

	function emitTimeout(type, channel, user, timeout) {
		var irccmd = `@display-name=jtv;color=;subscriber=0;turbo=0;user-type=;emotes=;badges= :${user}!${user}@${user}.tmi.twitch.tv PRIVMSG #${channel} :${timeout.text}`
		io.to("logs-"+channel+"-"+user).emit(type, {id: timeout.id, time: timeout.time, nick: user, text: irccmd});
		io.to("logs-"+channel+"-"+user+"-modlogs").emit(type, {id: timeout.id, time: timeout.time, nick: user, modlog: timeout.modlog, text: irccmd});
	}
	
	function doTimeout(channel, mod, user, duration, reason, inc) {
		// search for the user in the recent timeouts
		var oldtimeout = (self.timeouts[channel] && self.timeouts[channel][user]) || (self.oldtimeouts[channel] && self.oldtimeouts[channel][user]);
		var now = new Date();
		if(self.timeouts[channel] === undefined) self.timeouts[channel] = {};
		duration = parseInt(duration) || Infinity;
		
		if(oldtimeout) {
			// if a reason is specified and its new, we add it
			if(reason && oldtimeout.reasons.indexOf(reason)<0) {
				oldtimeout.reasons.push(reason);
			}
			
			if(mod) oldtimeout.modlog[mod] = duration;
			
			
			var oldends = oldtimeout.time.getTime()+oldtimeout.duration*1000;
			var newends = now.getTime()+duration*1000;
			// only completely update significant changes in the end of the timeout
			if(Math.abs(oldends-newends) > MAXDIFF) {
				oldtimeout.time = now;
				oldtimeout.duration = duration;
			}
			
			oldtimeout.count += inc;
			oldtimeout.text = formatTimeout(channel, user, oldtimeout);
			// put it into the primary rotation again
			self.timeouts[channel][user] = oldtimeout;
			
			// update the database
			if(oldtimeout.id) {
				db.updateTimeout(channel, user, oldtimeout.id, now.getTime(), "djtv "+oldtimeout.text, oldtimeout.modlog);
				// emit timeout via websockets
				emitTimeout("log-update", channel, user, oldtimeout);
			}
			else oldtimeout.dirty = true;
			
		} else {
			var modlog = {};
			if(mod) modlog[mod] = duration;
			var timeout = {time: now, duration: duration, reasons: reason?[reason]:[], count: inc, modlog: modlog};
			
			timeout.text = formatTimeout(channel, user, timeout);
			// add the timeout to the cache with an empty id
			self.timeouts[channel][user] = timeout;
			db.addTimeout(channel, user, now.getTime(), "djtv "+timeout.text, modlog, function(id){
				timeout.id = id;
				// if the timeout was dirty, update it again...
				if(timeout.dirty) {
					db.updateTimeout(channel, user, id, timeout.time.getTime(), "djtv "+timeout.text, timeout.modlog);
				}
				// emit timeout via websockets
				emitTimeout("log-add", channel, user, timeout);
			});
		}
	}
	
	function doUnban(channel, mod, type, user) {
		var modlog = {};
		modlog[mod] = -1;
		var text = `<${user} has been ${type}>`;
		db.addModLog(channel, user, "djtv "+text, modlog, function(id){
			var irccmd = `@display-name=jtv;color=;subscriber=0;turbo=0;user-type=;emotes=;badges= :${user}!${user}@${user}.tmi.twitch.tv PRIVMSG #${channel} :${text}`;
			io.to("logs-"+channel+"-"+user).emit("log-add", {id: id, time: Math.floor(Date.now()/1000), nick: user, text: irccmd});
			io.to("logs-"+channel+"-"+user+"-modlogs").emit("log-add", {id: id, time: Math.floor(Date.now()/1000), nick: user, modlog: modlog, text: irccmd});
		});
	}


	self.bot.on("CLEARCHAT", function(data){
		let user = data[TRAILING];
		let channel = data[PARAM].slice(1);
		if(user && user.length > 0) {
			let duration,reason;
			if(data[TAGS]) {
				if(data[TAGS]["ban-duration"]) duration = data[TAGS]["ban-duration"];
				if(data[TAGS]["ban-reason"]) reason = data[TAGS]["ban-reason"].replace(/\\s/g," ");
			}
			doTimeout(channel, undefined, user, duration, reason, 1);
		} else {
			winston.debug("#"+channel + " <chat was cleared by a moderator>");
			db.addTimeout(channel, "jtv", Date.now(), "djtv <chat was cleared by a moderator>");
		}
	});

	var lastSave = Date.now();
	self.bot.on("NOTICE", function(data){
		//:tmi.twitch.tv NOTICE #ox33 :The moderators of this room are: 0x33, andyroid, anoetictv
		//@msg-id=msg_banned :tmi.twitch.tv NOTICE #frankerzbenni :You are permanently banned from talking in frankerzbenni.
		let channel = data[PARAM].slice(1);
		if(data[TAGS] && (data[TAGS]["msg-id"] === "room_mods" || data[TAGS]["msg-id"] === "no_mods")) {
			//console.log("Got mods response for channel "+channel+": "+data[0]);
			let users = [];
			if(data[TAGS]["msg-id"] === "room_mods") {
				let m = /The moderators of this \w+ are: (.*)/.exec(data[TRAILING]);
				users = m[1].match(/\w+/g);
			}
			
			
			// check if the moderation status of the bot has changed
			var ismodded = users.indexOf(self.nick) >= 0;
			if(self.userlevels[channel] && ismodded * 5 != (self.userlevels[channel][self.nick] || 0)) {
				// emit the moderation status changed event via ws
				self.io.to("events-"+channel).emit("ismodded", ismodded);
				
				if(!ismodded) {
					console.log(self.name2channelObj);
					let channelObj = self.findChannelObj({name: channel});
					// disable mod log setting
					console.log("Got unmodded in "+channel+" - "+JSON.stringify(channelObj)+" unlistening from mod logs");
					self.disableModLogs(channelObj);
					self.db.setSetting(channel, "modlogs", "0");
					self.API.adminLog(channel, "", "system", "modlogs-disabled", "Detected that the bot is no longer modded in your channel. Disabled mod logs.");
				}
			}
			
			let userlist = {};
			for(let i=0;i<users.length;++i) {
				userlist[users[i]] = 5;
			}
			
				
			self.userlevels[channel] = userlist;
			self.emit("moderator-list-"+channel, users);
			
			
			if(Date.now() - lastSave > 60*1000) {
				// write to file every minute
				console.log("Writing mods.json");
				lastSave = Date.now();
				fs.writeFile("mods.json", JSON.stringify(self.userlevels), "utf-8");
			}
		} else if(data[TAGS] && data[TAGS]["msg-id"] === "msg_banned"){
			// we were banned from the channel, leave it.
			let channelObj = self.findChannelObj({name: channel});
			db.setSetting(channel, "active", "0");
			self.partChannel(channelObj);
			if(self.API) {
				self.API.adminLog(channel, "", "system", "banned", "Detected that the bot is banned from the channel. Disabled the logviewer.");
			}
		} else {
			db.addLine(channel, "jtv", "djtv "+data[TRAILING], false);
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
						db.getLogsByNick(channelObj.name, nick, 2, false, function(messages){
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
				db.getLogsByNick(channelObj.name, nick, 2, false, function(messages){
					for(var i=0;i<messages.length;++i) {
						messages[i].text = messagecompressor.decompressMessage("#"+channelObj.name, messages[i].nick, messages[i].text);
					}
					callback(messages, nick);
				});
			}
		});
	}


	self.bot.on("WHISPER", function(data) {
		//:logv!logv@logv.tmi.twitch.tv WHISPER cbenni :Message text
		var matches = [];
		var user = /\w+/.exec(data[PREFIX])[0];
		// try to find some kind of matches
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
		// if we have someting that could look like legit syntax...
		if(matches.length > 0) {
			// get all channels and aliases
			db.getChannels(function(channels) {
				db.getAliases(function(aliases) {
					// iterate over the matches until weve found one that actually features an existing channel or alias.
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
						// we have found one, get the logs, send them back and finish
						if(found) {
							getLogs(channel, nick, user, function(messages, copyofnick) {
								if(messages !== undefined) {
									if(messages.length == 0) {
										self.bot.send("PRIVMSG #jtv :/w "+user+" No logs for "+copyofnick+" found.");
									} else {
										for(var j=0;j<messages.length;++j) {
											var message = messages[j];
											var data = messagecompressor.parseIRCMessage(message.text);
											var dname = message.nick;
											if(data[TAGS] && data[TAGS]["display-name"]) {
												dname = data[TAGS]["display-name"];
											}
											var d = Date.now()/1000;
											self.bot.send("PRIVMSG #jtv :/w "+user+" ["+formatTimespan(d-message.time)+" ago] "+dname+": "+data[TRAILING]);
										}
										self.bot.send("PRIVMSG #jtv :/w "+user+" See "+settings.auth.baseurl+"/"+channel+"/?user="+message.nick);
									}
								} else {
									self.bot.send("PRIVMSG #jtv :/w "+user+" Channel "+channel+" not found or invalid access level.");
								}
							});
						} else {
							self.bot.send("PRIVMSG #jtv :/w "+user+" Channel "+channel+" not found.");
						}
						return;
					}
				});
			});
		} else {
			self.bot.send("PRIVMSG #jtv :/w Usage: /w logviewer #channel user");
		}
	});

	fs.readFile("mods.json", "utf-8", function(err, data) {
		if(err) {
			winston.info("No mods.json found.")
		} else {
			self.userlevels = JSON.parse(data);
		}
	});

	var currentchannel = 0;
	var checkNextMods = function() {
		if(self.channels.length > 0) {
			self.checkMods(self.channels[currentchannel%(self.channels.length)]);
			currentchannel++;
		}
	}
	setInterval(checkNextMods,(settings.bot.modcheckinterval || 2) * 1000);

	self.bot.connect();
	
	// react to mod logs, if present
	self.pubsub.on("MESSAGE", function(message, flags) {
		winston.debug("Handling pubsub message "+JSON.stringify(message));
		let topic = message.data.topic.split(".");
		if(topic[0] == "chat_moderator_actions") {
			var channelid = topic[2];
			var channelObj = self.findChannelObj({id: channelid});
			var channel = channelObj.name;
			var command = JSON.parse(message.data.message).data;
			console.log(command);
			var user = command.created_by;
			if(command.moderation_action == "timeout") {
				doTimeout(channel, user, command.args[0].toLowerCase(), command.args[1] || 600, command.args[2] || "", 0);
			} else if(command.moderation_action == "ban") {
				doTimeout(channel, user, command.args[0].toLowerCase(), Infinity, command.args[1] || "", 0);
			} else if(command.moderation_action == "unban") {
				doUnban(channel, user, "unbanned", command.args[0].toLowerCase());
			} else if(command.moderation_action == "untimeout") {
				doUnban(channel, user, "untimed out", command.args[0].toLowerCase());
			} else {
				var text = "/"+command.moderation_action;
				if(command.args) text += " "+command.args.join(" ");
				var modlog = {};
				modlog[user] = "";
				db.addModLog(channel, "jtv", "djtv "+text, modlog, function(id) {
					var time = Math.floor(Date.now()/1000);
					io.to("logs-"+channel+"-"+user).emit("log-add", {id: id, time: time, nick: "jtv", text: `@display-name=jtv;color=;subscriber=0;turbo=0;user-type=;emotes=;badges= :jtv!jtv@jtv.tmi.twitch.tv PRIVMSG #${channel} :${text}`});
					io.to("logs-"+channel+"-"+user+"-modlogs").emit("log-add", {id: id, time: time, nick: user, modlog: modlog, text: `@display-name=jtv;color=;subscriber=0;turbo=0;user-type=;emotes=;badges= :${user}!${user}@${user}.tmi.twitch.tv PRIVMSG #${channel} :${text}`});
				});
				self.API.adminLog(channel, user, "command", command.moderation_action, text);
			}
		}
	});
}

logviewerBot.prototype = new events.EventEmitter;
	
logviewerBot.prototype.findChannelObj = function(channel) {
	var self = this;
	var channelObj = self.id2channelObj[channel.id];
	if(channelObj) return channelObj;
	channelObj = self.name2channelObj[channel.name];
	if(channelObj) return channelObj;
	if(self.channels.indexOf(channel) >= 0) return channel;
	else return null;
}
	
logviewerBot.prototype.joinChannel = function(channelObj) {
	console.log("Joining channel "+JSON.stringify(channelObj));
	var self = this;
	if(self.findChannelObj(channelObj)) return;
	self.channels.push(channelObj);
	self.bot.send("JOIN #"+channelObj.name);
	self.bot.send("PRIVMSG #"+channelObj.name+" :.mods");
	self.db.ensureTablesExist(channelObj.name);
	self.id2channelObj[channelObj.id] = channelObj;
	self.name2channelObj[channelObj.name] = channelObj;
}

logviewerBot.prototype.partChannel = function(channelObj) {
	var self = this;
	channelObj = self.findChannelObj(channelObj);
	let index = self.channels.indexOf(channelObj);
	console.log("Leaving channel "+JSON.stringify(channelObj));
	if(index >= 0) {
		self.channels.splice(index,1)[0];
		self.bot.send("PART #"+channelObj.name);
		delete self.id2channelObj[channelObj.id];
		delete self.name2channelObj[channelObj.name];
	} else {
		self.bot.send("PART #"+channelObj.name);
		winston.error("Tried to leave channel "+channelObj.name+" that wasnt joined");
	}
}

logviewerBot.prototype.checkMods = function(channelObj) {
	var self = this;
	self.bot.send("PRIVMSG #"+channelObj.name+" :/mods");
}

// checks if the logviewer bot is modded in a channel
logviewerBot.prototype.isModded = function(channelObj, callback, force, cacheonly) {
	if(!channelObj) {
		callback(false);
		return;
	}
	var self = this;
	var channel = channelObj.name;
	if(self.userlevels[channel] && !force) {
		console.log("Used cached mod list for channel "+channel+": "+JSON.stringify(self.userlevels[channel]));
		callback(self.userlevels[channel][self.nick] == 5);
	} else if(!cacheonly) {
		console.log("Waiting for mod list for channel "+channel);
		if(force) self.checkMods(channelObj);
		self.once("moderator-list-"+channel, function(list){
			if(list.indexOf(self.nick) >= 0) {
				callback(true);
			} else {
				callback(false);
			}
		});
		self.checkMods(channelObj);
	} else {
		callback(false);
	}
	
}

logviewerBot.prototype.enableModLogs = function(channelObj, callback) {
	var self = this;
	
	self.isModded(channelObj, function(isModded) {
		if(isModded) {
			// we gucci, subscribe to pubsub
			console.log("Enabling mod logs for "+JSON.stringify(channelObj));
			self.pubsub.listenModLogs(channelObj);
			channelObj.modlogs = "1";
			if(callback) callback(true);
		} else {
			console.log("Bot is not modded in "+channelObj.name);
			if(callback) callback(false);
		}
	});
}

logviewerBot.prototype.disableModLogs = function(channelObj) {
	var self = this;
	//channelObj = self.findChannelObj(channelObj);
	self.pubsub.unlistenModLogs(channelObj);
	channelObj.modlogs = "0";
}

module.exports = logviewerBot;

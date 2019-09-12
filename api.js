var winston = require('winston');
var request = require('request');
var messagecompressor = require('./messagecompressor');

function API(settings, db, bot, io) {
	this.settings = settings;
	this.db = db;
	this.bot = bot;
	this.io = io;
	this.streaming = {};
	this.checkStreams();
	setInterval(API.prototype.checkStreams.bind(this), 60*1000);
}

// generic helpers

// returns the smallest absolute maximum of the inputs
// for example, absMinMax(5,10,-10) would return -10
function absMinMax(){
	var best=0;
	for(var i=0;i<arguments.length;++i){
		if(Math.abs(best) < Math.abs(arguments[i])) best = arguments[i];
		else if(best == -arguments[i]) best = Math.min(best, arguments[i])
	}
	return best;
}


// start of API

API.prototype.twitchGet = function(url, headers, token) {
	headers = headers || {};
	headers["Client-ID"] = this.settings.auth.client_id;
	headers["Accept"] = "application/vnd.twitchtv.v5+json"
	if(token) headers["Authorization"] = "OAuth "+token;
	// console.log("Getting "+url);
	return new Promise((r,j)=>{
		request.get({url: url, headers: headers}, function (error, response, body) {
			if(error) j(error, response);
			else {
				try {
					r(JSON.parse(body), response);
				} catch(e) {
					j(e, response);
				}
			}
		});
	});
}

API.prototype.adminLog = function(channel, user, action, key, data) {
	var t = Math.floor(Date.now()/1000);
	this.io.to("events-"+channel).emit("adminlog", {channel: channel, user: user, action: action, name: key, data: data, time: t});
	this.db.adminLog(channel, user, action, key, data);
	winston.debug("Emitting adminlog: "+action+" on channel "+channel);
}

// helper function: gets both the channel object and the user level of the specified token
API.prototype.getChannelObjAndLevel = function(channel, token, callback) {
	var self = this;
	var channel = channel.toLowerCase();
	self.db.getChannel(channel, function(channelObj) {
		if(channelObj) {
			self.getLevel(channelObj.name, token, function(level, username){
				callback(null, channelObj, level, username);
			});
		} else {
			self.getLevel(channel, token, function(level, username){
				callback({status: 404, message: "Channel "+channel+" not found."}, null, level, username);
			});
			
		}
	});
}


// gets the level of a user by name
API.prototype.getUserLevel = function(channel,name,callback) {
	var self = this;
	var reslvl = null;
	var templvl = 0;
	if(name) {
		if(channel) {
			if(self.bot.userlevels[channel] && self.bot.userlevels[channel][name]) templvl = self.bot.userlevels[channel][name];
			if(channel === name) templvl = 10;
			self.db.getUserLevel(channel, name, function(lv){
				if(reslvl === null) {
					reslvl = lv;
				} else {
					callback(absMinMax(1,reslvl,lv,templvl));
				}
			});
		} else {
			reslvl = 0;
		}
		
		self.db.getUserLevel("logviewer", name, function(lv){
			if(reslvl === null) {
				reslvl = lv;
			} else {
				callback(absMinMax(1,reslvl,lv,templvl));
			}
		});
	} else callback(0);
}

// gets the level of a user by token
API.prototype.getLevel = function(channel, token, callback) {
	var self = this;
	if(!token || token === "") callback(0);
	else {
		self.db.getAuthUser(token, function(name){
			self.getUserLevel(channel,name,function(level){
				callback(level,name);
			});
		});
	}
}

// updates a channel settings
var allowedsettings = ["active","modlogs","viewlogs","viewmodlogs","viewcomments","writecomments","deletecomments"];
API.prototype.updateSettings = function(channelObj, user, settings, callback) {
	var self = this;
	var error;
	var async = false; // TODO: promises
	console.log(settings);
	
	for(var i=0;i<allowedsettings.length;++i) {
		var key = allowedsettings[i];
		if(settings[key] !== undefined && !isNaN(parseInt(settings[key]))) {
			if(key === "active") {
				self.db.setSetting(channelObj.name, key, settings[key]);
				self.adminLog(channelObj.name, user, "setting", key, settings[key]);
				if(settings.active == "1") self.bot.joinChannel(channelObj);
				else self.bot.partChannel(channelObj);
			} else if(key === "modlogs") {
				if(settings.modlogs == "1") {
					async = true;
					self.bot.enableModLogs(channelObj, function(success) {
						if(success) {
							self.db.setSetting(channelObj.name, key, settings[key]);
							self.adminLog(channelObj.name, user, "setting", key, settings[key]);
							callback();
						} else {
							callback({status: 400, message: "The logviewer is not modded in your channel."});
						}
					});
				}
				else {
					self.bot.disableModLogs(channelObj);
					self.db.setSetting(channelObj.name, key, settings[key]);
					self.adminLog(channelObj.name, user, "setting", key, settings[key]);
				}
			} else {
				self.db.setSetting(channelObj.name, key, settings[key]);
				self.adminLog(channelObj.name, user, "setting", key, settings[key]);
			}
		}
	}
	if(!async) callback(error);
}

// gets logs for a user.
// query is an object with the properties {id: string, nick: string, before: int, after: int}
// if ID is specified (!== undefined) it gives the "before" messages (default 10) before the message with the given ID
// and the "after" messages (default 10) after the message with the given ID
// otherwise, it gives the newest "before" messages
// if a nick is specified, it only returns messages by that user
API.prototype.getLogs = function(channelObj, query, modlogs, comments, callback) {
	var self = this;
	if(query.id) { 
		var id = parseInt(query.id);
		self.db.getLogsById(channelObj.name, id, query.nick, Math.min(parseInt(query.before || 10),100), Math.min(parseInt(query.after || 10),100), modlogs, function(before, after){
			//winston.debug("Got "+before.length+" before and "+after.length+" after - args: "+JSON.stringify(arguments));
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channelObj.name, before[i].nick, before[i].text);
			}
			for(var i=0;i<after.length;++i) {
				after[i].text = messagecompressor.decompressMessage("#"+channelObj.name, after[i].nick, after[i].text);
			}
			if(query.nick) {
				self.db.getUserStats(channelObj.name, query.nick, query.ranking == "1", function(userobj) {
					callback({id:id, user: userobj, before: before, after: after});
				});
			}
			else {
				callback({id:id, before: before, after: after});
			}
		});
	}
	else if(query.nick) {
		var c = Math.min(parseInt(query.before || 10), 100);
		self.db.getLogsByNick(channelObj.name, query.nick, Math.min(parseInt(query.before || 10), 100), modlogs, function(before){
			winston.debug(`Got ${before.length} before - args: ${channelObj.name},${query.nick},${c}`);
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channelObj.name, before[i].nick, before[i].text);
			}
			self.db.getUserStats(channelObj.name, query.nick, query.ranking == "1", function(userobj) {
				if(comments) {
					self.db.getComments(channelObj.name,query.nick,function(comments) {
						callback({id:id, user: userobj, before: before, after: [], comments: comments || []});
					});
				}
				else {
					callback({id:id, user: userobj, before: before, after: []});
				}
			});
		});
	}
	else if(query.time) {
		var time = parseInt(query.time);
		// function(          channel,         time, before,                                     after,                                     modlogs, callback)
		self.db.getLogsByTime(channelObj.name, time, Math.min(parseInt(query.before || 10),100), Math.min(parseInt(query.after || 10),100), modlogs, function(before, after){
			//winston.debug("Got "+before.length+" before and "+after.length+" after - args: "+JSON.stringify(arguments));
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channelObj.name, before[i].nick, before[i].text);
			}
			for(var i=0;i<after.length;++i) {
				after[i].text = messagecompressor.decompressMessage("#"+channelObj.name, after[i].nick, after[i].text);
			}
			callback({time:time, before: before, after: after});
		});
	} else {
		callback({"error":"Missing parameters (either nick and/or id or time)."});
	}
}

API.prototype.setIntegration = function(channelObj, user, newintegration, callback) {
	var self = this;
	// update
	if(newintegration.id) {
		self.db.getIntegration(channelObj.name, newintegration.id, function(integration) {
			if(integration) {
				var integrationkeys = Object.keys(integration);
				for(var i=0;i<integrationkeys.length;++i) {
					var key = integrationkeys[i];
					var newval = newintegration[key];
					if(newval !== undefined) {
						integration[key]= newval;
					}
				}
				// update the integration
				self.adminLog(channelObj.name, username, "integration", integration.type+"/"+integration.data, integration.active?"enable":"disable");
				self.db.updateIntegration(channelObj.name, integration.id, integration.active, integration.type, integration.data, integration.description, function(){
					callback(null, integration);
				})
			} else {
				callback({status: 404, message: "Integration "+newintegration.id+" not found."});
			}
		});
	// add
	} else {
		var requiredkeys = ["active", "type", "data", "description"];
		var integration = {
			"channel": channelObj.name
		}
		for(var i=0;i<requiredkeys.length;++i) {
			var key = requiredkeys[i];
			var newval = newconnection[key];
			if(newval === undefined) {
				res.status(400).jsonp({"error": "Key "+key+" missing"});
				return;
			} else {
				integration[key]= newval;
			}
		}
		// add the integration
		self.adminLog(channelObj.name, username, "integration", integration.type+"/"+integration.data, integration.active?"enable":"disable");
		self.db.addIntegration(channelObj.name, integration.id, integration.active, integration.type, integration.data, integration.description, function(id){
			integration.id = id;
			callback(null, integration);
		})
	}
}

API.prototype.setComment = function(channelObj, level, username, newcomment, callback) {
	var self = this;
	if(newcomment.id) {
		// we are editing a comment
		self.db.getComment(channelObj.name, newcomment.id, function(comment){
			if(comment) {
				// only people with the edit permission can delete other peoples comments
				if(level >= channelObj.editcomments || comment.author == username) {
					var time = Math.floor(Date.now()/1000);
					comment.edited = time;
					comment.text = newcomment.text;
					self.adminLog(channelObj.name, username, "comment", "edit", JSON.stringify(comment));
					self.db.updateComment(channelObj.name, comment.id, comment.text);
					// only send back stuff needed for identification and changes
					self.io.to("comments-"+channelObj.name+"-"+comment.topic).emit("comment-update", comment);
					callback();
				} else {
					callback({"status": 403, "message":"Can only edit own comments"});
					return;
				}
			} else {
				callback({"status": 404, "message":"Comment not found"});
			}
		});
	} else {
		if(newcomment.topic === undefined) {
			callback({"status":400, "message":"Missing parameter topic."});
		} else if(newcomment.text === undefined) {
			callback({"status":400, "message":"Missing parameter text."});
		} else if(level >= channelObj.writecomments) {
			var time = Math.floor(Date.now()/1000);
			self.db.addComment(channelObj.name, username, newcomment.topic, newcomment.text, function(id){
				var comment = {id: id, added: time, edited: time, channel: channelObj.name, author: username, topic: newcomment.topic, text: newcomment.text};
				self.adminLog(channelObj.name, username, "comment", "add", JSON.stringify(comment));
				self.io.to("comments-"+channelObj.name+"-"+newcomment.topic).emit("comment-add", comment);
			});
			callback();
		} else {
			callback({"status":403, "message":"Cannot write comments for this channel"});
			return;
		}
	}
}

API.prototype.getChannels = function(callback){
	var self = this;
	self.db.getChannelList(function(channels) {
		for(var i=0;i<channels.length;++i) {
			var channel = channels[i];
			channel.live = self.streaming[channel.name];
		}
		callback(channels);
	});
}

// keep a list of live channels
API.prototype.checkStreams = function() {
	var self = this;
	// get an up-to-date list of channels
	self.db.getChannels(function(channels) {
		// iterate 100 channels at once
		var chunkSize = 100;
		for(let i=0;i<channels.length;i+=chunkSize) {
			let channelChunk = channels.slice(i,i+chunkSize).map((x)=>x.id);
			self.twitchGet("https://api.twitch.tv/kraken/streams?limit=100&channel="+channelChunk.join(",")).then(function(data){
				// reset streams
				for(let j=0;j<channelChunk.length;++j) self.streaming[channelChunk[j]] = false;
				for(let j=0;j<data.streams.length;++j) {
					self.streaming[data.streams[j].channel.name] = data.streams[j].viewers;
				}
			}).catch(function(error) {
				winston.error("Couldnt load streams list: "+error);
			});
		}
	});
}




// end of API
module.exports = API;







/*
	API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level){
		
	},
	function(error) {
		
	});
*/

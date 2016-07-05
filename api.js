var messagecompressor = require('./messagecompressor');

function API(settings, db, bot, io) {
	this.settings = settings;
	this.db = db;
	this.bot = bot;
	this.io = io;
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
var allowedsettings = ["active","viewlogs","viewcomments","writecomments","deletecomments"];
API.prototype.updateSettings = function(channel, settings) {
	
}

// gets logs for a user.
// query is an object with the properties {id: string, nick: string, before: int, after: int}
// if ID is specified (!== undefined) it gives the "before" messages (default 10) before the message with the given ID
// and the "after" messages (default 10) after the message with the given ID
// otherwise, it gives the newest "before" messages
// if a nick is specified, it only returns messages by that user
API.prototype.getLogs = function(channel, query, callback) {
	var self = this;
	if(query.id) { 
		var id = parseInt(query.id);
		self.db.getLogsById(channel, id, query.nick, Math.min(parseInt(query.before || 10),100), Math.min(parseInt(query.after || 10),100), function(before, after){
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
			}
			for(var i=0;i<after.length;++i) {
				after[i].text = messagecompressor.decompressMessage("#"+channel, after[i].nick, after[i].text);
			}
			if(query.nick) {
				self.db.getUserStats(channel, query.nick, function(userobj) {
					callback({id:id, user: userobj, before: before, after: after});
				});
			}
			else {
				callback({id:id, before: before, after: after});
			}
		});
	}
	else if(query.nick) {
		self.db.getLogsByNick(channel, query.nick, Math.min(parseInt(query.before || 10), 100), function(before){
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
			}
			self.db.getUserStats(channel, query.nick, function(userobj) {
				callback({id:id, user: userobj, before: before, after: []});
			});
		});
	}
	else 
	{
		callback({"error":"Missing both parameters nick and id."});
	}
}

API.prototype.setIntegration = function(channelObj, newintegration, callback) {
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
				// update the connection
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
		// add the connection
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
					self.db.updateComment(channelObj.name, newcomment.id, newcomment.text);
					// only send back stuff needed for identification and changes
					var time = Math.floor(Date.now()/1000);
					self.io.to("comments-"+channelObj.name+"-"+comment.topic).emit("comment-update", {id: newcomment.id, edited: time, text: newcomment.text, topic: comment.topic});
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
				self.io.to("comments-"+channelObj.name+"-"+newcomment.topic).emit("comment-add", {id: id, added: time, edited: time, channel: channelObj.name, author: username, topic: newcomment.topic, text: newcomment.text});
			});
			callback();
		} else {
			callback({"status":403, "message":"Cannot write comments for this channel"});
			return;
		}
	}
}




// end of API
module.exports = API;







/*
	API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level){
		
	},
	function(error) {
		
	});
*/
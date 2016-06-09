var settings = require('./settings.json');

var util = require('util');

var winston = require('winston');
var strftime = require('strftime');
winston.level = 'debug';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { level: 'debug', handleExceptions: true, humanReadableUnhandledException: true });
if(settings.logging.file) winston.add(winston.transports.File, { filename: strftime(settings.logging.file), level: 'info', handleExceptions: true, humanReadableUnhandledException: true });

var request = require('request');
var url = require('url');
var _ = require("lodash");

var express = require('express');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser')
var app = express();
var server = require('http').Server(app);
var messagecompressor = require('./messagecompressor');
server.listen(8080);




// websocket server
var io = require('socket.io')(server);

// set up subscriptions
io.sockets.on('connection', function(socket){
	socket.token = "";
	
	socket.on('token', function(token) { 
		if(token && typeof(token)==="string") {
			socket.logviewer_token = token;
		}
	});
	
	socket.on('search', function(query) {
		if(query.user && query.user.length > 3) {
			var channel = query.channel.toLowerCase();
			var user = query.user.toLowerCase();
			db.getActiveChannel(channel, function(channelObj) {
				if(!channelObj)
				{
					// bad search. will disconnect the client (since this channel doesnt exist/isnt active)
					winston.warn("Bad search with query "+query);
					socket.disconnect();
					return;
				}
				var requiredlevel;
				getLevel(channelObj.name, socket.logviewer_token, function(level){
					if(level >= channelObj.viewlogs) {
						db.findUser(channelObj.name, user, function(users){
							if(users && users.length < 10) socket.emit("search", {search: query.user, users: users});
							else socket.emit("search", {search: query.user, users: null});
						});
					} else {
						winston.debug("Access to user search denied. "+socket.logviewer_token);
					}
				});
			});
		}
	});
	
	socket.on('subscribe', function(room) { 
		if(room && typeof(room)==="string") {
			channel_user = room.split("-");
			
			if(channel_user.length === 2) {
				var channel = channel_user[0].toLowerCase();
				var user = channel_user[1].toLowerCase();
				db.getActiveChannel(channel, function(channelObj) {
					if(!channelObj)
					{
						// bad join. will disconnect the client (since this channel doesnt exist/isnt active)
						winston.warn("Bad join to room "+room);
						socket.disconnect();
						return;
					}
					var requiredlevel;
					getLevel(channelObj.name, socket.logviewer_token, function(level){
						if(level >= channelObj.viewlogs) {
							var logsroom = "logs-"+channelObj.name+"-"+user;
							winston.debug('joining room', logsroom);
							socket.join(logsroom); 
						} else {
							winston.debug("Access to logs denied. "+socket.logviewer_token);
							// ignore the join
						}
						if(level >= channelObj.viewcomments) {
							var commentsroom = "comments-"+channelObj.name+"-"+user;
							winston.debug('joining room', commentsroom);
							socket.join(commentsroom); 
						} else {
							winston.debug("Access to comments denied. "+socket.logviewer_token);
							// ignore the join request
						}
					});
				});
			}
		}
	});

	socket.on('unsubscribe', function(room) {
		if(room && typeof(room)==="string") {
			channel_user = room.split("-");
			
			if(channel_user.length === 2) {
				var channel = channel_user[0].toLowerCase();
				var user = channel_user[1].toLowerCase();
				db.getActiveChannel(channel, function(channelObj) {
					if(!channelObj)
					{
						// bad leave. Do nothing (this room has already been left, see down below)
						return;
					}
					var logsroom = "logs-"+channelObj.name+"-"+user;
					socket.leave(logsroom);
					var commentsroom = "comments-"+channelObj.name+"-"+user;
					socket.leave(commentsroom);
				});
			}
		}
		winston.debug('leaving room', room);
		socket.leave(room); 
	});
});


// HTTP server and database connector
// Middleware
app.use(compression());
app.set('view engine', 'jade');
app.use('/html', express.static("./html"));
app.use(cookieParser());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
var databaseconnector = require("./db/"+settings.database.type);
var db = new databaseconnector(settings.database);
var lvbot = require("./bot");
var bot = new lvbot(settings, db, io);
function absMax(){
	var best=0;
	for(var i=0;i<arguments.length;++i){
		if(Math.abs(best) < Math.abs(arguments[i])) best = arguments[i];
	}
	return best;
}

function getUserLevel(channel,name,callback) {
	var reslvl = null;
	var templvl = 0;
	if(bot.userlevels[channel] && bot.userlevels[channel][name]) templvl = bot.userlevels[channel][name];
	if(channel == name) templvl = 10;
	db.getUserLevel(channel, name, function(lv){
		if(reslvl === null) {
			reslvl = lv;
		} else {
			callback(absMax(1,reslvl,lv,templvl));
		}
	});
	db.getUserLevel("logviewer", name, function(lv){
		if(reslvl === null) {
			reslvl = lv;
		} else {
			callback(absMax(1,reslvl,lv,templvl));
		}
	});
}	

// currently unused
function setUserLevel(channel, user, level, save) {
	if(userlevels[channel] === undefined) userlevels[channel] = {};
	bot.userlevels[channel][user] = level;
	if(save) db.setUserLevel(channel, user, level);
}


// HTTP server routes 'n shit
function checkAuth(req, res, callback) {
	var user = req.cookies.login;
	var token = req.cookies.token;
	if(user !== undefined && token !== undefined) {
		db.checkAndRefreshToken(user, token, ~~(Date.now()/1000)+32*24*3600, function(ok){
			if(ok) {
				res.cookie('token',token,{ maxAge: 32*24*3600000 });
				res.cookie('login',user,{ maxAge: 32*24*3600000 });
			} else {
				res.clearCookie('token');
				res.clearCookie('login');
			}
			if(callback)callback(ok);
		});
	} else {
		callback(false);
	}
}

function getLevel(channel, token, callback) {
	if(!token || token === "") callback(0);
	else {
		db.getAuthUser(token, function(name){
			if(name) {
				getUserLevel(channel,name,function(level){
					callback(level,name);
				});
			} else callback(0,null);
		});
	}
}

function generateToken(res, username, callback) {
	require('crypto').randomBytes(32, function(err, buffer) {
		var token = buffer.toString("hex");
		db.storeToken(username, token, ~~(Date.now()/1000)+32*24*3600);
		res.cookie('token',token,{ maxAge: 32*24*3600000 });
		res.cookie('login',username,{ maxAge: 32*24*3600000 });
		callback();
	});
}

app.get('/', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.sendFile(__dirname + settings.index.html);
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api',function(req,res,next) {
	try {
		if(req.query.token){
			db.getAuthUser(req.query.token, function(name){
				if(name){
					res.jsonp({
						name: name,
						valid: true,
						auth: {
							client_id: settings.auth.client_id,
							baseurl: settings.auth.baseurl
						}
					});
				}
				else res.status(404).jsonp({
					name: null,
					valid: false,
					auth: {
						client_id: settings.auth.client_id,
						baseurl: settings.auth.baseurl
					}
				});
			});
		} else {
			res.jsonp({
				name: null,
				valid: false,
				auth: {
					client_id: settings.auth.client_id,
					baseurl: settings.auth.baseurl
				}
			});
		}
	}
	catch(err) {
		next(err);
	}
});

app.get('/lv/', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.redirect(301, '/');
		});
	} 
	catch(err) {
		next(err);
	}
});
app.get('/logviewer/', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.redirect(301, '/');
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/lv/:channel', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.redirect(301, '/'+encodeURIComponent(req.params.channel.toLowerCase()));
		});
	} 
	catch(err) {
		next(err);
	}
});
app.get('/logviewer/:channel', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.redirect(301, '/'+encodeURIComponent(req.params.channel.toLowerCase()));
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/:channel', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.sendFile(__dirname + settings.index.html);
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/:channel/settings', function(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.sendFile(__dirname + settings.index.html);
		});
	} 
	catch(err) {
		next(err);
	}
});



app.get('/api/login', function(req, res, next) {
	try {
		var getToken = function(err,httpResponse,body) {
			var token = JSON.parse(body).access_token;
			request.get({
				url: "https://api.twitch.tv/kraken/?oauth_token="+token+"&client_id="+settings.auth.client_id
			},function(e,r,body2){
				if(body2 === undefined) {
					winston.error("Error: "+r.statusCode);
					getToken(err,r,body);
				} else {
					var auth = JSON.parse(body2).token;
					if(auth.valid) {
						generateToken(res, auth.user_name, function(){
							res.redirect(url.parse(req.query.state).path);
						});
					} else {
						res.status(500).end("Invalid token");
					}
				}
			});
		}
		request.post({
				url: 'https://api.twitch.tv/kraken/oauth2/token',
				form: {
					client_id: settings.auth.client_id,
					client_secret: settings.auth.client_secret,
					grant_type: "authorization_code",
					redirect_uri: settings.auth.baseurl + "/api/login",
					code: req.query.code,
					state: req.query.state
				}
			},
			getToken
		);
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/logout',function(req,res,next) {
	try {
		if(req.query.token === req.cookies.token) {
			db.deleteToken(req.query.token);
			res.clearCookie('token');
			res.clearCookie('login');
			res.status(200).end();
		} else {
			res.status(400).jsonp({"error":"Missing, mismatching or invalid token"});
		}
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/channel/:channel', function(req, res, next) {
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				getLevel(channel, req.query.token, function(level, user){
					res.jsonp({"channel":null,"me":{name:user, level:level, valid: !!user}});
				});
				return;
			}
			getLevel(channelObj.name, req.query.token, function(level, user){
				res.jsonp({"channel":channelObj,"me":{name:user, level:level, valid: !!user}});
			});
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/channels', function(req, res, next) {
	try {
		db.getChannels(function(r) {
			res.jsonp(r);
		});
	} 
	catch(err) {
		next(err);
	}
});


function isNormalInteger(str) {
	var n = ~~Number(str);
	return String(n) === str && n >= 0;
}

function getLogs(channel, query, callback) {
	if(query.id) { 
		var id = parseInt(query.id);
		db.getLogsById(channel, id, query.nick, Math.min(parseInt(query.before || 10),100), Math.min(parseInt(query.after || 10),100), function(before, after){
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
			}
			for(var i=0;i<after.length;++i) {
				after[i].text = messagecompressor.decompressMessage("#"+channel, after[i].nick, after[i].text);
			}
			if(query.nick) {
				db.getUserStats(channel, query.nick, function(userobj) {
					callback({id:id, user: userobj, before: before, after: after});
				});
			}
			else {
				callback({id:id, before: before, after: after});
			}
		});
	}
	else if(query.nick) {
		db.getLogsByNick(channel, query.nick, Math.min(parseInt(query.before || 10), 100), function(before){
			for(var i=0;i<before.length;++i) {
				before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
			}
			db.getUserStats(channel, query.nick, function(userobj) {
				callback({id:id, user: userobj, before: before, after: []});
			});
		});
	}
	else 
	{
		callback({"error":"Missing both parameters nick and id."});
	}
}

app.get('/api/logs/:channel', function(req, res, next) {
	try {
		var channel = req.params.channel.toLowerCase();
		db.getActiveChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			if(channelObj.viewlogs > 0) {
				getLevel(channelObj.name, req.query.token, function(level){
					if(level >= channelObj.viewlogs) {
						getLogs(channelObj.name, req.query, function(logs){
							res.jsonp(logs);
						});
					} else {
						res.status(403).end();
					}
				});
			} else {
				getLogs(channelObj.name, req.query, function(logs){
					res.jsonp(logs);
				});
			}
		});
	} 
	catch(err) {
		next(err);
	}
});
var allowedsettings = ["active","viewlogs","viewcomments","writecomments","deletecomments"];
app.post('/api/settings/:channel', function(req, res, next) {
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				// add a new channel
				getLevel(channel, req.body.token, function(level){
					if(level >= 10) {
						db.addChannel(channel, function() {
							var newsettings = req.body.settings;
							for(var i=0;i<allowedsettings.length;++i) {
								var key = allowedsettings[i];
								if(!isNaN(parseInt(newsettings[key]))) {
									db.setSetting(channel, key, newsettings[key]);
								}
								res.status(200).end();
								if(key === "active") {
									if(newsettings.active == "1") bot.joinChannel(channel);
									else bot.partChannel(channel);
								}
							}
						});
					} else {
						res.status(403).end();
					}
				});
			} else {
				getLevel(channelObj.name, req.body.token, function(level){
					if(level >= 10) {
						var newsettings = req.body.settings;
						for(var i=0;i<allowedsettings.length;++i) {
							var key = allowedsettings[i];
							if(!isNaN(parseInt(newsettings[key]))) {
								db.setSetting(channelObj.name, key, newsettings[key]);
							}
							res.status(200).end();
							if(key === "active") {
								if(newsettings.active == "1") bot.joinChannel(channelObj.name);
								else bot.partChannel(channelObj.name);
							}
						}
					} else {
						res.status(403).end();
					}
				});
			}
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/levels/:channel',function(req,res,next){
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			getLevel(channelObj.name, req.query.token, function(level){
				if(level >= 10) {
					db.getLevels(channelObj.name,function(levels) {
						res.jsonp(levels);
					});
				} else {
					res.status(403).end();
				}
			});
		});
	} 
	catch(err) {
		next(err);
	}
});

app.post('/api/levels/:channel',function(req,res,next){
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			getLevel(channelObj.name, req.body.token, function(level){
				if(level >= 10) {
					var newlevels = req.body.levels;
					for(var i=0;i<newlevels.length;++i) {
						var userObject = newlevels[i];
						if(Math.abs(userObject.level) <= level && /^\w+$/.test(userObject.nick)) {
							db.setLevel(channelObj.name,userObject.nick.toLowerCase(),userObject.level);
						}
					}
					res.status(200).end();
				} else {
					res.status(403).end();
				}
			});
		});
	}
	catch(err) {
		next(err);
	}
	
});

// comments
app.get('/api/comments/:channel', function(req,res,next){
	try {
		var channel = req.params.channel.toLowerCase();
		db.getActiveChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			getLevel(channelObj.name, req.query.token, function(level){
				if(level >= channelObj.viewcomments) {
					db.getComments(channelObj.name,req.query.topic,function(comments) {
						res.jsonp(comments || []);
					});
				} else {
					res.status(403).end();
				}
			});
		});
	} 
	catch(err) {
		next(err);
	}
});

app.post('/api/comments/:channel',function(req,res,next){
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			var newsettings = req.body;
			getLevel(channelObj.name, newsettings.token, function(level, nick){
				if(newsettings.id) {
					// we are editing a comment
					db.getComment(channelObj.name, newsettings.id, function(comment){
						if(comment) {
							// only people with the edit permission can delete other peoples comments
							if(level >= channelObj.editcomments || comment.author == nick) {
								db.updateComment(channelObj.name, newsettings.id, newsettings.text);
								// only send back stuff needed for identification and changes
								var time = Math.floor(Date.now()/1000);
								io.to("comments-"+channelObj.name+"-"+comment.topic).emit("comment-update", {id: newsettings.id, edited: time, text: newsettings.text, topic: comment.topic});
								res.status(200).end();
							} else {
								res.status(403).jsonp({"error":"Can only edit own comments"});
								return;
							}
						} else {
							res.status(404).jsonp({"error":"Comment not found"});
						}
					});
				} else {
					if(newsettings.topic === undefined) {
						res.status(400).jsonp({"error":"Missing parameter topic."});
					} else if(newsettings.text === undefined) {
						res.status(400).jsonp({"error":"Missing parameter text."});
					} else if(level >= channelObj.writecomments) {
						var time = Math.floor(Date.now()/1000);
						db.addComment(channelObj.name, nick, newsettings.topic, newsettings.text, function(id){
							io.to("comments-"+channelObj.name+"-"+newsettings.topic).emit("comment-add", {id: id, added: time, edited: time, channel: channelObj.name, author: nick, topic: newsettings.topic, text: newsettings.text});
						});
						res.status(200).end();
					} else {
						res.status(403).jsonp({"error":"Cannot write comments for this channel"});
						return;
					}
				}
			});
		});
	}
	catch(err) {
		next(err);
	}
	
});

app.delete('/api/comments/:channel',function(req,res,next){
	try {
		var channel = req.params.channel.toLowerCase();
		db.getChannel(channel, function(channelObj) {
			if(!channelObj)
			{
				res.status(404).jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			if(req.query.id === undefined) {
				res.status(400).jsonp({"error":"Missing parameter id."});
			} else {
				getLevel(channelObj.name, req.query.token, function(level, nick){
					db.getComment(channelObj.name, req.query.id, function(comment){
						if(!comment) {
							res.status(404).jsonp({"error":"Comment not found"});
							return;
						}
						// only people with the deletion permission can delete other peoples comments
						if(level >= channelObj.deletecomments || comment.author == nick) { 
							db.deleteComment(channelObj.name, req.query.id);
							io.to("comments-"+channelObj.name+"-"+comment.topic).emit("comment-delete", {id: req.query.id, topic: comment.topic});
							res.status(200).end();
							return;
						} else {
							res.status(403).jsonp({"error":"Can only delete own comments"});
							return;
						}
					});
				});
			}
			
		});
	}
	catch(err) {
		next(err);
	}
	
});

var badgeCache = {};
var channelIDCache = {};

function getChannelID(channel, callback) {
	if(channelIDCache[channel]) {
		callback(channelIDCache[channel]);
	} else {
		request.get({
			url: "https://api.twitch.tv/kraken/channels/"+channel+"/?client_id="+settings.auth.client_id
		},function(e,r,body){
			if(body === undefined) {
				winston.error("Error: "+r.statusCode);
			} else {
				try {
					var channelInfo = JSON.parse(body);
					channelIDCache[channel] = channelInfo._id;
					callback(channelInfo._id);
				} catch(e) {
					winston.error("Error: not a json string in getChannelID. Returned HTTP status code: "+r.statusCode);
					callback(0);
				}
			}
		});
	}
}


var defaultbadges = {"badge_sets":{"admin":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/3","description":"Twitch Admin","title":"Twitch Admin","click_action":"none","click_url":""}}},"broadcaster":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3","description":"Broadcaster","title":"Broadcaster","click_action":"none","click_url":""}}},"global_mod":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/3","description":"Global Moderator","title":"Global Moderator","click_action":"none","click_url":""}}},"moderator":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3","description":"Moderator","title":"Moderator","click_action":"none","click_url":""}}},"staff":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/3","description":"Twitch Staff","title":"Twitch Staff","click_action":"none","click_url":""}}},"subscriber":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/3","description":"Subscriber","title":"Subscriber","click_action":"subscribe_to_channel","click_url":""}}},"turbo":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/3","description":"Turbo","title":"Turbo","click_action":"turbo","click_url":""}}},"warcraft":{"versions":{"alliance":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/3","description":"For Lordaeron!","title":"Alliance","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"},"horde":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/3","description":"For the Horde!","title":"Horde","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"}}}}};
function getBadges(resource, callback) {
	// cache expires after 1 hour
	var expired = Date.now() - 1000 * 3600;
	if(badgeCache[resource] && badgeCache[resource].time > expired) {
		callback(badgeCache[resource].badges);
	} else {
		winston.debug("Getting "+resource+" badges "+"https://badges.twitch.tv/v1/badges/"+resource+"/display?language=en&client_id="+settings.auth.client_id);
		request.get({
			url: "https://badges.twitch.tv/v1/badges/"+resource+"/display?language=en&client_id="+settings.auth.client_id
		},function(e,r,body){
			if(body === undefined) {
				winston.error("Error: "+r.statusCode);
			} else {
				try {
					var badges = JSON.parse(body);
					badgeCache[resource] = {
						time: Date.now(),
						badges: badges
					}
					callback(badges);
				} catch(e) {
					winston.error("Error: not a json string in getBadges. Returned HTTP status code: "+r.statusCode);
					callback(defaultbadges);
				}
			}
		}, function(){
			winston.error("Couldnt load "+resource+" badges");
			callback({});
		});
	}
}

// badges. Fix for the crappy twitch API
app.get('/api/badges/:channel', function(req,res,next){
	try {
		getChannelID(req.params.channel, function(id) {
			getBadges("global", function(globalBadges){
				getBadges("channels/"+id, function(channelBadges){
					res.jsonp(_.merge(_.cloneDeep(globalBadges), channelBadges));
				});
			});
		});
	} 
	catch(err) {
		next(err);
	}
});


app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.send("<pre>"+err.stack+"\r\n"+err.message+"</pre>");
	winston.error(err);
});
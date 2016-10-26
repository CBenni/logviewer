var settings = require('./settings.json');

var util = require('util');

var winston = require('winston');
var strftime = require('strftime');
winston.level = 'debug';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { level: settings.logging.console.level, handleExceptions: true, humanReadableUnhandledException: true });
if(settings.logging.file) winston.add(winston.transports.File, { filename: strftime(settings.logging.file.filename), level: settings.logging.file.level, handleExceptions: true, humanReadableUnhandledException: true });

var request = require('request');
var url = require('url');
var _ = require("lodash");

var express = require('express');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var messagecompressor = require('./messagecompressor');
var app = express();
var server = require('http').Server(app);
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
				API.getLevel(channelObj.name, socket.logviewer_token, function(level){
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
			var room_split = room.split("-");
			if(room_split[0] === "logs") {
				var channel = room_split[1].toLowerCase();
				var user = room_split[2].toLowerCase();
				API.getChannelObjAndLevel(channel, socket.logviewer_token, function(error, channelObj, level){
					if(error)
					{
						// bad join. will disconnect the client (since this channel doesnt exist/isnt active)
						winston.warn("Bad join to room "+room + ": "+error.message);
						//socket.emit("error", error);
						return;
					}
					if(level >= channelObj.viewmodlogs) {
						var logsroom = "logs-"+channelObj.name+"-"+user+"-modlogs";
						winston.debug('joining room', logsroom);
						socket.join(logsroom); 
					} else if(level >= channelObj.viewlogs) {
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
			} else if (room_split[0] == "events") {
				var channel = room_split[1].toLowerCase();
				API.getChannelObjAndLevel(channel, socket.logviewer_token, function(error, channelObj, level){
					if(level >= 10) {
						var logsroom = "events-"+(channelObj?channelObj.name:channel);
						winston.debug('joining room', logsroom);
						socket.join(logsroom); 
					} else {
						winston.debug("Access to events denied. "+socket.logviewer_token);
						// ignore the join
					}
				});
			}
		}
	});

	socket.on('unsubscribe', function(room) {
		if(room && typeof(room)==="string") {
			var room_split = room.split("-");
			
			if(room_split[0] == "logs") {
				var channel = room_split[1].toLowerCase();
				var user = room_split[2].toLowerCase();
				db.getChannel(channel, function(channelObj) {
					if(channelObj) channel = channelObj.name;
					var logsroom = "logs-"+channel+"-"+user;
					var modlogsroom = "logs-"+channel+"-"+user+"-modlogs";
					winston.debug('leaving room', logsroom);
					winston.debug('leaving room', modlogsroom);
					socket.leave(logsroom);
					socket.leave(modlogsroom);
					var commentsroom = "comments-"+channel+"-"+user;
					winston.debug('leaving room', commentsroom);
					socket.leave(commentsroom);
				});
			} else if (room_split[0] == "events") {
				var channel = room_split[1].toLowerCase();
				db.getChannel(channel, function(channelObj) {
					if(channelObj) channel = channelObj.name;
					var logsroom = "events-"+channel;
					winston.debug('leaving room', logsroom);
					socket.leave(logsroom);
				});
			}
		}
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

// enable CORS on the API
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
  next();
});

var databaseconnector = require("./db/"+settings.database.type);
var db = new databaseconnector(settings.database);
var lvbot = require("./bot");
var bot = new lvbot(settings, db, io);

var API = require("./api");
var API = new API(settings, db, bot, io);

bot.API = API;


// HTTP server routes 'n shit

// checks and updates the token cookie. DO NOT USE FOR SECURITY-RELATED ISSUES - vulnerable to XSRF
function checkAuth(req, res, callback) {
	var user = req.cookies.login;
	var token = req.cookies.token;
	if(user !== undefined && token !== undefined) {
		db.checkAndRefreshToken(user, token, ~~(Date.now()/1000)+32*24*3600, function(ok){
			if(ok) {
				res.cookie('token',token,{ maxAge: 32*24*3600000, secure: true });
				res.cookie('login',user,{ maxAge: 32*24*3600000, secure: true });
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
						},
						botname: settings.bot.nick
					});
				}
				else res.status(404).jsonp({
					name: null,
					valid: false,
					auth: {
						client_id: settings.auth.client_id,
						baseurl: settings.auth.baseurl
					},
					botname: settings.bot.nick
				});
			});
		} else {
			res.jsonp({
				name: null,
				valid: false,
				auth: {
					client_id: settings.auth.client_id,
					baseurl: settings.auth.baseurl
				},
				botname: settings.bot.nick
			});
		}
	}
	catch(err) {
		next(err);
	}
});

// generates a cryptographically safe token
function generateToken(res, username, callback) {
	require('crypto').randomBytes(32, function(err, buffer) {
		var token = buffer.toString("hex");
		// expires in 31 days
		db.storeToken(username, token, Math.floor(Date.now()/1000)+31*24*3600);
		res.cookie('token',token,{ maxAge: 32*24*3600000, secure: true });
		res.cookie('login',username,{ maxAge: 32*24*3600000, secure: true });
		callback();
	});
}


// callback for twitchs OAuth2 endpoint
app.get('/api/login', function(req, res, next) {
	try {
		var getToken = function(err,httpResponse,body) {
			if(err || httpResponse.statusCode != 200) {
				winston.error("Error getting access token: "+httpResponse.statusCode+"\r\n"+err);
				res.end("Error getting access token: "+httpResponse.statusCode+"\r\n"+err);
			} else {
				var token = JSON.parse(body).access_token;
				request.get({
					url: "https://api.twitch.tv/kraken/?oauth_token="+token+"&client_id="+settings.auth.client_id
				},function(e,r,body2){
					if(e || body2 === undefined || r.statusCode != 200) {
						winston.error("Error getting oauth token: "+r.statusCode+"\r\n"+e);
						res.end("Error getting oauth token: "+r.statusCode+"\r\n"+e);
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

// logout api
app.get('/api/logout',function(req,res,next) {
	try {
		// check csrf
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

/*
	try {
		API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
			if(error) {
				res.status(error.status).jsonp({"error": error.message});
			} else {
			}
		});
	}
	catch(err) {
		next(err);
	}
*/

// gets channel info
app.get('/api/channel/:channel', function(req, res, next) {
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.query.token, function(error, channelObj, level, username) {
				if(!channelObj) channelObj = {
					name: channelname,
					active: 0,
					modlogs: 0,
					viewlogs: 0,
					viewmodlogs: 5,
					viewcomments: 5,
					writecomments: 5,
					deletecomments: 10
				}
				// check if the logviewer bot is modded
				bot.isModded(channelObj, function(isModded){
					channelObj.isModded = isModded;
					res.jsonp({"channel":channelObj,"me":{name:username, level:level, valid: !!username}});
				});
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	} 
	catch(err) {
		next(err);
	}
});


// checks if the user is a moderator
app.get('/api/checkmodded/:channel', function(req, res, next) {
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.query.token, function(error, channelObj, level, username) {
				// check if the logviewer bot is modded
				if(!channelObj) channelObj = {name: channelname}
				bot.isModded(channelObj, function(isModded){
					res.jsonp({isModded: isModded});
				}, true);
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/channels', function(req, res, next) {
	try {
		db.getChannelList(function(r) {
			res.jsonp(r);
		});
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/logs/:channel', function(req, res, next) {
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.query.token, function(error, channelObj, level, username) {
				if(error) {
					res.status(error.status).jsonp({"error": error.message});
				} else if(channelObj.active) {
					// level check.
					if(level >= channelObj.viewlogs) {
						API.getLogs(channelObj, req.query, level >= channelObj.viewmodlogs, function(logs){
							res.jsonp(logs);
						});
					} else {
						res.status(403).end();
					}
				} else {
					res.status(505).jsonp({"error": "Channel "+channelname+" not found."});
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	} 
	catch(err) {
		next(err);
	}
});


var knownChannels = {};
function getChannelID(channelname, callback) {
	if(knownChannels[channelname]) {
		callback(null, knownChannels[channelname]);
		return;
	}
	request.get({
		url: "https://api.twitch.tv/kraken/channels/"+channelname+"?client_id="+settings.auth.client_id
	},function(e,r,body){
		if(e) {
			winston.error(e);
			callback(e);
		} else if(body === undefined) {
			winston.error("Error: "+r.statusCode);
			callback("Error: "+r.statusCode);
		} else {
			try {
				var id = JSON.parse(body)._id;
				knownChannels[channelname] = id;
				callback(null, id);
			} catch(e) {
				winston.error("Error: "+e+" in getChannelID("+channelname+").");
				if(callback) callback(e);
			}
		}
	}, function(error){
		winston.error("Couldnt load "+channelname+"'s channel ID.\nError: "+error);
		if(callback) callback(error);
	});
}

// change the settings of a channel
// body is a JSON object with the allowedsettings ["active","viewlogs","viewcomments","writecomments","deletecomments"] as keys
var allowedsettings = ["active","viewlogs","viewcomments","writecomments","deletecomments"];
app.post('/api/settings/:channel', function(req, res, next) {
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.body.token, function(error, channelObj, level, username) {
				if(level >= 10) {
					if(!channelObj)
					{
						// add a new channel
						getChannelID(channelname, function(e, id) {
							if(e) {
								winston.error(e);
								res.status(500).jsonp({"error": e});
							} else {
								API.adminLog(channelname, username, "channel", "add", id);
								db.addChannel({id: id, name: channelname}, function(channelObj) {
									var newsettings = req.body.settings;
									API.updateSettings(channelObj, username, newsettings, function(error) {
										if(error) {
											res.status(error.status).jsonp({"error": error.message});
										} else {
											res.status(200).end();
										}
									});
								});
							}
						});
					} else {
						var newsettings = req.body.settings;
						API.updateSettings(channelObj, username, newsettings, function(error) {
							if(error) {
								res.status(error.status).jsonp({"error": error.message});
							} else {
								res.status(200).end();
							}
						});
					}
				} else {
					res.status(403).end();
				}
			}); 
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	} 
	catch(err) {
		next(err);
	}
});

// gets the custom-set userlevels for the channel
app.get('/api/levels/:channel',function(req,res,next){
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.query.token, function(error, channelObj, level, username){
				if(error && error.status != 404) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					if(level >= 10) {
						if(channelObj) {
							db.getLevels(channelObj.name,function(levels) {
								res.jsonp(levels);
							});
						} else {
							res.jsonp([]);
						}
					} else {
						res.status(403).end();
					}
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
});

// updates the custom userlevels on a channel
app.post('/api/levels/:channel',function(req,res,next){
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(channelname, req.body.token, function(error, channelObj, level, username){
				if(error) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					if(level >= 10) {
						var newlevels = req.body.levels;
						for(var i=0;i<newlevels.length;++i) {
							var userObject = newlevels[i];
							if(Math.abs(userObject.level) <= level && /^\w+$/.test(userObject.nick)) {
								API.adminLog(channelObj.name, username, "level", userObject.nick, userObject.level);
								db.setLevel(channelObj.name,userObject.nick.toLowerCase(),userObject.level);
							}
						}
						res.status(200).end();
					} else {
						res.status(403).end();
					}
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
	
});
/*
app.get('/api/connections/:channel',function(req,res,next){
	try {
		API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
			if(error) {
				res.status(error.status).jsonp({"error": error.message});
			} else {
				if(level >= 10) {
					db.getConnections(channelObj.name,function(connections) {
						res.jsonp(connections);
					});
				} else {
					res.status(403).end();
				}
			}
		});
	}
	catch(err) {
		next(err);
	}
});

// create or update a new app integration
app.post('/api/integrations/:channel',function(req,res,next){
	try {
		API.getChannelObjAndLevel(req.params.channel, req.body.token, function(error, channelObj, level, username){
			if(error) {
				res.status(error.status).jsonp({"error": error.message});
			} else {
				if(level >= 10) {
					var newintegration = req.body.integration;
					API.setIntegration(channelObj, newintegration, function(error) {
					});
				} else {
					res.status(403).end();
				}
			}
		});
	}
	catch(err) {
		next(err);
	}
});

// remove an app connection
app.delete('/api/integrations/:channel',function(req,res,next){
	try {
		API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
			if(error) {
				res.status(error.status).jsonp({"error": error.message});
			} else {
				if(level >= 10) {
					db.removeConnection(channelObj.name, req.query.id, function(erorr) {
						res.jsonp(connections);
					});
				} else {
					res.status(403).end();
				}
			}
		});
	}
	catch(err) {
		next(err);
	}
});*/

// comments
app.get('/api/comments/:channel', function(req,res,next){
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
				if(error) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					if(level >= channelObj.viewcomments) {
						db.getComments(channelObj.name,req.query.topic,function(comments) {
							res.jsonp(comments || []);
						});
					} else {
						res.status(403).end();
					}
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
});

app.post('/api/comments/:channel',function(req,res,next){
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(req.params.channel, req.body.token, function(error, channelObj, level, username){
				if(error) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					var newcomment = req.body.comment;
					API.setComment(channelObj, level, username, newcomment, function(error){
						if(error) {
							res.status(error.status).jsonp({"error": error.message});
						} else {
							res.status(200).end();
						}
					})
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
});

app.delete('/api/comments/:channel',function(req,res,next){
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
				if(error) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					db.getComment(channelObj.name, req.query.id, function(comment){
						if(!comment) {
							res.status(404).jsonp({"error":"Comment not found"});
							return;
						}
						// only people with the deletion permission can delete other peoples comments
						if(level >= channelObj.deletecomments || comment.author == username) {
							API.adminLog(channelObj.name, username, "comment", "delete", JSON.stringify(comment));
							db.deleteComment(channelObj.name, req.query.id);
							io.to("comments-"+channelObj.name+"-"+comment.topic).emit("comment-delete", comment);
							res.status(200).end();
						} else {
							res.status(403).jsonp({"error":"Can only delete own comments"});
						}
					});
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
	
});

app.get('/api/events/:channel', function(req, res, next) {
	try {
		var channelname = req.params.channel.toLowerCase();
		if(/^\w+$/.test(channelname)) {
			API.getChannelObjAndLevel(req.params.channel, req.query.token, function(error, channelObj, level, username){
				if(error && error.status != 404) {
					res.status(error.status).jsonp({"error": error.message});
				} else {
					if(level >= 10) {
						if(channelObj) {
							var eventCount = Math.max(req.query.limit || 25, 50);
							db.getEvents(channelObj.name,eventCount, function(events) {
								res.jsonp(events);
							});
						} else {
							res.jsonp([]);
						}
					} else {
						res.status(403).end();
					}
				}
			});
		} else {
			res.status(400).jsonp({error: "Invalid channel name "+channelname});
		}
	}
	catch(err) {
		next(err);
	}
});

var badgeCache = {};


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
					winston.error("Error: not a json string in getBadges("+resource+"). Returned HTTP status code: "+r.statusCode);
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
		getChannelID(req.params.channel, function(error, id) {
			if(error) {
				res.status(400).jsonp({error: error});
			} else {
				getBadges("global", function(globalBadges){
					getBadges("channels/"+id, function(channelBadges){
						res.jsonp(_.merge(_.cloneDeep(globalBadges), channelBadges));
					});
				});
			}
		});
	} 
	catch(err) {
		next(err);
	}
});

// slack custom plugin
// command: /lv <user> [channel] [limit]
var levels = {0: "everyone", 1: "log in", 5: "moderator", 7: "super-moderator", 10: "bradcaster/editor"}

var STATE_V3 = 1
var STATE_PREFIX = 2
var STATE_COMMAND = 3
var STATE_PARAM = 4
var STATE_TRAILING = 5


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

function plainTextify(channel, user, logs){
	var reply = "";
	var now = Math.floor(Date.now()/1000);
	if(logs.before.length > 0) {
		reply = "Here are the logs for " + user + " in " + channel + 
			" ("+logs.user.messages+" messages, "+logs.user.timeouts+" timeouts)\n```";
		for(var i=0;i<logs.before.length;++i) {
			var line = logs.before[i];
			reply += "\n[" + formatTimespan(now - line.time) + " ago] " + user + ": "
				+ messagecompressor.parseIRCMessage(line.text)[STATE_TRAILING];
		}
		reply += "```\n";
	} else {
		reply += "```No logs found for user "+user+" in channel "+channel+"```\n";
	}
	return reply;
}

function plainTextifyComments(channel, user, comments){
	var reply = "";
	var now = Math.floor(Date.now()/1000);
	if(comments && comments.length > 0) {
		for(var i=0;i<comments.length;++i) {
			if(reply) reply += "\n";
			var comment = comments[i];
			reply += "Comment by "+comment.author+" (" + (comment.added == comment.edited?"added":"edited") + " " 
				+ formatTimespan(now - comment.edited) + " ago)\n";
			reply += "```"+comment.text+"```";
		}
	}
	return reply;
}

function getSlackLogs(channel, user, limit, token, cb, ecb) {
	try {
		var channel = channel.toLowerCase();
		var query = {nick: user, before: parseInt(limit) || 10, token: token};
		API.getChannelObjAndLevel(channel, token, function(error, channelObj, level, username) {
			if(error)
			{
				ecb(error.status, error.message);
				return;
			} else {
				if(level >= channelObj.viewlogs) {
					var logtext = false;
					var commenttext = false;
					var seemoretext = 'See ' + settings.auth.baseurl + "/" + encodeURIComponent(channel) + "/?user=" + encodeURIComponent(user);
					API.getLogs(channelObj, query, false, function(logs){
						logtext = plainTextify(channel, user, logs)
						if(commenttext !== false) cb(logtext+"\n"+commenttext+"\n"+seemoretext);
					});
					if(level >= channelObj.viewlogs) {
						db.getComments(channelObj.name, user, function(comments) {
							commenttext = plainTextifyComments(channel, user, comments);
							if(logtext !== false) cb(logtext+"\n"+commenttext+"\n"+seemoretext);
						});
					} else {
						commenttext = "";
					}
				} else {
					var dsplevel = levels[channelObj.viewlogs] || "unknown ("+channelObj.viewlogs+")";
					ecb(403,"Access denied. Logs are "+dsplevel+" level - please configure your lvtoken accordingly.");
				}
			}
		});
	} 
	catch(err) {
		ecb(500, "Error: "+err);
	}
}

app.get('/api/slack/', function(req,res,next){
	var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
	console.log("Slack request: "+fullUrl);
	var default_channel = req.query.default_channel;
	var params = [];
	if(req.query.text) params = req.query.text.split(" ");
	var token = req.query.lvtoken;
	if(params.length == 0) {
		res.status(400).end("Error: Missing user name");
	} else if(params.length == 1) {
		if(default_channel) {
			getSlackLogs(default_channel, params[0], 10, token, function(data){
				res.end(data);
			}, function(status, error) { res.status(status).end(error); });
		} else {
			res.status(400).end("Error: Missing channel name and no default channel set.");
		}
	} else if(params.length == 2) {
		if(/^\d+$/.test(params[1])) {
			// 2nd param is the limit
			if(default_channel) {
				getSlackLogs(default_channel, params[0], params[1], token, function(data){
					res.end(data);
				}, function(status, error) { res.status(status).end(error); });
			} else {
				res.status(400).end("Error: Missing channel name and no default channel set.");
			}
		} else {
			// 2nd param is the channel
			getSlackLogs(params[1], params[0], 10, token, function(data){
				res.end(data);
			}, function(status, error) { res.status(status).end(error); });
		}
	} else if(params.length == 3) {
		if(/^\d+$/.test(params[1])) {
			// 2nd param is the limit
			if(default_channel) {
				getSlackLogs(params[2], params[0], params[1], token, function(data){
					res.end(data);
				}, function(status, error) { res.status(status).end(error); });
			} else {
				res.status(400).end("Error: Missing channel name and no default channel set.");
			}
		} else if(/^\d+$/.test(params[2])) {
			// 3nd param is the limit
			getSlackLogs(params[1], params[0], params[2], token, function(data){
				res.end(data);
			}, function(status, error) { res.status(status).end(error); });
		} else {
			// no limit specified
			res.status(400).end("Error: Unexpected parameter "+params[2]);
		}
	} else {
		res.status(400).end("Error: Too many parameters!");
	}
});

app.post('/api/token', function(req, res, next) {
	try {
		API.getChannelObjAndLevel("logviewer", req.body.token, function(error, channelObj, level, adminname){
			if(error && error.status != 404) {
				res.status(error.status).jsonp({"error": error.message});
			} else {
				if(level >= 50) {
					require('crypto').randomBytes(32, function(err, buffer) {
						var token = buffer.toString("hex");
						var expires = Math.floor(Date.now()/1000)+(parseInt(req.body.duration) || 24*3600);
						var username = req.body.user.toLowerCase();
						db.storeToken(username, token, expires);
						API.adminLog(adminname, adminname, "system", "token", "generated token for "+username);
						res.jsonp({token: token , username: username, expires: expires});
					});
				} else {
					res.status(403).end();
				}
			}
		});
	}
	catch(err) {
		next(err);
	}
});

function serveOnePage(req, res, next) {
	try {
		checkAuth(req, res, function(){
			res.sendFile(__dirname + settings.index.html);
		});
	} 
	catch(err) {
		next(err);
	}
}

function redirectLegacy(req, res, next) {
	try {
		checkAuth(req, res, function(){
			var channel = req.params.channel;
			res.redirect(301, '/'+(channel?encodeURIComponent(channel.toLowerCase()):""));
		});
	} 
	catch(err) {
		next(err);
	}
}

app.get('/', serveOnePage);
app.get('/:channel', serveOnePage);
app.get('/lv/', redirectLegacy);
app.get('/logviewer/', redirectLegacy);
app.get('/lv/:channel', redirectLegacy);
app.get('/:channel/:page', serveOnePage);



app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.send("<pre>"+err.stack+"\r\n"+err.message+"</pre>");
	winston.error(err);
});

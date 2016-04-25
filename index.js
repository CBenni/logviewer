var jsonfile = require('jsonfile');
var util = require('util');
var request = require('request');
var url = require('url');

var express = require('express');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var messagecompressor = require('./messagecompressor');
var ircbot = require('./ircbot');
var bot = new ircbot("irc.chat.twitch.tv", 80);
server.listen(8080);



var TAGS = 1
var PREFIX = 2
var COMMAND = 3
var PARAM = 4
var TRAILING = 5

// Middleware
app.use(compression());
app.set('view engine', 'jade');
app.use('/static', express.static("./html"));
app.use(cookieParser());
// no need for a database for settings, its all direct accesses anyways.
var settings = require('./settings.json');

var databaseconnector = require("./db/"+settings.database.type);
var db = new databaseconnector(settings.database);

function joinChannel(channel) {
	settings.channels[channel] = settings.channels[channel] || {};
	bot.send("JOIN "+channel);
	db.ensureTablesExist(channel.slice(1));
}
var userlevels = {};
function setUserLevel(channel, user, level, save) {
	if(userlevels[channel] === undefined) userlevels[channel] = {};
	userlevels[channel][user] = level;
	if(save) db.setUserLevel(channel, user, level);
}

function absMax(x,y){return Math.abs(x)>=Math.abs(y)?x:y}
function getUserLevel(channel, user, callback) {
	var reslevel = 0;
	if(userlevels[channel] && userlevels[channel][user] !== undefined) {
		reslevel = userlevels[channel][user];
	}
	db.getUserLevel(channel,user,function(lv){
		if(channel == "logviewer") callback(absMax(reslevel,lv));
		else {
			getUserLevel("logviewer",user,function(lv2){
				callback(absMax(absMax(reslevel,lv2),lv1));
			});
		}
	});
}

bot.on("connect", function(){
	bot.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
	bot.send("NICK justinfan1");
	for(var key in settings.channels) {
		joinChannel(key);
	}
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
	var channel = data[PARAM];
	var text = data[TRAILING];
	console.log(channel + " <" + user +"> " + text);
	
	db.addLine(channel.slice(1), user, messagecompressor.compressMessage(user, data));
	if(user === "twitchnotify" || user === "gdqsubs") {
		var m = newsubregex.exec(text) || resubregex.exec(text);
		if(m) {
			db.addLine(channel.slice(1), m[1].toLowerCase(), "dtwitchnotify "+text);
		}
	}
});

bot.on("CLEARCHAT", function(data){
	var user = data[TRAILING];
	var channel = data[PARAM];
	console.log(channel + " <" + user +" has been timed out>");
	db.addTimeout(channel.slice(1), user, "djtv <" + user +" has been timed out>");
});

bot.connect();


// HTTP server routes 'n shit
function checkAuth(req, res, callback) {
	var user = req.cookies.login;
	var token = req.cookies.token;
	if(user !== undefined && token !== undefined) {
		db.checkAndRefreshToken(user, token, ~~(Date.now()/1000)+32*24*3600, function(ok){
			if(ok) {
				res.cookie('tk',token,{ maxAge: 2500000 });
				res.cookie('login',username,{ maxAge: 2500000 });
			} else {
				res.clearCookie('tk');
				res.clearCookie('login');
			}
			if(callback)callback(ok);
		});
	}
}

function getLevel(channel, token, callback) {
	db.getAuthUser(token, function(name){
		db.getLevel(channel, name, callback);
	});
}

// Returns true if the user (as specified by the token) can perform a certain action
/*function canPerform(channel, token, action, callback) {
	getLevel(channel, token, function(){
		
	});
}*/

function generateToken(res, username) {
	require('crypto').randomBytes(48, function(err, buffer) {
		var token = buffer.toString('base64');
		db.storeToken(username, token, ~~(Date.now()/1000)+32*24*3600);
		res.cookie('tk',token,{ maxAge: 2500000 });
		res.cookie('login',username,{ maxAge: 2500000 });
	});
}

app.get('/', function(req, res, next) {
	try {
		checkAuth(req, res);
		res.sendFile(__dirname + '/html/index.html');
	} 
	catch(err) {
		next(err);
	}
});
app.get('/:channel', function(req, res, next) {
	try {
		checkAuth(req, res);
		res.sendFile(__dirname + '/html/index.html');
	} 
	catch(err) {
		next(err);
	}
});
app.get('/:channel/settings', function(req, res, next) {
	try {
		checkAuth(req, res);
		res.sendFile(__dirname + '/html/index.html');
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/login', function(req, res, next) {
	try {
		request.post({
				url: 'https://api.twitch.tv/kraken/oauth2/token',
				form: {
					client_id: settings.twitch_auth.client_id,
					client_secret: settings.twitch_auth.client_secret,
					grant_type: "authorization_code",
					redirect_uri: url.resolve(settings.twitch_auth.base_url,"api/login"),
					code: req.params.code,
					state: req.params.state
				}
			},
			function(err,httpResponse,body) {
				var token = JSON.parse(body).access_token;
				request.get({
					url: "https://api.twitch.tv/kraken/?oauth_token="+token
				},function(e,r,body2){
					var auth = JSON.parse(body2).token;
					if(auth.valid) {
						generateToken(res, auth.username);
						res.redirect(url.parse(req.params.state).path);
					}
				});
			}
		);
	} 
	catch(err) {
		next(err);
	}
});

app.get('/api/channel/:channel', function(req, res, next) {
	try {
		db.getChannel(req.params.channel, function(channelObj) {
			if(channelObj.viewlogs > 0) {
				getLevel(req.params.channel, )
			} else {
				res.jsonp(channelObj);
			}
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

app.get('/api/logs/:channel', function(req, res, next) {
	try {
		var channel = req.params.channel;
		db.getChannel(channel,function(channelObject){
			if(!channelObject)
			{
				res.jsonp({"error":"Channel "+channel+" not found."});
				return;
			}
			if(req.query.id) {
				var id = parseInt(req.query.id);
				db.getLogsById(channel, id, req.query.nick, parseInt(req.query.before || 10), parseInt(req.query.after || 10), function(before, after){
					for(var i=0;i<before.length;++i) {
						before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
					}
					for(var i=0;i<after.length;++i) {
						after[i].text = messagecompressor.decompressMessage("#"+channel, after[i].nick, after[i].text);
					}
					if(req.query.nick) {
						db.getUserStats(channel, req.query.nick, function(userobj) {
							res.jsonp({id:id, user: userobj, before: before, after: after});
						});
					}
					else {
						res.jsonp({id:id, before: before, after: after});
					}
				});
			}
			else if(req.query.nick) {
				db.getLogsByNick(channel, req.query.nick, parseInt(req.query.before) || 10, function(before){
					for(var i=0;i<before.length;++i) {
						before[i].text = messagecompressor.decompressMessage("#"+channel, before[i].nick, before[i].text);
					}
					db.getUserStats(channel, req.query.nick, function(userobj) {
						res.jsonp({id:id, user: userobj, before: before, after: []});
					});
				});
			}
			else 
			{
				res.jsonp({"error":"Missing both parameters nick and id."});
			}
		});
	} 
	catch(err) {
		next(err);
	}
});

app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.send("<pre>"+err.stack+"\r\n"+err.message+"</pre>");
	console.log(err);
});
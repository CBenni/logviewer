var jsonfile = require('jsonfile');
var util = require('util');

var express = require('express');
var compression = require('compression');
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
// no need for a database for settings, its all direct accesses anyways.
var settings = require('./settings.json');

var databaseconnector = require("./db/"+settings.database.type);
var db = new databaseconnector(settings.database);

function joinChannel(channel) {
	settings.channels[channel] = settings.channels[channel] || {};
	bot.send("JOIN "+channel);
	db.ensureTablesExist(channel.slice(1));
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


app.get('/', function(req, res) {
	try {
		res.sendFile(__dirname + '/html/index.html');
	} 
	catch(err) {
		next(err);
	}
});
app.get('/:channel', function(req, res) {
	try {
		res.sendFile(__dirname + '/html/index.html');
	} 
	catch(err) {
		next(err);
	}
});


app.get('/api/channels', function(req, res, next) {
	try {
		res.jsonp(Object.keys(settings.channels));
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
		if(!channel || settings.channels["#"+channel] === undefined)
		{
			res.jsonp({"error":"Channel "+channel+" not found."});
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
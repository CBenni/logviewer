var mysql = require('mysql');

module.exports = function MySQLDatabaseConnector(settings) {
	var self = this;
	self.pool = mysql.createPool({
		connectionLimit: 100,
		host: settings.host,
		port: settings.port || 3306,
		user: settings.user,
		database: settings.database,
		password: settings.password,
		charset: "utf8mb4_unicode_ci"
	});
	self.pool.getConnection(function(err, connection) {
		if(err) {
			console.error('Error connecting to MySQL database: ' + err.stack);
			return;
		}
		// create the channels table if it doesnt exist
		connection.query("CREATE TABLE IF NOT EXISTS channels ("
		  +"name varchar(32) COLLATE utf8_unicode_ci PRIMARY KEY,"
		  +"active tinyint(4) unsigned NOT NULL DEFAULT '1',"
		  +"viewlogs tinyint(4) unsigned NOT NULL DEFAULT '0',"
		  +"viewcomments tinyint(4) unsigned NOT NULL DEFAULT '5',"
		  +"writecomments tinyint(4) unsigned NOT NULL DEFAULT '5',"
		  +"deletecomments tinyint(4) unsigned NOT NULL DEFAULT '10',"
		  +"`max-age` int(10) unsigned NOT NULL DEFAULT '2678400'"
		+")");
		// create the auth table if it doesnt exist
		connection.query("CREATE TABLE IF NOT EXISTS auth ("
		  +"token varchar(64) PRIMARY KEY,"
		  +"name varchar(32),"
		  +"expires BIGINT unsigned"
		+")");
		// create the comment table if it doesnt exist
		connection.query("CREATE TABLE IF NOT EXISTS comments ("
			+"id INT NOT NULL AUTO_INCREMENT,"
			+"added BIGINT UNSIGNED NOT NULL,"
			+"edited BIGINT UNSIGNED NOT NULL,"
			+"channel VARCHAR(32) NULL,"
			+"author VARCHAR(32) NULL,"
			+"topic VARCHAR(64) NULL,"
			+"text TEXT NULL,"
			+"PRIMARY KEY (id),"
			+"INDEX comments_by_channel_and_topic (channel ASC, topic ASC)"
		+")");
		// create the alias table if it doesnt exist
		connection.query("CREATE TABLE IF NOT EXISTS aliases ("
		  +"alias varchar(32) PRIMARY KEY,"
		  +"name varchar(32)"
		+")");
		
		// create the logviewer tables if they dont exist
		connection.query("CREATE TABLE IF NOT EXISTS chat_logviewer ("
			+"id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
			+"time BIGINT UNSIGNED NOT NULL,"
			+"nick VARCHAR(32) NOT NULL,"
			+"text VARCHAR(2047) NOT NULL,"
			+"INDEX (nick, time)"
		+")");
		connection.query("CREATE TABLE IF NOT EXISTS users_logviewer ("
			+"nick VARCHAR(32) NOT NULL PRIMARY KEY,"
			+"messages INT UNSIGNED DEFAULT '0',"
			+"timeouts INT UNSIGNED DEFAULT '0',"
			+"level INT DEFAULT '0'"
		+")");

	});
	
	self.ensureTablesExist = function(channel) {
		self.pool.query("CREATE TABLE IF NOT EXISTS chat_"+channel+" ("
			+"id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
			+"time BIGINT UNSIGNED NOT NULL,"
			+"nick VARCHAR(32) NOT NULL,"
			+"text VARCHAR(2047) NOT NULL,"
			+"INDEX (nick, time)"
		+")");
		self.pool.query("CREATE TABLE IF NOT EXISTS users_"+channel+" ("
			+"nick VARCHAR(32) NOT NULL PRIMARY KEY,"
			+"messages INT UNSIGNED DEFAULT '0',"
			+"timeouts INT UNSIGNED DEFAULT '0',"
			+"level INT DEFAULT '0'"
		+")");
	}
	
	self.getChannels = function(callback) {
		self.pool.query("SELECT name FROM channels WHERE active=1",function(error, results, fields){
			callback(results);
		});
	}
	
	self.getActiveChannel = function(channel, callback) {
		self.pool.query("SELECT * FROM channels WHERE name=? AND active=1",[channel],function(error, results, fields){
			if(results.length == 0) {
				self.pool.query("SELECT name FROM aliases WHERE alias=?",[channel],function(error, results, fields){
					if(results.length == 0) {
						callback(null);
					} else {
						self.getActiveChannel(results[0].name, callback);
					}
				});
			}
			else callback(results[0]);
		});
	}
	
	self.getChannel = function(channel, callback) {
		self.pool.query("SELECT * FROM channels WHERE name=?",[channel],function(error, results, fields){
			if(results.length == 0) {
				self.pool.query("SELECT name FROM aliases WHERE alias=?",[channel],function(error, results, fields){
					if(results.length == 0) {
						callback(null);
					} else {
						self.getChannel(results[0].name, callback);
					}
				});
			}
			else callback(results[0]);
		});
	}
	
	self.addChannel = function(channel, callback) {
		self.ensureTablesExist(channel);
		self.pool.query("INSERT INTO channels (name) VALUES (?)",[channel],function(error, results, fields){
			callback();
		});
	}
	
	self.addLine = function(channel, nick, message, count) {
		self.pool.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		if(count !== false) self.pool.query("INSERT INTO ?? (nick,messages) VALUES (?,1) ON DUPLICATE KEY UPDATE messages = messages + 1",["users_"+channel, nick,nick]);
	}
	
	self.addTimeout = function(channel, nick, message) {
		self.pool.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		self.pool.query("INSERT INTO ?? (nick,timeouts) VALUES (?,1) ON DUPLICATE KEY UPDATE timeouts = timeouts + 1",["users_"+channel, nick, nick]);
	}
	
	self.getLogsByNick = function(channel, nick, limit, callback) {
		self.pool.query("SELECT id,time,nick,text FROM ?? WHERE nick=? ORDER BY time DESC LIMIT ?", ["chat_"+channel, nick, limit], function(error, results, fields) {
			if(results) callback(results.reverse());
			else callback([]);
		});
	}
	
	self.getLogsById = function(channel, id, nick, before, after, callback) {
		var beforeRes = null;
		var afterRes = null;
		// before
		if(before > 0) {
			if(nick) {
				self.pool.query("SELECT id,time,nick,text FROM ?? WHERE nick=? AND id < ? ORDER BY id DESC LIMIT ?", ["chat_"+channel, nick, id, before], function(error, results, fields) {
					if(results) beforeRes = results.reverse();
					if(afterRes !== null) callback(beforeRes, afterRes);
				});
			} else {
				self.pool.query("SELECT id,time,nick,text FROM ?? WHERE id < ? ORDER BY id DESC LIMIT ?", ["chat_"+channel, id, before], function(error, results, fields) {
					if(results) beforeRes = results.reverse();
					if(afterRes !== null) callback(beforeRes, afterRes);
				});
			}
		} else { beforeRes = []; }
		// after
		if(after > 0) {
			if(nick) {
				self.pool.query("SELECT id,time,nick,text FROM ?? WHERE nick=? AND id > ? ORDER BY id ASC LIMIT ?", ["chat_"+channel, nick, id, after], function(error, results, fields) {
					if(results) afterRes = results;
					if(beforeRes !== null) callback(beforeRes, afterRes);
				});
			} else {
				self.pool.query("SELECT id,time,nick,text FROM ?? WHERE id > ? ORDER BY id ASC LIMIT ?", ["chat_"+channel, id, after], function(error, results, fields) {
					if(results) afterRes = results;
					if(beforeRes !== null) callback(beforeRes, afterRes);
				});
			}
		} else { afterRes = []; if(beforeRes !== null) callback(beforeRes, afterRes); }
	}
	
	self.getUserStats = function(channel, nick, callback) {
		self.pool.query("SELECT nick, messages, timeouts FROM ?? WHERE nick = ?", ["users_"+channel, nick], function(error, results, fields) {
			callback(results[0] || {nick: nick, timeouts:0, messages: 0});
		});
	}
	
	self.getAuthUser = function(token, callback) {
		self.pool.query("SELECT name FROM auth WHERE token=? AND expires > ?",[token,Math.floor(Date.now()/1000)], function(error, results, fields) {
			if(results && results.length>0) callback(results[0].name);
			else callback(null);
		});
	}
	
	self.getUserLevel = function(channel, nick, callback) {
		self.pool.query("SELECT level FROM ?? WHERE nick = ?", ["users_"+channel, nick], function(error, results, fields) {
			if(results && results.length>0) callback(results[0].level || 0);
			else callback(0);
		});
	}
	
	self.setLevel = function(channel, nick, level) {
		self.pool.query("INSERT INTO ?? (nick,level) VALUES (?,?) ON DUPLICATE KEY UPDATE level = ?",["users_"+channel, nick, level, level, nick]);
	}
	
	self.getLevels = function(channel, callback) {
		self.pool.query("SELECT nick,level FROM ?? WHERE level != 0", ["users_"+channel], function(error, results, fields) {
			callback(results);
		});
	}
	
	self.storeToken = function(user, token, expires) {
		self.pool.query("INSERT INTO auth (name, token, expires) VALUES (?,?,?)",[user,token,expires]);
	}
	
	self.deleteToken = function(token) {
		self.pool.query("DELETE FROM auth WHERE token=?",[token]);
	}
	
	self.checkAndRefreshToken = function(user, token, expires, callback) {
		self.pool.query("UPDATE auth SET expires=? WHERE name=? AND token=? AND expires > ?",[expires,user,token,Math.floor(Date.now()/1000)], function(error, result) {
			callback(result.affectedRows > 0);
		});
	}
	
	self.setSetting = function(channel, key, val) {
		self.pool.query("UPDATE channels SET ??=? WHERE name=?",[key,val,channel]);
	}
	
	self.getComments = function(channel,topic,callback) {
		self.pool.query("SELECT * FROM comments WHERE channel=? AND topic=?",[channel,topic],function(error,results,fields) {
			callback(results);
		});
	}
	
	self.getComment = function(channel,id,callback) {
		self.pool.query("SELECT * FROM comments WHERE id=? AND channel=?",[id,channel],function(error,results,fields) {
			callback(results[0]);
		});
	}
	
	self.addComment = function(channel,author,topic,text) {
		var d = Math.floor(Date.now()/1000);
		self.pool.query("INSERT INTO comments(added,edited,channel,author,topic,text) VALUES (?,?,?,?,?,?)", [d,d,channel,author,topic,text]);
	}
	
	self.updateComment = function(channel,id,newtext) {
		self.pool.query("UPDATE comments SET text=?, edited=? WHERE id=? AND channel=?",[newtext,Math.floor(Date.now()/1000),id,channel]);
	}
	
	self.deleteComment = function(channel,id) {
		self.pool.query("DELETE FROM comments WHERE id=? AND channel=?",[id,channel]);
	}
}


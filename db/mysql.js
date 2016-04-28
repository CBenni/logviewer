var mysql = require('mysql');

module.exports = function MySQLDatabaseConnector(settings) {
	var self = this;
	self.connection = mysql.createConnection({
		host: settings.host,
		port: settings.port || 3306,
		user: settings.user,
		database: settings.database,
		password: settings.password,
		charset: "utf8mb4_unicode_ci"
	});
	self.connection.connect(function(err) {
		if(err) {
			console.error('Error connecting to MySQL database: ' + err.stack);
			return;
		}
		// create the channels column if it doesnt exist
		self.connection.query("CREATE TABLE IF NOT EXISTS channels ("
		  +"name varchar(32) COLLATE utf8_unicode_ci PRIMARY KEY,"
		  +"active tinyint(4) unsigned NOT NULL DEFAULT '1',"
		  +"viewlogs tinyint(4) unsigned NOT NULL DEFAULT '0',"
		  +"viewcomments tinyint(4) unsigned NOT NULL DEFAULT '5',"
		  +"writecomments tinyint(4) unsigned NOT NULL DEFAULT '5',"
		  +"deletecomments tinyint(4) unsigned NOT NULL DEFAULT '10',"
		  +"`max-age` int(10) unsigned NOT NULL DEFAULT '2678400'"
		+") ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;");

	});
	
	self.ensureTablesExist = function(channel) {
		self.connection.query("CREATE TABLE IF NOT EXISTS chat_"+channel+" ("
			+"id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
			+"time BIGINT UNSIGNED NOT NULL,"
			+"nick VARCHAR(32) NOT NULL,"
			+"text VARCHAR(2047) NOT NULL,"
			+"INDEX (nick, time)"
		+") ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;");
		self.connection.query("CREATE TABLE IF NOT EXISTS users_"+channel+" ("
			+"nick VARCHAR(32) NOT NULL PRIMARY KEY,"
			+"messages INT UNSIGNED DEFAULT '0',"
			+"timeouts INT UNSIGNED DEFAULT '0'"
		+") ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;");
	}
	
	self.getChannels = function(callback) {
		self.connection.query("SELECT name FROM channels WHERE active=1",function(error, results, fields){
			callback(results);
		});
	}
	
	self.getActiveChannel = function(channel, callback) {
		self.connection.query("SELECT * FROM channels WHERE name=? AND active=1",[channel],function(error, results, fields){
			callback(results[0]);
		});
	}
	
	self.getChannel = function(channel, callback) {
		self.connection.query("SELECT * FROM channels WHERE name=?",[channel],function(error, results, fields){
			callback(results[0]);
		});
	}
	
	self.addLine = function(channel, nick, message, count) {
		self.connection.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		if(count !== false) self.connection.query("INSERT INTO ?? (nick,messages) VALUES (?,1) ON DUPLICATE KEY UPDATE messages = messages + 1 WHERE nick=?",["users_"+channel, nick,nick]);
	}
	
	self.addTimeout = function(channel, nick, message) {
		self.connection.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		self.connection.query("INSERT INTO ?? (nick,timeouts) VALUES (?,1) ON DUPLICATE KEY UPDATE timeouts = timeouts + 1 WHERE nick=?",["users_"+channel, nick, nick]);
	}
	
	self.getLogsByNick = function(channel, nick, limit, callback) {
		self.connection.query("SELECT id,time,nick,text FROM ?? WHERE nick=? ORDER BY time DESC LIMIT ?", ["chat_"+channel, nick, limit], function(error, results, fields) {
			if(results) callback(results.reverse());
			else return [];
		});
	}
	
	self.getLogsById = function(channel, id, nick, before, after, callback) {
		var beforeRes = null;
		var afterRes = null;
		// before
		if(before > 0) {
			if(nick) {
				self.connection.query("SELECT id,time,nick,text FROM ?? WHERE nick=? AND id < ? ORDER BY id DESC LIMIT ?", ["chat_"+channel, nick, id, before], function(error, results, fields) {
					if(results) beforeRes = results.reverse();
					if(afterRes !== null) callback(beforeRes, afterRes);
				});
			} else {
				self.connection.query("SELECT id,time,nick,text FROM ?? WHERE id < ? ORDER BY id DESC LIMIT ?", ["chat_"+channel, id, before], function(error, results, fields) {
					if(results) beforeRes = results.reverse();
					if(afterRes !== null) callback(beforeRes, afterRes);
				});
			}
		} else { beforeRes = []; }
		// after
		if(after > 0) {
			if(nick) {
				self.connection.query("SELECT id,time,nick,text FROM ?? WHERE nick=? AND id > ? ORDER BY id ASC LIMIT ?", ["chat_"+channel, nick, id, after], function(error, results, fields) {
					if(results) afterRes = results;
					if(beforeRes !== null) callback(beforeRes, afterRes);
				});
			} else {
				self.connection.query("SELECT id,time,nick,text FROM ?? WHERE id > ? ORDER BY id ASC LIMIT ?", ["chat_"+channel, id, after], function(error, results, fields) {
					if(results) afterRes = results;
					if(beforeRes !== null) callback(beforeRes, afterRes);
				});
			}
		} else { afterRes = []; if(beforeRes !== null) callback(beforeRes, afterRes); }
	}
	
	self.getUserStats = function(channel, nick, callback) {
		self.connection.query("SELECT nick, messages, timeouts FROM ?? WHERE nick = ?", ["users_"+channel, nick], function(error, results, fields) {
			callback(results[0] || {nick: nick, timeouts:0, messages: 0});
		});
	}
	
	self.getAuthUser = function(token, callback) {
		self.connection.query("SELECT name FROM auth WHERE token=? AND expires > ?",[token,~~(Date.now()/1000)], function(error, results, fields) {
			if(results.length>0) callback(results[0].name);
			else return null;
		});
	}
	
	self.getUserLevel = function(channel, nick, callback) {
		self.connection.query("SELECT level FROM ?? WHERE nick = ?", ["users_"+channel, nick], function(error, results, fields) {
			callback(results[0] || 0);
		});
	}
	
	self.setUserLevel = function(channel, nick, level) {
		if(count !== false) self.connection.query("INSERT INTO ?? (nick,level) VALUES (?,?) ON DUPLICATE KEY UPDATE level = ? WHERE nick=?",["users_"+channel, nick, level, level, nick]);
	}
	
	self.storeToken = function(user, token, expires) {
		self.connection.query("INSERT INTO auth (name, token, expires) VALUES (?,?,?)",[user,token,expires]);
	}
	
	self.checkAndRefreshToken = function(user, token, expires, callback) {
		self.connection.query("UPDATE auth SET expires=? WHERE name=? AND token=? AND expires > ?",[expires,user,token,~~(Date.now()/1000)], function(error, result) {
			callback(result.affectedRows > 0);
		});
	}
	
	self.setSetting = function(channel, key, val) {
		self.connection.query("UPDATE channels SET ??=? WHERE name=?",[key,val,channel]);
	}
}


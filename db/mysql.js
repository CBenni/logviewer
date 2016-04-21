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
	});
	
	self.ensureTablesExist = function(channel) {
		self.connection.query("CREATE TABLE IF NOT EXISTS chat_"+channel+" ("
			+"id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
			+"time BIGINT UNSIGNED NOT NULL,"
			+"nick VARCHAR(32) NOT NULL,"
			+"text VARCHAR(2047) NOT NULL,"
			+"INDEX (nick, time)"
		+")");
		self.connection.query("CREATE TABLE IF NOT EXISTS users_"+channel+" ("
			+"nick VARCHAR(32) NOT NULL PRIMARY KEY,"
			+"messages INT UNSIGNED DEFAULT '0',"
			+"timeouts INT UNSIGNED DEFAULT '0'"
		+")");
	}
	self.addLine = function(channel, nick, message, count) {
		self.connection.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		if(count !== false) self.connection.query("INSERT INTO ?? (nick,messages) VALUES (?,1) ON DUPLICATE KEY UPDATE messages = messages + 1",["users_"+channel, nick]);
	}
	
	self.addTimeout = function(channel, nick, message) {
		self.connection.query("INSERT INTO ?? (time,nick,text) VALUES (?,?,?)",["chat_"+channel, Math.floor(Date.now()/1000), nick, message]);
		self.connection.query("INSERT INTO ?? (nick,timeouts) VALUES (?,1) ON DUPLICATE KEY UPDATE timeouts = timeouts + 1",["users_"+channel, nick]);
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
}


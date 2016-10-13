var winston = require('winston');

var TAGS = 1
var PREFIX = 2
var COMMAND = 3
var PARAM = 4
var TRAILING = 5

function toTitleCase(str)
{
	return str.replace(/([^a-z0-9]|\b)[a-z]/g,function(x){return x.toUpperCase()});
}

function compressEmotes(emotes) {
	/*
	* Compresses the emotes tag
	*	 2:0-1,3-4,12-13,18-19,21-22
	*	is compressed to
	*	 2:1,0,3,12,18,21
	*	so the format is
	*	 emote1id:length1,start1,start2,start3:length2,start4,start5/emote2id:length3,start6
	*/
	var res = "";
	var emotesplit = emotes.split("/");
	for(var i=0;i<emotesplit.length;++i) {
		var startpositions = {}
		var emoteid_positions = emotesplit[i].split(":");
		var emoteid = emoteid_positions[0];
		if(res) res += "/";
		res += emoteid;
		var positions = emoteid_positions[1].split(",");
		for(var j=0;j<positions.length;++j) {
			var start_end = positions[j].split("-");
			var start = parseInt(start_end[0]);
			var end = parseInt(start_end[1]);
			var length = end-start;
			if(startpositions[length] === undefined)startpositions[length] = ""+start;
			else startpositions[length] += ","+start;
		}
		var startposkeys = Object.keys(startpositions);
		for(var k=0;k<startposkeys.length;++k) {
			var length = startposkeys[k];
			res += ":"+length+","+startpositions[length];
		}
	}
	return res;
}

function decompressEmotes(emotes) {
	/*
	* Decompresses the emotes tag
	*	 2:1,0,3:2,12,18,21
	*	is decompressed to
	*	 2:0-1,3-4,12-14,18-20,21-23
	*/
	var res = "";
	var emotesplit = emotes.split("/");
	for(var i=0;i<emotesplit.length;++i) {
		var emoteid_positions = emotesplit[i].split(":");
		var emoteid = emoteid_positions[0];
		if(res) res += "/";
		res += emoteid+":";
		var first = true;
		for(var j=1;j<emoteid_positions.length; ++j) {
			var positions = emoteid_positions[j].split(",");
			var length = parseInt(positions[0]);
			for(var k=1;k<positions.length;++k) {
				var start = parseInt(positions[k]);
				var end = start+length;
				if(!first) res += ",";
				first = false;
				res += start+"-"+end;
			}
		}
	}
	return res;
}


var copykeys = ["color","emotes","display-name","badges"];
var badgesdecompress = { "t": "turbo", "b": "broadcaster", "m": "moderator", "a": "admin", "s": "staff", "g": "global_mod", "h": "horde", "l": "alliance", "w": "warcraft" };
var badgescompress = {};
var badgekeys = Object.keys(badgesdecompress);
for(var i=0;i<badgekeys.length;++i) {
	var key = badgekeys[i];
	badgescompress[badgesdecompress[key]] = key;
}


var tagTypes = {"c":"color", "e": "emotes", "d": "display-name", "b": "badges", "m": "mod", "s": "subscriber", "t": "turbo", "u": "user-type", "l": "logs"};
var userTypesToBadges = { "m": "moderator/1", "a": "admin/1", "s": "staff/1" };

function compressMessage(user, data) {
	/*
	* Compresses a message. Format:
	* <ircv3info> <message>
	* where ircv3info is
	* <initial of key><value>
	* with emotes compressed
	*/
	var res = "";
	if(data[TAGS]) {
		var defaults = {"color":"","emotes":"","display-name":toTitleCase(user),"badges":""};
		for(var i=0;i<copykeys.length;++i) {
			var key = copykeys[i];
			var val = data[TAGS][key];
			if(val == undefined) {
				winston.error("ERRONEOUS TAG: "+data[0]);
				continue;
			}
			if(defaults[key] !== val) {
				if(key == "emotes") {
					val = compressEmotes(val);
				}
				else if(key == "display-name" && val==user) {
					val = "";
				} else if(key == "badges") {
					// compress badges
					var badges = val.split(",");
					val = "";
					for(var j=0;j<badges.length;++j) {
						var badge = badges[j].split("/");
						if(badge[0] == "broadcaster") continue; // no need for this one.
						if(val) val += ",";
						val += (badgescompress[badge[0]] || badge[0]) + "/" + ((badgescompress[badge[1]] || badge[1]) || "");
					}
				}
				if(res) res += ";";
				res += key[0]+val;
			}
		}
	}
	res += " "+data[TRAILING];
	return res;
}


function decompressMessage(channel, user, data) {
	var index = data.indexOf(' ');
	var tags = data.slice(0, index)
	if(tags === "") tags = [];
	else tags = tags.split(";");
	var message = data.slice(index + 1);
	var outTags = {"color":"","emotes":"","display-name": toTitleCase(user),"badges": ""};
	var badges = [];
	// decompress tags
	for(var i=0;i<tags.length;++i) {
		var key = tagTypes[tags[i][0]];
		var val = tags[i].slice(1);
		if(key == "emotes") val = decompressEmotes(val);
		else if(key == "display-name" && val=="") val = user;
		else if(key == "badges" && val) {
			// decompress badges 
			var compressedBadges = val.split(",");
			for(var j=0;j<compressedBadges.length;++j) {
				var badgeParts = compressedBadges[j].split("/");
				badge = (badgesdecompress[badgeParts[0]] || badgeParts[0]) + "/" + ((badgesdecompress[badgeParts[1]] || badgeParts[1]) || "");
				if(badges.indexOf(badge) < 0) badges.push(badge);
			}
		}
		else if(key == "user-type") {
			badge = userTypesToBadges[val];
			if(badges.indexOf(badge) < 0) badges.push(badge);
		}
		outTags[key] = val;
	}
	if(channel == "#"+user) {
		badge = "broadcaster/1";
		if(badges.indexOf(badge) < 0) badges.push(badge);
	}
	outTags.badges = badges.join(",");
	var res = "";
	var outTagKeys = Object.keys(outTags);
	for(var j=0; j<outTagKeys.length; ++j) {
		if(res) res += ";";
		var key = outTagKeys[j];
		if(outTags[key]) res += key+"="+outTags[key];
		else res += key+"=";
	}
	return "@"+res+" :"+user+"!"+user+"@"+user+".tmi.twitch.tv PRIVMSG "+channel+" :"+message;
}

var rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/;
var rx2 = /([^=;]+)=([^;]*)/g;
var rx3 = /\r\n|\r|\n/;
var STATE_V3 = 1
var STATE_PREFIX = 2
var STATE_COMMAND = 3
var STATE_PARAM = 4
var STATE_TRAILING = 5
function parseIRCMessage(message) {
	var data = rx.exec(message);
	if(data == null) {
		winston.error("Couldnt parse message '"+message+"'");
		return null;
	}
	var tagdata = data[STATE_V3];
	if (tagdata) {
		var tags = {};
		do {
			m = rx2.exec(tagdata);
			if (m) {
				tags[m[1]] = m[2];
			}
		} while (m);
		data[STATE_V3] = tags;
	}
	return data;
}

module.exports = {
	compressMessage: compressMessage,
	decompressMessage: decompressMessage,
	parseIRCMessage: parseIRCMessage
};



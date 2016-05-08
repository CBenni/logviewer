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


var copykeys = ["color","subscriber","turbo","user-type","emotes","display-name","mod"];
var userTypes = {"m":"mod","g":"global_mod","a":"admin","s":"staff"};

var tagTypes = {};
for(var tagid = 0; tagid < copykeys.length; ++tagid) {
	var tagname = copykeys[tagid];
	tagTypes[tagname[0]] = tagname;
}

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
		var defaults = {"color":"","subscriber":"0","turbo":"0","user-type":"","emotes":"", "display-name": toTitleCase(user),"mod":0};
		for(var i=0;i<copykeys.length;++i) {
			var key = copykeys[i];
			var val = data[TAGS][key];
			if(defaults[key] !== val) {
				if(key == "emotes") {
					val = compressEmotes(val);
				}
				else if(key == "user-type") {
					val = val[0];
				}
				else if(key == "display-name" && val==user) {
					val = "";
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
	var res = "";
	var defaults = {"color":"","subscriber":"0","turbo":"0","user-type":"","emotes":"", "display-name": toTitleCase(user),"mod":0};	
	// decompress tags
	for(var i=0;i<tags.length;++i) {
		var key = tagTypes[tags[i][0]];
		var val = tags[i].slice(1);
		if(key == "user-type") val = userTypes[val];
		else if(key == "emotes") val = decompressEmotes(val);
		else if(key == "display-name" && val=="") val = user;
		if(res) res += ";";
		res += key+"="+val;
		delete defaults[key];
	}
	var remainingkeys = Object.keys(defaults);
	for(var j=0; j<remainingkeys.length; ++j) {
		if(res) res += ";";
		res += remainingkeys[j]+"="+defaults[remainingkeys[j]];
	}
	return "@"+res+" :"+user+"!"+user+"@"+user+".tmi.twitch.tv PRIVMSG "+channel+" :"+message;
}

module.exports = {
	compressMessage: compressMessage,
	decompressMessage: decompressMessage,
};




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
var __raw = "@color=;display-name=Logviewer;emotes=;subscriber=0;turbo=0;mod=1;user-id=93914621;user-type= :logviewer!logviewer@logviewer.tmi.twitch.tv PRIVMSG #cbenni :test2";
console.log(__raw);
var __parsed = parseIRCMessage(__raw);
var __user = /\w+/.exec(__parsed[PREFIX])[0];
var __channel = __parsed[PARAM];
var __comp = compressMessage(__user, __parsed);
console.log(__comp);
var __roundtrip = decompressMessage(__channel, __user, __comp);
console.log(__roundtrip);
var __roundtrip2 = compressMessage(__user, parseIRCMessage(__roundtrip));
console.log("Roundtrip ",__roundtrip2 == __comp ? "successful": "failed");
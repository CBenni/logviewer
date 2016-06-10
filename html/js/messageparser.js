var rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/;
var rx2 = /([^=;]+)=([^;]*)/g;
var STATE_V3 = 1;
var STATE_PREFIX = 2;
var STATE_COMMAND = 3;
var STATE_PARAM = 4;
var STATE_TRAILING = 5;
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

function splitWithTail(str,delim,count){
	var parts = str.split(delim);
	var tail = parts.slice(count).join(delim);
	var result = parts.slice(0,count);
	result.push(tail);
	return result;
}

function getPrivmsgInfo(parsedmessage) {
	var tags = parsedmessage[STATE_V3] || {};
	var nick = parsedmessage[STATE_PREFIX].match(/(\w+)/)[1];
	var channel = parsedmessage[STATE_PARAM];
	var badges = [];
	if(tags.badges) badges = tags.badges.split(",");
	
	var text = parsedmessage[STATE_TRAILING];
	var isaction = false;
	var actionmatch = /^\u0001ACTION (.*)\u0001$/.exec(text);
	if(actionmatch != null) {
		isaction = true;
		text = actionmatch[1];
	}
	var emoteparsertext = text+"";
	var surrogates = [];
	
	for (var i = 0; i < emoteparsertext.length; ++i) {
		var charcode = emoteparsertext.charCodeAt(i);
		if (charcode <= 0xDBFF && charcode >= 0xD800) {
			surrogates.push([charcode, emoteparsertext.charCodeAt(i + 1)]);
			++i;
		}
	}
	// Replace surrogates while calculating emotes
	for (var i = 0; i < surrogates.length; ++i) {
		emoteparsertext = emoteparsertext.replace(String.fromCharCode(surrogates[i][0], surrogates[i][1]), String.fromCharCode(0xE000 + i));
	}
	
	
	var emotes = [];
	if(tags["emotes"]) {
		var emotelists = tags["emotes"].split("/");
		for(var i=0;i<emotelists.length;i++) {
			var emoteidpositions = emotelists[i].split(":")
			var emoteid = emoteidpositions[0];
			var positions = emoteidpositions[1].split(",");
			for(var j=0;j<positions.length;j++) {
				var startend = positions[j].split("-");
				var start = parseInt(startend[0]);
				var end = parseInt(startend[1]);
				
				emotes.push({"start":start,"end":end,"id":emoteid,"name":emoteparsertext.substring(start,end+1)});
			}
		}
	}
	
	return {
		"tags": tags,
		"nick": nick,
		"badges": badges,
		"channel": channel,
		"text": text,
		"textWithSurrogatesInPUAs": emoteparsertext,
		"surrogates": surrogates,
		"isaction": isaction,
		"emotes": emotes
	}
}


sdbmCode = function(str){
	var hash = 0;
	for (i = 0; i < str.length; i++) {
		char = str.charCodeAt(i);
		hash = char + (hash << 6) + (hash << 16) - hash;
	}
	return Math.abs(hash);
}

var entityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
};

function escapeHtml(string) {
	return String(string).replace(/[&<>"'\/]/g, function (s) {
		return entityMap[s];
	});
}

DEFAULTCOLORS = ['#e391b8', '#e091ce', '#da91de', '#c291db', '#ab91d9', '#9691d6', '#91a0d4', '#91b2d1', '#91c2cf', '#91ccc7', '#91c9b4', '#90c7a2', '#90c492', '#9dc290', '#aabf8f', '#b5bd8f', '#bab58f', '#b8a68e', '#b5998e', '#b38d8d']
function renderMessage(messageinfo, badges) {
	var result = ""
	for(var i=0;i<messageinfo.badges.length;i++) {
		var badgeid = messageinfo.badges[i].split("/");
		if(badgeid[0]) {
			var badgeinfo = badges.badge_sets[badgeid[0]].versions[badgeid[1]];
			if(badgeinfo) {
				result += '<img src="' + badgeinfo.image_url_1x + '" title="' + badgeinfo.title + '" class="logviewer-badge logviewer-badge-' + badgeid[0] + '">'
			}
		}
	}
	
	var color = messageinfo.tags["color"];
	if(color == "") {
		color = DEFAULTCOLORS[sdbmCode(messageinfo.nick)%(DEFAULTCOLORS.length)];
	}
	var display_name = messageinfo.tags["display-name"];
	if(display_name == "") {
		display_name = messageinfo.nick;
	}
	
	
	var message = messageinfo.textWithSurrogatesInPUAs;
	if(display_name == "jtv" || display_name == "twitchnotify" || display_name == "Twitchnotify") {
		result += '<span class="text logviewer-chat-text status-msg">'
	}
	else if(messageinfo.isaction) {
		result += '<span class="nick logviewer-chat-action" style="color: '+color+'">'+display_name+'</span> <span class="text logviewer-chat-text logviewer-chat-action" style="color: '+color+'">'
	}
	else {
		result += '<span class="nick" style="color: '+color+'">'+display_name+'</span><span class="logviewer-colon">:</span> <span class="text logviewer-chat-text">';
	}
	
	
	// replace emotes
	
	// sort in descending order
	var emotes = messageinfo.emotes.sort(function(a,b){ return a.start-b.start; });
	var position = 0;
	for(var i=0;i<emotes.length;i++) {
		emote = emotes[i];
		result += escapeHtml(message.substring(position,emote.start));
		position = emote.end+1;
		result += '<img class="emote emote-'+emote.id+'" alt="'+emote.name+'" title="'+emote.name+'" src="http://static-cdn.jtvnw.net/emoticons/v1/'+emote.id+'/3.0"></img>';
	}
	result += escapeHtml(message.substring(position));
	// close span tag
	result += '</span>';
	
	
	// Put surrogate pairs back in
	for (var i = 0; i < messageinfo.surrogates.length; ++i) {
		result = result.replace(String.fromCharCode(0xE000 + i), String.fromCharCode(messageinfo.surrogates[i][0], messageinfo.surrogates[i][1]));
	}
	result = result.replace(/[\uE000-\uF8FF]/g, function (x) {
		return String.fromCharCode(0xD800 + (x.charCodeAt(0) - 0xE000));
	});
	
	return result;
}

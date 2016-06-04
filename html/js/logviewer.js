var _badges = {"badge_sets":{"admin":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/3","description":"Twitch Admin","title":"Twitch Admin","click_action":"none","click_url":""}}},"broadcaster":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3","description":"Broadcaster","title":"Broadcaster","click_action":"none","click_url":""}}},"global_mod":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/3","description":"Global Moderator","title":"Global Moderator","click_action":"none","click_url":""}}},"moderator":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3","description":"Moderator","title":"Moderator","click_action":"none","click_url":""}}},"staff":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/3","description":"Twitch Staff","title":"Twitch Staff","click_action":"none","click_url":""}}},"subscriber":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/3","description":"Subscriber","title":"Subscriber","click_action":"subscribe_to_channel","click_url":""}}},"turbo":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/3","description":"Turbo","title":"Turbo","click_action":"turbo","click_url":""}}},"warcraft":{"versions":{"alliance":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/3","description":"For Lordaeron!","title":"Alliance","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"},"horde":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/3","description":"For the Horde!","title":"Horde","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"}}}}};
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(searchString, position){
		position = position || 0;
		return this.substr(position, searchString.length) === searchString;
	};
}

var logviewerApp = angular.module("logviewerApp", ['ngSanitize','ngAnimate','btford.socket-io']);
logviewerApp.controller("ChannelController", function($scope, $http, $stateParams, $rootScope, $sce, logviewerSocket, $q){
	console.log($stateParams.user);
	$scope.channel = $stateParams.channel.toLowerCase();
	$scope.channelsettings = null;
	$scope.userObject = null;
	$scope.newcomments = {};
	$scope.editingComment = {id:-1};
	$scope.loadStatus = 0;
	
	var ttvapi = function(endpoint, params) {
		if(params) return $http.jsonp(endpoint+"/?callback=JSON_CALLBACK&client_id="+settings.auth.client_id+"&"+params);
		else return $http.jsonp(endpoint+"/?callback=JSON_CALLBACK&client_id="+settings.auth.client_id+"&"+params);
	}
	
	ttvapi("https://api.twitch.tv/kraken/channels/"+$scope.channel).then(function(response){
		ttvapi("https://badges.twitch.tv/v1/badges/channels/"+response.data._id+"/display", "language=en").then(function(response){
			angular.merge(_badges, response.data);
		});
		ttvapi("https://badges.twitch.tv/v1/badges/global/display", "language=en").then(function(response){
			angular.merge(_badges, response.data);
		});
	}, function(response){
		// nothing to do here.
	});
	$http.jsonp("/api/channel/"+$scope.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.channelsettings = response.data.channel;
		$scope.userObject = response.data.me;
		$scope.loadStatus = response.data.channel==null?-1:-1+2*response.data.channel.active;
		
		if($stateParams.user) {
			$scope.addUser($stateParams.user);
		}
	}, function(response){
		$scope.loadStatus = -1;
	});

	$scope.users = {};
	$scope.messages = {};
	
	
	$scope.selectedID = null;
	
	$scope.username = "";
	$scope.typedUserSearch = "";
	$scope.submitAddUserForm = function()
	{
		if($scope.username || $scope.typedUserSearch) {
			$scope.addUser($scope.username || $scope.typedUserSearch);
			$scope.username = "";
			$scope.typedUserSearch = "";
		}
	}
	
	$scope.userid = 0;
	
	$scope.profilePics = {};
	var getProfilePic = function(nick) {
		if($scope.profilePics[nick] === undefined) {
			ttvapi("https://api.twitch.tv/kraken/channels/"+nick).then(function(response) {
				$scope.profilePics[nick] = response.data.logo;
			});
		}
	}
	
	$scope.chatEmbedUrl = function() {
		if($scope.channelsettings) return $sce.trustAsResourceUrl("https://www.twitch.tv/" + $scope.channelsettings.name + "/chat?"+($scope.darkmode?"darkpopout":"popout"));
		else return;
	}
	
	var getComments = function(user) {
		if($rootScope.auth.token) {
			$http.jsonp("/api/comments/" + $scope.channel + "/?token="+$rootScope.auth.token+"&topic="+user+"&callback=JSON_CALLBACK").then(function(response) {
				$scope.users[user].comments = response.data;
				for(var i=0;i<response.data.length;++i) {
					getProfilePic(response.data[i].author);
				}
			});
		} else {
			$http.jsonp("/api/comments/" + $scope.channel + "/?topic="+user+"&token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response) {
				$scope.users[user].comments = response.data;
				for(var i=0;i<response.data.length;++i) {
					getProfilePic(response.data[i].author);
				}
			});
		}
	}
	
	
	$scope.addUser = function(nick)
	{
		nick = nick.toLowerCase();
		if($scope.users[nick] === undefined)
		{
			$scope.users[nick] = {
				id: $scope.userid++,
				messages: [], // list of message objects
				allloaded: false, // all messages of this user have been loaded
				isloading: true, // is currently loading messages
				isloadingContext: { before: false, after: false }, // is currently loading more context messages before/after
				data: { // copied 1:1 from the api
					nick: nick,
					timeouts: "-",
					messages: "-"
				}
			};
		}
		$http.jsonp("/api/logs/" + $scope.channel,{
			params: {
				nick: nick,
				token: $rootScope.auth.token,
				callback: "JSON_CALLBACK"
			}
		}).then(function(response){
			$scope.users[nick].data = response.data.user;
			var messagesToAdd = response.data.before || [];
			for(var i=0;i<messagesToAdd.length;++i) {
				var message = messagesToAdd[i];
				if($scope.messages[message.id] === undefined) {
					message.before = [];
					message.after = [];
					$scope.messages[message.id] = message;
					$scope.users[nick].messages.push(message);
				} else {
					$scope.users[nick].messages.push($scope.messages[message.id]);
				}
			}
			// flag that states if we have loaded all messages (back in time) for this user
			$scope.users[nick].allloaded = messagesToAdd.length < 10;
			$scope.users[nick].isloading = false;
			
			// join socket.io room
			console.log("Subscribing to "+ $scope.channel+"-"+nick);
			logviewerSocket.emit("subscribe",$scope.channel+"-"+nick);
		},function(response){
			console.log(response);
		});
		getComments(nick);
	}
	
	$scope.moreUser = function(nick)
	{
		$scope.users[nick].isloading = true;
		$http.jsonp("/api/logs/" + $scope.channel,{
			params: {
				nick: nick,
				id: $scope.users[nick].messages[0].id,
				after: 0,
				token: $rootScope.auth.token,
				callback: "JSON_CALLBACK"
			}
		}).then(function(response){
			$scope.users[nick].data = response.data.user;
			var messagesToAdd = response.data.before;
			for(var i=messagesToAdd.length-1;i>=0;--i) {
				var message = messagesToAdd[i];
				if($scope.messages[message.id] === undefined) {
					message.before = [];
					message.after = [];
					$scope.messages[message.id] = message;
					$scope.users[nick].messages.unshift(message);
				} else {
					$scope.users[nick].messages.unshift($scope.messages[message.id]);
				}
			}
			$scope.users[nick].allloaded = response.data.before.length < 10;
			$scope.users[nick].isloading = false;
		},function(response){
			// TODO: error message
			console.log(response);
			$scope.users[nick].isloading = false;
		})
	}
	$scope.loadUser = function(nick) {
		
	}
	$scope.delUser = function(nick) {
		delete $scope.users[nick];
		// leave socket.io room
		console.log("Unubscribing from "+ $scope.channel+"-"+nick);
		logviewerSocket.emit("unsubscribe",$scope.channel+"-"+nick);
	}
	$scope.clearUsers = function()
	{
		var users = Object.keys($scope.users);
		for(var i=0;i<users.length;++i) {
			logviewerSocket.emit("unsubscribe",$scope.channel+"-"+users[i]);
		}
		$scope.users = {};
	}
	$scope.selectMessage = function(id){
		if($scope.selectedID === id) {
			$scope.selectedID = null;
		} 
		else if($scope.selectedID === null && id !== null) {
			$scope.selectedID = id;
			if($scope.messages[id].before.length == 0 && $scope.messages[id].after.length == 0) {
				// populate if empty
				$http.jsonp("/api/logs/" + $scope.channel,{
					params: {
						id: id, 
						before: 10, 
						after: 10,
						token: $rootScope.auth.token,
						callback: "JSON_CALLBACK"
					}
				}).then(function(response){
					$scope.messages[id].before = response.data.before;
					$scope.messages[id].after = response.data.after;
				},function(response){
					// TODO: error message
					console.log(response);
				});
			}
		}
		else {
			$scope.selectedID = null;
		}
	}
	$scope.moreContext = function(nick,position,count){
		var selectedID = $scope.selectedID;
		var newestID = null;
		var user = $scope.users[nick];
		var url = "";
		if($scope.messages[selectedID][position].length == 0) {
			newestID = selectedID;
		}
		else if(position == "before") {
			newestID = $scope.messages[selectedID].before[0].id;
		}
		else {
			newestID = $scope.messages[selectedID].after[$scope.messages[selectedID].after.length - 1].id;
		}
		if(user.isloadingContext[position] == true) {
			return;
		}
		else {
			user.isloadingContext[position] = true;
			//?id=" + newestID + "/?callback=JSON_CALLBACK&" + position + "=" + count
			$http.jsonp("/api/logs/" + $scope.channel,{
				params: {
					id: newestID, 
					before: (position=="before")?10:0, 
					after: (position=="after")?10:0,
					token: $rootScope.auth.token,
					callback: "JSON_CALLBACK"
				}
			}).then(function(response){
				if(position == "before") $scope.messages[selectedID].before = response.data.before.concat($scope.messages[selectedID].before);
				else $scope.messages[selectedID].after = $scope.messages[selectedID].after.concat(response.data.after);
				user.isloadingContext[position] = false;
			},function(response){
				// TODO: error message
				user.isloadingContext[position] = false;
				console.log(response);
			});
		}
	}
	$scope.unselect = function($event,that) {
		if($event.target.id == "main") $scope.selectedID = null;
	}
	
	$scope.editComment = function(comment) {
		if($scope.editingComment >= 0) {
			$scope.cancelUpdate(comment);
		}
		$scope.editingComment = comment.id;
	}
	
	$scope.cancelUpdate = function(comment) {
		getComments(comment.topic);
		$scope.editingComment = -1;
	}
	
	$scope.addComment = function(nick) {
		$http.post("/api/comments/"+$scope.channel,{token: $rootScope.auth.token, topic: nick, text: $scope.newcomments[nick]}).then(function(response){
			$scope.newcomments[nick] = "";
		});
	}
	
	$scope.updateComment = function(comment) {
		$http.post("/api/comments/"+$scope.channel,{token: $rootScope.auth.token, id: comment.id, topic: comment.topic, text: comment.text}).then(function(response){
			$scope.editingComment = -1;
		});
	}
	
	$scope.deleteComment = function(comment) {
		$http.delete("/api/comments/"+$scope.channel+"/?token="+$rootScope.auth.token+"&id="+comment.id).then(function(response){
		});
	}
	
	$http.get("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0,33,457", {cache: true}).then(function(result) {
		var allemotes = [];
		var emotesets = Object.keys(result.data.emoticon_sets);
		// flatten response
		for(var i=0;i<emotesets.length;++i) {
			var emoteset = result.data.emoticon_sets[emotesets[i]];
			for(var j=0;j<emoteset.length;++j) {
				emoteset[j].code = emoteset[j].code.replace(/\\(.)/g,"$1").replace(/(.)\?/g,"$1").replace(/\[(.)[^\\\]]*\]/g,"$1").replace(/\((.)\|[^\)]*\)/g,"$1").replace(/&gt;/g,">");
				allemotes.push(emoteset[j]);
			}
		}
		$scope.emote = allemotes[Math.floor(Math.random()*allemotes.length)];
		$scope.emote.url = "http://static-cdn.jtvnw.net/emoticons/v1/" + $scope.emote.id + "/3.0";
	});
	
	// chat connector
	logviewerSocket.on("connect", function(){
		console.log("Connected to socket.io");
		logviewerSocket.emit("token",$rootScope.auth.token);
	});
	
	logviewerSocket.on("log-add", function(message){
		console.log("Message added: "+message);
		if($scope.messages[message.id] === undefined) {
			message.before = [];
			message.after = [];
			$scope.messages[message.id] = message;
			$scope.users[message.nick].messages.push(message);
		} else {
			$scope.users[message.nick].messages.push($scope.messages[message.id]);
		}
	});
	
	logviewerSocket.on("log-update", function(message){
		console.log("Message updated: "+message);
		var msgs = $scope.users[message.nick].messages;
		// we iterate backwards since usually, the newest messages get updated
		for(var i=msgs.length-1;i>=0;--i) {
			if(msgs[i].id == message.id) {
				msgs[i].time = message.time;
				msgs[i].text = message.text;
				msgs[i].nick = message.nick;
				break;
			}
		}
		$scope.messages[message.id].time = message.time;
		$scope.messages[message.id].text = message.text;
		$scope.messages[message.id].nick = message.nick;
	});
	
	logviewerSocket.on("comment-add", function(comment){
		$scope.users[comment.topic].comments.push(comment);
		getProfilePic(comment.author);
	});
	
	logviewerSocket.on("comment-update", function(comment){
		var comments = $scope.users[comment.topic].comments;
		for(var i=0;i<comments.length;++i) {
			if(comments[i].id == comment.id) {
				comments[i].text = comment.text;
				comments[i].edited = comment.edited;
				break;
			}
		}
	});
	
	logviewerSocket.on("comment-delete", function(comment){
		var comments = $scope.users[comment.topic].comments;
		for(var i=0;i<comments.length;++i) {
			if(comments[i].id == comment.id) {
				comments.splice(i,1);
				break;
			}
		}
	});
	
	
	var autocompletes = {};
	var deferreds = {};
	logviewerSocket.on("search", function(result){
		// result.users is a list of any (or none have been found)
		// if the list would exceed length 10, it is null instead
		var list = [];
		if(result.users !== null) {
			for(var i=0;i<result.users.length;++i){
				list.push(result.users[i].nick);
			}
			autocompletes[result.search] = list;
		} else {
			autocompletes[result.search] = null;
		}
		// resolve the promise
		if(deferreds[result.search]) {
			deferreds[result.search].resolve(list);
			delete deferreds[result.search];
		}
	});
	
	$scope.userSearch = function(query) {
		query = query.toLowerCase();
		if(query.length < 4) return [];
		if(autocompletes[query] === undefined) {
			// we only quick-return values for queries that have no wildcards
			if(query.indexOf("%")<0 && query.indexOf("*")<0) {
				// check if a more general query (minimum query length is 4) has returned values
				for(var i=4;i<query.length;++i) {
					var generalQuery = autocompletes[query.slice(0,i)];
					if(generalQuery !== undefined && generalQuery !== null) {
						// found a proper query
						autocompletes[query] = generalQuery.filter(function(x){return x.startsWith(query);});
						return autocompletes[query];
					}
				}
			}
			// search for the user
			logviewerSocket.emit("search", {channel: $scope.channel, user: query});
			deferreds[query] = $q.defer();
			// return nothing
			return deferreds[query].promise;
		} else {
			return autocompletes[query] || [];
		}
	}
});

logviewerApp.filter('ifEmpty', function() {
	return function(input, defaultValue) {
		if (angular.isUndefined(input) || input === null || input === '') {
			return defaultValue;
		}
	
		return input;
	}
});


logviewerApp.filter('chatLine', function($sce) {
	return function(input, defaultValue) {
		console.log("chatLine called with "+input);
		// parse IRC message
		parsedmessage = parseIRCMessage(input);
		// render PRIVMSGS
		if(parsedmessage[STATE_COMMAND]=="PRIVMSG")
		{
			// get detailed info
			messageinfo = getPrivmsgInfo(parsedmessage);
			// render
			return $sce.trustAsHtml(renderMessage(messageinfo,_badges));
		} else if(parsedmessage[STATE_COMMAND]=="NOTICE") {
			
		}
	}
});

logviewerApp.filter('commentAge', function($sce, $filter) {
	return function(input, defaultValue) {
		var d = Date.now()/1000;
		var age = d-input.edited;
		var res = "";
		if(age < 60) {
			res = "less than a minute ago";
		} else if(age < 3600) {
			var mins = Math.round(age/60);
			if(mins == 1) res = "a minute ago";
			else res = mins+" minutes ago";
		} else if(age < 3600*24) {
			var hrs = Math.round(age/3600);
			if(hrs == 1) res = "an hour ago";
			else res = hrs+" hours ago";
		} else if(age < 3600*24*7) {
			var days = Math.round(age/(3600*24));
			if(days == 1) res = "yesterday";
			else res = days+" days ago";
		} else {
			res = $filter('date')(input.edited*1000);
		}
		return (input.edited == input.added?"":"edited ")+res;
	}
});


logviewerApp.filter('secondsTimestamp', function() {
	return function(input, defaultValue) {
		return ""+(parseInt(input)*1000);
	}
});

logviewerApp.filter('orderObjectBy', function() {
	return function(items, field, reverse) {
		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});
		filtered.sort(function (a, b) {
			return (a[field] > b[field] ? 1 : -1);
		});
		if(reverse) filtered.reverse();
		return filtered;
	};
});
var aAnAccountTypes = {0:"a non-banned",1:"a twitch",5:"a moderator",7:"a super-moderator",10:"an editor",50:"an admin",1337:"a super-admin"}
logviewerApp.filter('aAnAccountType', function() {
	return function(level) {
		var levels = [0,1,5,7,10,50,1337];
		return aAnAccountTypes[levels.filter(function(x){return x>=level})[0]];
	};
});

logviewerApp.factory("logviewerSocket", function(socketFactory) {
	return socketFactory();
})

 
function isScrollBottom(element) {
	var elementHeight = element.outerHeight();
	var scrollPosition = element[0].scrollHeight - element.scrollTop();
	return (elementHeight == scrollPosition);
}

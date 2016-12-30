var _badges = {"badge_sets":{"admin":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9ef7e029-4cdf-4d4d-a0d5-e2b3fb2583fe/3","description":"Twitch Admin","title":"Twitch Admin","click_action":"none","click_url":""}}},"broadcaster":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3","description":"Broadcaster","title":"Broadcaster","click_action":"none","click_url":""}}},"global_mod":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/9384c43e-4ce7-4e94-b2a1-b93656896eba/3","description":"Global Moderator","title":"Global Moderator","click_action":"none","click_url":""}}},"moderator":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3","description":"Moderator","title":"Moderator","click_action":"none","click_url":""}}},"staff":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/3","description":"Twitch Staff","title":"Twitch Staff","click_action":"none","click_url":""}}},"subscriber":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/19dd8673-124d-4f44-830c-b0f4f9d78635/3","description":"Subscriber","title":"Subscriber","click_action":"subscribe_to_channel","click_url":""}}},"turbo":{"versions":{"1":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/3","description":"Turbo","title":"Turbo","click_action":"turbo","click_url":""}}},"warcraft":{"versions":{"alliance":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/c4816339-bad4-4645-ae69-d1ab2076a6b0/3","description":"For Lordaeron!","title":"Alliance","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"},"horde":{"image_url_1x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/1","image_url_2x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/2","image_url_3x":"https://static-cdn.jtvnw.net/badges/v1/de8b26b6-fd28-4e6c-bc89-3d597343800d/3","description":"For the Horde!","title":"Horde","click_action":"visit_url","click_url":"http://warcraftontwitch.tv/"}}}}};
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(searchString, position){
		position = position || 0;
		return this.substr(position, searchString.length) === searchString;
	};
}

var logviewerApp = angular.module("logviewerApp", ['ngSanitize','ngAnimate','btford.socket-io','linkify']);
logviewerApp.controller("ChannelController", function($scope, $http, $stateParams, $rootScope, $sce, logviewerSocket, $mdDialog, $timeout, $q){
	$scope.channel = $stateParams.channel.toLowerCase();
	$scope.channelsettings = null;
	$scope.userObject = null;
	$scope.newcomments = {};
	$scope.profilePics = {};
	$scope.editingComment = {id:-1};
	$scope.loadStatus = 0;
	$scope.videos = [];
	$scope.highlights = [];
	
	$scope.users = {};
	$scope.messages = {};
	
	$scope.selectedID = null;
	$scope.username = "";
	$scope.typedUserSearch = "";
	$scope.userid = 0;
	
	$http.get("/api/channel/"+$scope.channel+"/?token="+$rootScope.auth.token).then(function(response){
		$scope.channelsettings = response.data.channel;
		$scope.userObject = response.data.me;
		$scope.loadStatus = response.data.channel==null?-1:-1+2*response.data.channel.active;
		if($stateParams.user) {
			$scope.addUser($stateParams.user);
		}
		getVideos(0);
		getHighlights(0);
	}, function(response){
		$scope.loadStatus = -1;
	});
	
	
	$scope.submitAddUserForm = function()
	{
		if($scope.username || $scope.typedUserSearch) {
			$scope.addUser($scope.username || $scope.typedUserSearch);
			$scope.username = "";
			$scope.typedUserSearch = "";
		}
	}
	
	var getProfilePic = function(nick) {
		if($scope.profilePics[nick] === undefined) {
			ttvapi("https://api.twitch.tv/kraken/channels/"+nick).then(function(response) {
				$scope.profilePics[nick] = response.data.logo || "https://robohash.org/"+nick+"?set=set3";
			});
		}
	}
	
	$scope.modLogDisplay = function(time) {
		if(time === null) return "ban";
		else if(time === -1) return "unban";
		else if(isNaN(parseInt(time))) return time;
		else return time+"s";
	}
	
	$scope.modLogList = function(modlogs) {
		if(!modlogs) return [];
		return Object.keys(modlogs).join(", ");
	}
	
	$scope.chatEmbedUrl = function() {
		if($scope.channelsettings) return $sce.trustAsResourceUrl("https://www.twitch.tv/" + $scope.channelsettings.name + "/chat?"+($scope.userSettings.dark?"darkpopout":"popout"));
		else return;
	}
	
	var getComments = function(user) {
		if($rootScope.auth.token) {
			$http.get("/api/comments/" + $scope.channel + "/?token="+$rootScope.auth.token+"&topic="+user).then(function(response) {
				$scope.users[user].comments = response.data;
				for(var i=0;i<response.data.length;++i) {
					getProfilePic(response.data[i].author);
				}
			});
		} else {
			$http.get("/api/comments/" + $scope.channel + "/?topic="+user+"&token="+$rootScope.auth.token).then(function(response) {
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
		$http.get("/api/logs/" + $scope.channel,{
			params: {
				nick: nick,
				token: $rootScope.auth.token
			}
		}).then(function(response){
			$scope.users[nick].data = response.data.user;
			var messagesToAdd = response.data.before || [];
			for(var i=0;i<messagesToAdd.length;++i) {
				var message = messagesToAdd[i];
				if($scope.messages[message.id] === undefined) {
					message.before = [];
					message.after = [];
					message.video = getVideo(message.time);
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
			console.log("Subscribing to logs-"+ $scope.channel+"-"+nick);
			logviewerSocket.emit("subscribe","logs-"+$scope.channel+"-"+nick);
		},function(response){
			console.log(response);
		});
		getComments(nick);
	}
	
	$scope.moreUser = function(nick)
	{
		if($scope.users[nick].isloading) return;
		$scope.users[nick].isloading = true;
		$http.get("/api/logs/" + $scope.channel,{
			params: {
				nick: nick,
				id: $scope.users[nick].messages[0].id,
				after: 0,
				token: $rootScope.auth.token
			}
		}).then(function(response){
			$scope.users[nick].isloading = false;
			$scope.users[nick].data = response.data.user;
			var messagesToAdd = response.data.before;
			for(var i=messagesToAdd.length-1;i>=0;--i) {
				var message = messagesToAdd[i];
				if($scope.messages[message.id] === undefined) {
					message.before = [];
					message.after = [];
					message.video = getVideo(message.time);
					$scope.messages[message.id] = message;
					$scope.users[nick].messages.unshift(message);
				} else {
					$scope.users[nick].messages.unshift($scope.messages[message.id]);
				}
			}
			$scope.users[nick].allloaded = response.data.before.length < 10;
		},function(response){
			// TODO: error message
			console.log(response);
			$scope.users[nick].isloading = false;
		})
	}
	
	$scope.delUser = function(nick) {
		delete $scope.users[nick];
		// leave socket.io room
		console.log("Unubscribing from logs-"+ $scope.channel+"-"+nick);
		logviewerSocket.emit("unsubscribe","logs-"+$scope.channel+"-"+nick);
	}
	$scope.clearUsers = function()
	{
		var users = Object.keys($scope.users);
		for(var i=0;i<users.length;++i) {
			logviewerSocket.emit("unsubscribe","logs-"+$scope.channel+"-"+users[i]);
		}
		$scope.users = {};
	}
	$scope.selectMessage = function(nick, id){
		var user = $scope.users[nick];
		user.isloadingContext["before"] = true;
		user.isloadingContext["after"] = true;
		if($scope.selectedID === id) {
			$scope.selectedID = null;
			user.isloadingContext["before"] = false;
			user.isloadingContext["after"] = false;
		} 
		else if($scope.selectedID === null && id !== null) {
			$scope.selectedID = id;
			if($scope.messages[id].before.length == 0 && $scope.messages[id].after.length == 0) {
				// populate if empty
				$http.get("/api/logs/" + $scope.channel,{
					params: {
						id: id, 
						before: 10, 
						after: 10,
						token: $rootScope.auth.token
					}
				}).then(function(response){
					user.isloadingContext["before"] = false;
					user.isloadingContext["after"] = false;
					$scope.messages[id].before = response.data.before;
					$scope.messages[id].after = response.data.after;
					addVideoForAll(response.data.before);
					addVideoForAll(response.data.after);
				},function(response){
					user.isloadingContext["before"] = false;
					user.isloadingContext["after"] = false;
					console.log(response);
				});
			} else {
				user.isloadingContext["before"] = false;
				user.isloadingContext["after"] = false;
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
			$http.get("/api/logs/" + $scope.channel,{
				params: {
					id: newestID, 
					before: (position=="before")?10:0, 
					after: (position=="after")?10:0,
					token: $rootScope.auth.token
				}
			}).then(function(response){
				if(position == "before") {
					$scope.messages[selectedID].before = response.data.before.concat($scope.messages[selectedID].before);
					addVideoForAll(response.data.before);
				}
				else {
					$scope.messages[selectedID].after = $scope.messages[selectedID].after.concat(response.data.after);
					addVideoForAll(response.data.after);
				}
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
		$http.post("/api/comments/"+$scope.channel,{token: $rootScope.auth.token, comment: {topic: nick, text: $scope.newcomments[nick]}}).then(function(response){
			$scope.newcomments[nick] = "";
		});
	}
	
	$scope.updateComment = function(comment) {
		$http.post("/api/comments/"+$scope.channel,{token: $rootScope.auth.token, comment: {id: comment.id, topic: comment.topic, text: comment.text}}).then(function(response){
			$scope.editingComment = -1;
		});
	}
	
	$scope.deleteComment = function(comment) {
		$http.delete("/api/comments/"+$scope.channel+"/?token="+$rootScope.auth.token+"&id="+comment.id).then(function(response){
		});
	}
	
	$http.get("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0,33,457&client_id="+settings.auth.client_id, {cache: true}).then(function(result) {
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
		$scope.emote.url = "//static-cdn.jtvnw.net/emoticons/v1/" + $scope.emote.id + "/3.0";
	});
	
	// chat connector
	logviewerSocket.on("connect", function(){
		console.log("Connected to socket.io");
	});
	logviewerSocket.emit("token",$rootScope.auth.token);
	
	logviewerSocket.on("log-add", function(message){
		console.log("Message added: "+message);
		if($scope.messages[message.id] === undefined) {
			message.before = [];
			message.after = [];
			// super unlikely for this to be the case, but what do you know.
			message.video = getVideo(message.time);
			$scope.messages[message.id] = message;
			$scope.users[message.nick].messages.push(message);
		} else {
			$scope.users[message.nick].messages.push($scope.messages[message.id]);
		}
	});
	
	logviewerSocket.on("log-update", function(message){
		console.log("Message updated: "+JSON.stringify(message));
		var msgs = $scope.users[message.nick].messages;
		// we iterate backwards since usually, the newest messages get updated
		for(var i=msgs.length-1;i>=0;--i) {
			if(msgs[i].id == message.id) {
				msgs[i].time = message.time;
				msgs[i].text = message.text;
				msgs[i].nick = message.nick;
				msgs[i].modlog = message.modlog;
				break;
			}
		}
		$scope.messages[message.id].time = message.time;
		$scope.messages[message.id].text = message.text;
		$scope.messages[message.id].nick = message.nick;
		$scope.messages[message.id].modlog = message.modlog;
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
	
	// remove all listeners when we leave.
	$scope.$on('$destroy', function (event) {
		$scope.clearUsers();
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
	
	var ttvapi = function(endpoint, params) {
		if(params) return $http.jsonp(endpoint+"/?callback=JSON_CALLBACK&client_id="+settings.auth.client_id+"&"+params);
		else return $http.jsonp(endpoint+"/?callback=JSON_CALLBACK&client_id="+settings.auth.client_id);
	}
	
	$http.get("/api/badges/"+$scope.channel+"/").then(function(response){
		_badges = response.data;
	});
	
	var getVideos = function (offset) {
		// get past broadcasts
		ttvapi("https://api.twitch.tv/kraken/channels/"+$scope.channelsettings.name+"/videos", "limit=100&broadcasts=true&offset="+offset).then(function(response){
			var count = response.data.videos.length;
			for(var i=0;i<count;++i) {
				var video = response.data.videos[i];
				video.created_at = Date.parse(video.created_at) / 1000;
				video.start = Date.parse(video.recorded_at) / 1000;
				video.end = (video.status == "recording")? Infinity : video.start + video.length;
				$scope.videos.push(video);
			}
			if(count == 100) {
				getVideos(offset+100);
			} else {
				// once we are done loading, we can update all messages
				updateMessageVideoInfo();
			}
		});
	}
	
	var getHighlights = function (offset) {
		// get highlights
		ttvapi("https://api.twitch.tv/kraken/channels/"+$scope.channelsettings.name+"/videos", "limit=100&offset="+offset).then(function(response){
			var count = response.data.videos.length;
			for(var i=0;i<count;++i) {
				var video = response.data.videos[i];
				video.created_at = Date.parse(video.created_at) / 1000;
				video.start = Date.parse(video.recorded_at) / 1000;
				video.end = video.start + video.length;
				$scope.highlights.push(video);
			}
			if(count == 100) {
				getHighlights(offset+100);
			} else {
				// once we are done loading, we can update all messages
				updateMessageVideoInfo();
			}
		});
	}
	var getVideoInfo = function(video, timestamp) {
		var pasttime = Math.max(0, Math.round(timestamp - video.start)-10); // remove 10s to compensate for twitch page load
		return {
			url: video.url+"?t="+pasttime+"s",
			tooltip: "Watch "+((video.broadcast_type == "archive")?"past broadcast":video.broadcast_type)+"<br>"+video.title+"<br>Game: "+video.game,
			classname: (video.broadcast_type == "highlight")?"md-primary md-icon-button videobutton md-primary highlight-button":"md-primary md-icon-button videobutton"
		}
	}
	
	var getVideo = function (timestamp) {
		for(var i=0;i<$scope.highlights.length;++i) {
			// since the videos are ordered by time of creation, we can stop once a video was created before this message was posted
			var video = $scope.highlights[i];
			if(video.created_at < timestamp && video.end < timestamp) break;
			else 
				if(video.start <= timestamp && video.end >= timestamp) return getVideoInfo(video, timestamp);
		}
		for(var i=0;i<$scope.videos.length;++i) {
			// since the videos are ordered by time of creation, we can stop once a video was created before this message was posted and the vod ended beforehand as well.
			var video = $scope.videos[i];
			//if(video.created_at < timestamp && video.end < timestamp) return;
			//else 
				if(video.start <= timestamp && video.end >= timestamp) return getVideoInfo(video, timestamp);
		}
	}
	
	var addVideoForAll = function(list) {
		for(var i=0;i<list.length;++i) {
			list[i].video = getVideo(list[i].time);
		}
	}
	
	var updateMessageVideoInfo = function() {
		var messageIDs = Object.keys($scope.messages);
		for(var i=0;i<messageIDs.length;++i) {
			var msg = $scope.messages[messageIDs[i]];
			if(msg) msg.video = getVideo(msg.time);
		}
	}
	
	
	// virtualRepeat model
	var infiniteScroller = function () {
		this.PAGE_SIZE = 100;
		this.totallength = 200;
		this.endoflogs = null;
		this.topindex = 0;
		this.error = "";
	}
	
	infiniteScroller.prototype.getItemAtIndex = function(index) {
		// update the datepicker
		if($scope.messages[this.topindex]) {
			var newDate = new Date($scope.messages[this.topindex].time*1000);
			if(!$scope.chosendate || newDate.getFullYear() != $scope.chosendate.getFullYear() || newDate.getMonth() != $scope.chosendate.getMonth() || newDate.getDate() != $scope.chosendate.getDate()) {
				$scope.chosendate = newDate;
			}
		}
		
		var messageid = index+1;
		var pageindex = messageid-(messageid%this.PAGE_SIZE);
		//console.log("Getting item at "+index);
		var msg = $scope.messages[messageid];
		if (msg) {
			return msg;
		} else if(msg !== null) {
			this.loadById(pageindex-1, 0, this.PAGE_SIZE); // we read the messages after the message prior to the first one were getting.... T.T
		}
		// always make sure we have the next page loaded
		if($scope.messages[messageid+(this.PAGE_SIZE>>1)] === undefined) {
			this.loadById(pageindex+this.PAGE_SIZE-1, 0, this.PAGE_SIZE);
		}
	}
	
	infiniteScroller.prototype.getLength = function() {
		if(this.endoflogs) return this.totallength;
		else return this.totallength+10;
	};
	
	infiniteScroller.prototype.loadById = function(id, before, after) {
		var self = this;
		console.log("Getting logs at "+id);
		for(var i=id-before;i<id;++i) {
			if(!$scope.messages[i]) $scope.messages[i] = null;
		}
		for(var i=id+1;i<=id+after;++i) {
			if(!$scope.messages[i]) $scope.messages[i] = null;
		}
		$http.get("/api/logs/" + $scope.channel,{
			params: {
				id: id, 
				before: before, 
				after: after,
				token: $rootScope.auth.token
			}
		}).then(function(response){
			console.log("Got logs at "+id);
			for(var i=0;i<response.data.before.length;++i) {
				var message = response.data.before[i];
				if(!$scope.messages[message.id]) {
					$scope.messages[message.id] = message;
				}
				self.totallength = Math.max(self.totallength, message.id);
			}
			addVideoForAll(response.data.before);
			for(var i=0;i<response.data.after.length;++i) {
				var message = response.data.after[i];
				if(!$scope.messages[message.id]) {
					$scope.messages[message.id] = message;
				}
				self.totallength = Math.max(self.totallength, message.id);
			}
			addVideoForAll(response.data.after);
			if(response.data.after.length < after && response.data.after.length > 0) {
				console.log("End of logs reached");
				self.endoflogs = response.data.after[response.data.after.length-1].id;
			}
		},function(response){
			console.log(response);
		});
	}
	
	infiniteScroller.prototype.gotoDate = function(date) {
		var self = this;
		self.error = "";
		console.log("Jumping to date "+date);
		$http.get("/api/logs/" + $scope.channel,{
			params: {
				time: Math.floor(date.getTime()/1000),
				before: this.PAGE_SIZE,
				after: this.PAGE_SIZE,
				token: $rootScope.auth.token
			}
		}).then(function(response){
			for(var i=0;i<response.data.after.length;++i) {
				var message = response.data.after[i];
				if(!$scope.messages[message.id]) {
					$scope.messages[message.id] = message;
				}
				self.totallength = Math.max(self.totallength, message.id);
			}
			addVideoForAll(response.data.after);
			for(var i=0;i<response.data.before.length;++i) {
				var message = response.data.before[i];
				if(!$scope.messages[message.id]) {
					$scope.messages[message.id] = message;
				}
				self.totallength = Math.max(self.totallength, message.id);
			}
			addVideoForAll(response.data.before);
			if(response.data.after.length > 0) {
				console.log("Got logs at "+response.data.after[0].id);
				if(response.data.after.length < this.PAGE_SIZE) {
					console.log("End of logs reached");
					self.endoflogs = response.data.after[response.data.after.length-1].id;
				}
				$timeout(()=>{self.topindex = response.data.after[0].id;},1);
			} else {
				console.log("Got logs at "+response.data.before[response.data.before.length-1].id);
				console.log("Tried to jump past the end of logs");
				self.endoflogs = response.data.before[response.data.before.length-1].id;
				$timeout(()=>{self.topindex = response.data.before[response.data.before.length-1].id;},1);
			}
		},function(response){
			console.log(response);
		});
	}
	
	$scope.allLines = new infiniteScroller();
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
		//console.log("chatLine called with "+input);
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
		return isNaN(input) ? "" : ""+(parseInt(input)*1000);
	}
});

logviewerApp.filter('isntEmpty', function() {
	return function(object) {
		if(!object) return false;
		return !angular.equals({}, object);
	}
})

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
var aAnAccountTypes = {0:"a non-banned", 1:"a twitch", 2:"a regular", 5:"a moderator", 7:"a super-moderator", 10:"a manager", 50:"an admin", 1337:"a super-admin"}
logviewerApp.filter('aAnAccountType', function() {
	return function(level) {
		var levels = Object.keys(aAnAccountTypes);
		return aAnAccountTypes[levels.filter(function(x){return x>=level})[0]];
	};
});

logviewerApp.factory("logviewerSocket", function(socketFactory) {
	return socketFactory();
});

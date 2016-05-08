var _badges = {
	"global_mod": {
		"alpha": "http://chat-badges.s3.amazonaws.com/globalmod-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/globalmod.png",
		"svg": "http://chat-badges.s3.amazonaws.com/globalmod.svg"
	},
	"admin": {
		"alpha": "http://chat-badges.s3.amazonaws.com/admin-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/admin.png",
		"svg": "http://chat-badges.s3.amazonaws.com/admin.svg"
	},
	"broadcaster": {
		"alpha": "http://chat-badges.s3.amazonaws.com/broadcaster-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/broadcaster.png",
		"svg": "http://chat-badges.s3.amazonaws.com/broadcaster.svg"
	},
	"mod": {
		"alpha": "http://chat-badges.s3.amazonaws.com/mod-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/mod.png",
		"svg": "http://chat-badges.s3.amazonaws.com/mod.svg"
	},
	"staff": {
		"alpha": "http://chat-badges.s3.amazonaws.com/staff-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/staff.png",
		"svg": "http://chat-badges.s3.amazonaws.com/staff.svg"
	},
	"turbo": {
		"alpha": "http://chat-badges.s3.amazonaws.com/turbo-alpha.png",
		"image": "http://chat-badges.s3.amazonaws.com/turbo.png",
		"svg": "http://chat-badges.s3.amazonaws.com/turbo.svg"
	},
	"subscriber": null
};

var logviewerApp = angular.module("logviewerApp", ['ngSanitize','ngAnimate']);
logviewerApp.controller("ChannelController", function($scope, $http, $stateParams,$rootScope){
	$scope.channel = $stateParams.channel;
	$scope.channelsettings = null;
	$scope.userObject = null;
	$scope.newcomments = {};
	$scope.editingComment = {id:-1};
	$scope.loaded = false;
	$http.jsonp("https://api.twitch.tv/kraken/chat/"+$scope.channel+"/badges?callback=JSON_CALLBACK&client_id="+settings.auth.client_id).then(function(response){
		_badges = response.data;
	}, function(response){
		// nothing to do here.
	});
	$http.jsonp("/api/channel/"+$scope.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.channelsettings = response.data.channel;
		$scope.userObject = response.data.me;
		$scope.loaded = true;
	}, function(response){
		// nothing to do here.
	});

	$scope.users = {};
	$scope.messages = {};
	
	
	$scope.selectedID = null;
	
	$scope.username = "";
	$scope.submitAddUserForm = function()
	{
		if($scope.username) {
			$scope.addUser($scope.username);
			$scope.username = "";
		}
	}
	
	$scope.userid = 0;
	
	$scope.profilePics = {};
	var getProfilePic = function(nick) {
		if($scope.profilePics[nick] === undefined) {
			$http.jsonp("https://api.twitch.tv/kraken/channels/"+nick+"/?callback=JSON_CALLBACK&client_id="+settings.auth.client_id).then(function(response) {
				$scope.profilePics[nick] = response.data.logo;
			});
		}
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
			let messagesToAdd = response.data.before || [];
			for(let i=0;i<messagesToAdd.length;++i) {
				let message = messagesToAdd[i];
				if($scope.messages[message.id] === undefined) {
					message.before = [];
					message.after = [];
					$scope.messages[message.id] = message;
					$scope.users[nick].messages.push(message);
				} else {
					$scope.users[nick].messages.push($scope.messages[message.id]);
				}
			}
			$scope.users[nick].allloaded = messagesToAdd.length < 10;
			$scope.users[nick].isloading = false;
		},function(response){
			console.log(response);
		});
		getComments(nick);
	}
	// TODO: remove
	$scope.addUser("cbenni");
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
			let messagesToAdd = response.data.before;
			for(let i=messagesToAdd.length-1;i>=0;--i) {
				let message = messagesToAdd[i];
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
	}
	$scope.clearUsers = function()
	{
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
			getComments(nick);
		});
	}
	
	$scope.updateComment = function(comment) {
		$http.post("/api/comments/"+$scope.channel,{token: $rootScope.auth.token, id: comment.id, text: comment.text}).then(function(response){
			$scope.editingComment = -1;
			getComments(comment.topic);
		});
	}
	
	$scope.deleteComment = function(comment) {
		$http.delete("/api/comments/"+$scope.channel+"/?token="+$rootScope.auth.token+"&id="+comment.id).then(function(response){
			getComments(comment.topic);
		});
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

logviewerApp.filter('commentAge', function($sce) {
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


logviewerApp.directive('scrollToBottom', function () {
	return {
		link: function (scope, element) {
			$elem = $(element);
			var isScrolledToBottom = isScrollBottom($elem);
			$elem.scroll(function(event){
				isScrolledToBottom = isScrollBottom($elem);
			});
			$elem.on('DOMNodeInserted', function (event) {
				console.log(event)
				if(isScrolledToBottom == true) {
					setTimeout(function(){$(element).scrollTop($(element)[0].scrollHeight);},1);
				}
			});
		}
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
var aAnAccountTypes = {0:"an",1:"an",5:"a moderator",7:"a super-moderator",10:"an editor",50:"an admin",1337:"a super-admin"}
logviewerApp.filter('aAnAccountType', function() {
	return function(level) {
		var levels = [0,1,5,7,10,50,1337];
		return aAnAccountTypes[levels.filter(function(x){return x>=level})[0]];
	};
});

 
function isScrollBottom(element) {
	var elementHeight = element.outerHeight();
	var scrollPosition = element[0].scrollHeight - element.scrollTop();
	return (elementHeight == scrollPosition);
}

var BASEURL = ""
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
logviewerApp.controller("ChannelController", function($scope, $http, $stateParams){
	$scope.channel = $stateParams.channel;
	$http.jsonp("https://api.twitch.tv/kraken/chat/"+$scope.channel+"/badges?callback=JSON_CALLBACK").then(function(response){
		_badges = response.data;
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
		$http.jsonp(BASEURL + "/api/logs/" + $scope.channel + "/?nick=" + nick 
				+ "&callback=JSON_CALLBACK").then(function(response){
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
	}
	// TODO: remove
	$scope.addUser("cbenni");
	$scope.moreUser = function(nick)
	{
		$scope.users[nick].isloading = true;
		$http.jsonp(BASEURL + "/api/logs/" + $scope.channel + "/?nick=" + nick 
				+ "&id=" + $scope.users[nick].messages[0].id + "&after=0&callback=JSON_CALLBACK").then(function(response){
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
				$http.jsonp(BASEURL + "/api/logs/" + $scope.channel + "/?id=" + id 
						+ "&callback=JSON_CALLBACK&before=10&after=10").then(function(response){
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
			$http.jsonp(BASEURL + "/api/logs/" + $scope.channel,{params:
				{
					id: newestID, 
					before: (position=="before")?10:0, 
					after: (position=="after")?10:0,
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

 
function isScrollBottom(element) {
	var elementHeight = element.outerHeight();
	var scrollPosition = element[0].scrollHeight - element.scrollTop();
	return (elementHeight == scrollPosition);
}

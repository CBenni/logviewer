var logviewerApp = angular.module("logviewerApp");
function getChanges(obj1,obj2) {
	var res = {};
	var keys = Object.keys(obj1);
	for(var i=0;i<keys.length;++i) {
		var key = keys[i];
		if(obj1[key]!==obj2[key]) res[key] = obj2[key];
	}
	return res;
}

function getListChanges(l1,l2) {
	var res = [];
	for(var i=0;i<l2.length;++i) {
		if(/^\w+$/.test(l2[i].nick) == false) continue;
		var inlist = false;
		for(var j=0;j<l1.length;++j) {
			if(l2[i].nick == l1[j].nick && l2[i].level == l1[j].level) {
				inlist = true;
				break;
			}
		}
		if(inlist === false) {
			res.push(l2[i]);
		}
	}
	return res;
}

logviewerApp.controller("SettingsController", function($rootScope, $scope, $http, $stateParams){
	$scope.settings = {
		active: 0,
		viewlogs: 0,
		viewcomments: 5,
		writecomments: 5,
		deletecomments: 10
	}
	$scope.loadStatus = 0;
	$scope.levels = [];
	$scope.userObject = null;
	$scope.channel = $stateParams.channel;
	var oldsettings = jQuery.extend({},$scope.settings);
	var oldlevels = jQuery.extend([],$scope.levels);
	
	$http.jsonp("/api/channel/"+$stateParams.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.settings = response.data.channel || $scope.settings;
		$scope.userObject = response.data.me;
		oldsettings = jQuery.extend({},$scope.settings);
		$scope.loadStatus = response.data.channel==null?-1:1;
	});
	
	$http.jsonp("/api/levels/"+$stateParams.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.levels = response.data;
		$scope.addEmptyRow();
		oldlevels = jQuery.extend(true,[],$scope.levels);
	});
	
	
	
	$scope.save = function() {
		var changedsettings = getChanges(oldsettings,$scope.settings);
		oldsettings = jQuery.extend({},$scope.settings);
		if(!jQuery.isEmptyObject(changedsettings)) {
			$http.post("/api/settings/"+$stateParams.channel, {token: $rootScope.auth.token, settings: changedsettings});
		}
		
		var changedlevels = getListChanges(oldlevels,$scope.levels);
		oldlevels = jQuery.extend([],$scope.levels);
		if(changedlevels.length!=0) $http.post("/api/levels/"+$stateParams.channel, {token: $rootScope.auth.token, levels: changedlevels});
	}
	
	$scope.addEmptyRow = function() {
		if($scope.levels.length > 0) {
			var lastrow = $scope.levels[$scope.levels.length - 1];
			if(lastrow.nick != "") {
				$scope.levels.push({nick: "", level: 0});
			}
		}
		else {
			$scope.levels.push({nick: "", level: 0});
		}
	}
	
	$http.get("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0,33,457", {cache: true}).then(function(result) {
		var allemotes = [];
		var emotesets = Object.keys(result.data.emoticon_sets);
		// flatten response
		for(var i=0;i<emotesets.length;++i) {
			var emoteset = result.data.emoticon_sets[emotesets[i]];
			for(var j=0;j<emoteset.length;++j) {
				emoteset[j].code = emoteset[j].code.replace(/\\(.)/g,"$1").replace(/(.)\?/g,"$1");
				allemotes.push(emoteset[j]);
			}
		}
		$scope.emote = allemotes[Math.floor(Math.random()*allemotes.length)];
		$scope.emote.url = "http://static-cdn.jtvnw.net/emoticons/v1/" + $scope.emote.id + "/3.0";
	});
});
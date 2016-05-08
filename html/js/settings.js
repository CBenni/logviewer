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
		active: 1,
		viewlogs: 0,
		viewcomments: 5,
		writecomments: 5,
		deletecomments: 10
	}
	$scope.loaded = false;
	$scope.levels = [];
	$scope.userObject = null;
	$scope.channel = $stateParams.channel;
	var oldsettings = jQuery.extend({},$scope.settings);
	var oldlevels = jQuery.extend([],$scope.levels);
	
	$http.jsonp("/api/channel/"+$stateParams.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.settings = response.data.channel;
		$scope.userObject = response.data.me;
		oldsettings = jQuery.extend({},$scope.settings);
		$scope.loaded = true;
	});
	
	$http.jsonp("/api/levels/"+$stateParams.channel+"/?token="+$rootScope.auth.token+"&callback=JSON_CALLBACK").then(function(response){
		$scope.levels = response.data;
		$scope.addEmptyRow();
		oldlevels = jQuery.extend(true,[],$scope.levels);
	});
	
	
	
	$scope.save = function() {
		var changedsettings = getChanges(oldsettings,$scope.settings);
		if(!jQuery.isEmptyObject(changedsettings)) {
			$http.post("/api/settings/"+$stateParams.channel, {token: $rootScope.auth.token, settings: changedsettings});
		}
		
		var changedlevels = getListChanges(oldlevels,$scope.levels);
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
});
var logviewerApp = angular.module("logviewerApp");

logviewerApp.controller("ChannelListController", function($rootScope, $scope, $http, $stateParams){
	$scope.channels = [];
	$scope.streams = {};
	
	$http.jsonp("/api/channels/?callback=JSON_CALLBACK").then(function(response) {
		var newchannels = [];
		for(var i=0;i<response.data.length;++i) {
			newchannels.push(response.data[i].name);
		}
		$scope.channels = newchannels;
		$http.jsonp("https://api.twitch.tv/kraken/streams?channel="+newchannels.join(",")+"&callback=JSON_CALLBACK").then(function(response2){
			var streams = response2.data.streams;
			var newstreams = {};
			for(var j=0;j<streams.length;++j) {
				newstreams[streams[j].channel.name] = streams[j];
			}
			$scope.streams = newstreams;
		});
	});
});
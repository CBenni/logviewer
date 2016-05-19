var logviewerApp = angular.module("logviewerApp");

logviewerApp.controller("ChannelListController", function($rootScope, $scope, $http, $stateParams){
	$scope.channels = [];
	$scope.streams = {};
	
	var updateChannels = function(){
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
	}
	
	var interval = setInterval(updateChannels,30000);
	
	$scope.$on('$destroy', function() {
		clearInterval(interval);
	});
	updateChannels();
	
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
});
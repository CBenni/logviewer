var logviewerApp = angular.module("logviewerApp");


logviewerApp.controller("ChannelListController", function($rootScope, $scope, $http, $stateParams, $window){
	$scope.channels = [];
	$scope.channellimit = 80;
	$scope.channelSearch = {};
	
	
	// todo: dynamic channellimit based on window width+height. Average item width is ~ 130px, height 51px
	var calcChannellimit = function () {
		var availableWidth = 0.7 * window.innerWidth;
		var availableHeight = window.innerHeight - 450; // 450px get used on the header, footer, title, show more and search
		
		$scope.channellimit = Math.max(5, Math.floor(availableHeight * availableWidth / (130 * 51)));
	}
	
	angular.element($window).bind('resize', function(){
		$scope.$apply(function(){
			if(isFinite($scope.channellimit)) calcChannellimit();
		});
	});
	calcChannellimit();
	
	var updateChannels = function(){
		$http.get("/api/channels/").then(function(response) {
			$scope.channels = response.data;
		});
	}
	
	// update every 2 minutes
	var interval = setInterval(updateChannels,2*60000);
	
	$scope.$on('$destroy', function() {
		clearInterval(interval);
	});
	updateChannels();
	
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
});

logviewerApp.filter("orderChannels", function() {
	return function(channels) {
		return channels.slice().sort(function(a,b){
			if(a.live < b.live) return 1;
			if(a.live > b.live) return -1;
			if(a.ispremium < b.ispremium) return 1;
			if(a.ispremium > b.ispremium) return -1;
			if(a.name > b.name) return 1;
			if(a.name < b.name) return -1;
		});
	}
});
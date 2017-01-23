if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(searchString, position){
		position = position || 0;
		return this.substr(position, searchString.length) === searchString;
	};
}

logviewerApp.controller("LeaderboardController", function($scope, $http, $stateParams, $rootScope, $sce, logviewerSocket, $mdDialog, $timeout, $q){
	$scope.channel = $stateParams.channel.toLowerCase();
	$scope.channelsettings = null;
	$scope.userObject = null;
	$scope.newcomments = {};
	$scope.editingComment = {id:-1};
	$scope.loadStatus = 0;
	$scope.videos = [];
	$scope.highlights = [];
	
	
	$http.get("/api/channel/"+$scope.channel+"/?token="+$rootScope.auth.token).then(function(response){
		$scope.channelsettings = response.data.channel;
		$scope.userObject = response.data.me;
		$scope.loadStatus = response.data.channel==null?-1:-1+2*response.data.channel.active;
		if($stateParams.user) {
			$scope.addUser($stateParams.user);
		}
	}, function(response){
		$scope.loadStatus = -1;
	});
	
	// virtualRepeat model
	var infiniteScroller = function () {
		this.PAGE_SIZE = 250;
		this.totallength = 0;
		this.endofusers = null;
		this.topindex = 0;
		this.error = "";
		this.pages = [];
	}
	
	infiniteScroller.prototype.getItemAtIndex = function(offset) {
		var self = this;
		var pageindex = Math.floor(offset/this.PAGE_SIZE);
		// always make sure we have the next page loaded
		if(self.pages[pageindex+1] === undefined) {
			this.loadPage(pageindex+1);
		}
		var page = self.pages[pageindex];
		if (page) {
			return page[offset%this.PAGE_SIZE];
		} else if(page === undefined) {
			this.loadPage(pageindex);
			return null;
		}
	}
	
	infiniteScroller.prototype.getLength = function() {
		if(this.endofusers) return this.totallength;
		else return this.totallength+10;
	};
	
	infiniteScroller.prototype.loadPage = function(pageindex) {
		var self = this;
		console.log("Getting users page "+pageindex);
		self.pages[pageindex] = null;
		$http.get("/api/leaderboard/" + $scope.channel,{
			params: {
				offset: pageindex*this.PAGE_SIZE,
				limit: this.PAGE_SIZE,
				token: $rootScope.auth.token
			}
		}).then(function(response){
			console.log("Got users page "+pageindex);
			var page = self.pages[pageindex] = new Array(response.data.length);
			for(var i=0;i<response.data.length;++i) {
				page[i] = {index: pageindex*self.PAGE_SIZE+i, user: response.data[i]};
			}
			if(response.data.length > 0) {
				self.totallength = Math.max(self.totallength, pageindex*self.PAGE_SIZE+response.data.length);
			}
			if(response.data.length < self.PAGE_SIZE) {
				self.endofusers = true;
				console.log("end of users reached. Row count: "+self.totallength);
			}
		},function(response){
			console.log(response);
		});
	}
	
	$scope.allUsers = new infiniteScroller();
});
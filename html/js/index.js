var app = angular.module("mainapp",["ui.router","logviewerApp","ngMaterial","ngCookies"]);
app.config(function($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $locationProvider, $mdThemingProvider) {
	$urlMatcherFactoryProvider.strictMode(false);
	$locationProvider.html5Mode(true);
	$stateProvider
		.state("index", {
			url: "/",
			title: 'index',
			templateUrl: "/static/list.html",
			controller: "ChannelListController"
		})
		.state("channel", {
			url: "/:channel?user",
			templateUrl: "/static/channel.html",
			controller: "ChannelController"
		})
		.state("settings", {
			url: "/:channel/settings",
			templateUrl: "/static/settings.html",
			controller: "SettingsController"
		});
});

app.run(function($rootScope, $state) {
	var stateChange = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams, options) {
		$rootScope.title = toParams.channel || toState.title;
		ga('set', 'page', $state.href(toState, toParams));
		ga('send', 'pageview');
	});
});

app.controller("mainctrl", function($rootScope,$scope,$http,$cookies,$stateParams,$mdDialog){
	$rootScope.auth = { name: $cookies.get("login")||"", token: $cookies.get("token")||"" };
	$scope.$stateParams = $stateParams;
	$scope.login = function() {
		window.location.href = "https://api.twitch.tv/kraken/oauth2/authorize"
			+"?response_type=code"
			+"&client_id="+settings.auth.client_id
			+"&redirect_uri="+settings.auth.baseurl+"/api/login"
			+"&scope="
			+"&state="+window.location.pathname;
	}
	
	$scope.logout = function() {
		$http.get("/api/logout/?token="+$rootScope.auth.token).then(function(result) {
			window.location.reload();
		});
	}
	
	
	$scope.showDialog = function(ev, tpl) {
		$mdDialog.show({
			controller: DialogController,
			templateUrl: tpl,
			parent: angular.element(document.body),
			targetEvent: ev,
			clickOutsideToClose: true
		});
	}
	
	$scope.darkmode = $cookies.get("lv-darkmode") === "true";
	$scope.saveMode = function() {
		$cookies.put("lv-darkmode", $scope.darkmode);
	}
	
	// preload this
	$http.get("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0,33,457", {cache: true});
});


function DialogController($scope, $mdDialog) {
	$scope.hide = function() {
		$mdDialog.hide();
	};
	$scope.cancel = function() {
		$mdDialog.cancel();
	};
	$scope.answer = function(answer) {
		$mdDialog.hide(answer);
	};
}

app.directive('clickOutside', function ($document) {
	return {
		restrict: 'A',
		scope: {
			clickOutside: '&'
		},
		link: function (scope, el, attr) {

			$document.on('click', function (e) {
				if (el !== e.target && !el[0].contains(e.target)) {
					scope.$apply(function () {
						scope.$eval(scope.clickOutside);
					});
				}
			});
		}
	}

});
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
		ga('set', 'page', $state.href(toState, toParams, {absolute: true}));
		ga('send', 'pageview');
	});
});

app.controller("mainctrl", function($rootScope,$scope,$http,$cookies,$stateParams){
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
});
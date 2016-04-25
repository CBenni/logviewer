var app = angular.module("mainapp",["ui.router","logviewerApp","ngMaterial","ngCookies"]);

app.config(function($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $locationProvider) {
	$urlMatcherFactoryProvider.strictMode(false);
	$locationProvider.html5Mode(true);
	$stateProvider
		.state("index", {
			url: "/",
			title: 'index',
			templateUrl: "/static/index.html"
		})
		.state("channel", {
			url: "/:channel",
			templateUrl: "/static/channel.html",
			controller: "ChannelController"
		})
		.state("settings", {
			url: "/:channel/settings",
			templateUrl: "/static/settings.html",
			controller: "SettingsController"
		})
});

app.run(function($rootScope) {
	var stateChange = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams, options) {
		$rootScope.title = toParams.channel || toState.title;
	});
});

app.controller("mainctrl", function($scope,$http,$cookies){
	$scope.auth = { name: $cookies.get("login"), token: $cookies.get("tk") };
	
	$scope.
});
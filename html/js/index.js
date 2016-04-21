var app = angular.module("mainapp",["ui.router","logviewerApp","ngMaterial"]);

app.config(function($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider, $locationProvider) {
	$urlMatcherFactoryProvider.strictMode(false);
	$locationProvider.html5Mode(true);
	$stateProvider
		.state("index", {
			url: "/",
			title: 'index',
			templateUrl: "/static/index.html"
		})
		.state("login", {
			url: "/login",
			title: 'login',
			templateUrl: "/static/login.html"
		})
		.state("channel", {
			url: "/:channel",
			templateUrl: "/static/channel.html",
			controller: "ChannelController"
		})
});

app.run(function($rootScope) {
	var stateChange = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams, options) {
		$rootScope.title = toParams.channel || toState.title;
	});
});
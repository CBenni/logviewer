var logviewerApp = angular.module("logviewerApp");
logviewerApp.controller("SettingsController", function($scope, $http, $stateParams){
	$scope.settings = {
		viewlogs: 0,
		viewcomments: 5,
		writecomments: 5,
		deletecomments: 10,
		editors: ""
	}
});
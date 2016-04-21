if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

function chatConnector($http, channel, user, oauth, messageHandler, connectedHandler) {
	$http.jsonp("http://api.twitch.tv/api/channels/"+channel+"/chat_properties/?callback=JSON_CALLBACK").then(function(response){
		var randomServer = response.data.web_socket_servers[Math.floor(Math.random()*response.data.web_socket_servers.length)];
		
		var ipinfo = randomServer.split(":");
		var ip = ipinfo[0];
		var port = 80;
		if(ipinfo.length == 2) port = ipinfo[1];
		
		var ws = new WebSocket("ws://"+randomServer);
		ws.onmessage = function(e) {
			console.log(e.data);
			if(e.data.startsWith("PING")) {
				ws.send("PONG")
			}
			messageHandler(ws, e.data);
		}
		ws.onopen = function(e) {
			ws.send("CAP REQ :twitch.tv/tags");
			ws.send("CAP REQ :twitch.tv/commands");
			ws.send("NICK "+user);
			if(oauth) {
				ws.send("PASS "+oauth);
			}
			ws.send("JOIN #"+channel);
			connectedHandler(ws, e);
		}
	}, function(response) {
		console.log(response);
		// TODO: throw error message
	});
}

logviewerApp.controller("ChatController", ["$scope","$http", function($scope, $http) {
	var self = this;
	self.messages = [];
	this.onmessage = function(ws, e) {
		$scope.$apply(function() {
			var rx3 = /\r\n|\r|\n/;
			var split = e.split(rx3);
			for(var i=0;i<split.length;++i) {
				if(split[i].length == 0) continue;
				parsedmessage = parseIRCMessage(split[i]);
				if(parsedmessage[STATE_COMMAND] == "PRIVMSG") {
					self.messages.push({"time":new Date(),"message":split[i]});
				}
			}
		});
	}
	this.onconnected = function(ws, e) {
		$scope.$apply(function() {
			self.messages.push({"time":new Date(),"message":"@color=#000000;display-name=;emotes=;subscriber=0;turbo=0;user_type= :jtv!jtv@jtv.tmi.twitch.tv PRIVMSG #cbenni :Connected"});
		});
	}
	this.chat = new chatConnector($http, $scope.channel, "justinfan123", "", this.onmessage, this.onconnected);
}]);





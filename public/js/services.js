'use strict';

/* Services */


angular.module('contest.services', ['ngResource']).
	factory('contestService', function($resource) {
		return $resource('/api/contest/:contestId', {contestId:'@contestId'}, {
			query: {method:'GET', isArray:false}
		});
	}).
	factory('socket', function($rootScope) {
		var socket=io.connect();
		return {
			on: function(eventName, callback) {
				socket.on(eventName, function() {
					var args = arguments;
					$rootScope.$apply(function() {
						callback.apply(socket, args);
					});
				});
			},
			emit: function(eventName, data, callback) {
				socket.emit(eventName, data, function() {
					var args = arguments;
					$rootScope.$apply(function () {
						if (callback) {
							callback.apply(socket, args);
						}
					});
				});
			}
		};
	});

angular.module('contestant.services', ['ngResource']).
	factory('contestantService', function($resource) {
		return $resource('/api/contest/:contestId/class/:classId/contestant/:amaId', 
			{contestId:'@contestId', classId:'@classId', amaId:'@amaId'},
			{query: {method:'GET', isArray:false}}
		);
	});


'use strict';

/* Services */


angular.module('contest.services', ['ngResource']).
	factory('contestService', function($resource) {
		return $resource('/api/contest/:contestId', {}, {
			get: {method:'GET', cache:false, isArray:false}
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
	}).
	factory('contestListService', function($resource) {
		return $resource('/api/contestList', {'includeTest':0}, {
			query: { method:'GET', isArray:true}
		});
	});

angular.module('contestant.services', ['ngResource']).
	factory('contestantService', function($resource) {
		return $resource('/api/contest/:contestId/class/:classId/contestant/:amaId', 
			{contestId:'@contestId', classId:'@classId', amaId:'@amaId'},
			{query: {method:'GET', isArray:false}}
		);
	});

angular.module('admin.services', ['ngResource']).
    factory('publish', function($resource) {
        return $resource('/api/contest/:contestId/publish',
            {contestId:'@contestId'},
            {query: {method:'GET', isArray:false}}
        );
    }).
    factory('nopublish', function($resource) {
        return $resource('/api/contest/:contestId/nopublish',
            {contestId:'@contestId'},
            {query: {method:'GET', isArray:false}}
        );
    });

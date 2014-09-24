'use strict';

// Declare app level module which depends on filters, and services

angular.module('myApp', [
    'myApp.controllers',
    'myApp.filters',
    'contest.services',
    'contestant.services',
    'myApp.directives',
    'angles',
    'nvd3'
]).
    config(function ($routeProvider, $locationProvider) {
        $locationProvider.html5Mode(true);
        $routeProvider.
            when('/:id/class/:classcode/contestant/:amaid', {
                templateUrl: '/partials/contestant',
                controller: 'ContestantCtrl'
            }).
            when('/home', {
                templateUrl: '/partials/home',
                controller: 'HomeCtrl'
            }).
            when('/:id', {
                templateUrl: '/partials/contest',
                controller: 'AppCtrl'
            }).
            otherwise({
                redirectTo: '/287'
            });


    });

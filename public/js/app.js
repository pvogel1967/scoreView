'use strict';

// Declare app level module which depends on filters, and services

angular.module('myApp', [
    'myApp.controllers',
    'myApp.filters',
    'contest.services',
    'contestant.services',
    'myApp.directives',
    'angles',
    'nvd3',
    'ngRoute',
    'ui.bootstrap'
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
            when('/contestList', {
                templateUrl: '/partials/contestList',
                controller: 'HomeCtrl'
            }).
            when('/admin', {
                templateUrl: '/partials/admin',
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

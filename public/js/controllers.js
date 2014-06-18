'use strict';

/* Controllers */

angular.module('myApp.controllers', ['angles']).
  controller('HomeCtrl', function($scope, $routeParams, contestListService, socket) {
  	$scope.contestList = contestListService.query({'includeTest':0});
  }).
  controller('AppCtrl', function ($scope, $routeParams, $window, contestService, socket) {
  	//$http({
  	//		method:'GET', 
  	//		url: '/api/contest/' + $routeParams.id
  	//	}).
	$scope.contestData = contestService.query({contestId:$routeParams.id});	
	$scope.columnClass = ($window.innerWidth >= 1200) ? "col-lg-6 col-md-12" : "col-lg-6 col-md-12";	
	socket.on('contestChanged', function(data) {
		console.log('got contestChanged event');
		$scope.contestData = contestService.query({contestId:$routeParams.id});	
	});

	$scope.computeRows = function(data) {
		if (typeof(data) == 'undefined') return;
		if (typeof(data.classData) == 'undefined') return;
      	var rows = [];
	  	var colCount = ($window.innerWidth >= 1200) ? 2 : 2;
	 	var columns = [];
	  	for (var i = 0; i< data.classData.length; i++) {
			columns.push(data.classData[i]);
			if (columns.length == colCount) {
				rows.push(columns);
				columns = [];
			}
	  	}
	  	if (columns.length > 0) {
			rows.push(columns);
	  	}
	  	return rows;
    };

	$scope.droppedStyle = function(score) {
		if (score.roundDropped) {
			return { 'color': 'grey', 'text-decoration':'line-through'};
		}
		return {};
	}

	$scope.$watch(function() { return $window.innerWidth;},function(newWidth, oldWidth) {
		if (newWidth != oldWidth) {
			$scope.columnClass = (newWidth >= 1200) ? "col-lg-6 col-md-12" : "col-lg-6 col-md-12";
			computeRows();
		}
	});
	$scope.$watch(function() { return $scope.contestData.classData;}, function(oldData, newData) {
		$scope.classRows = $scope.computeRows($scope.contestData);
	});
	window.onresize=function() { $scope.$apply();}
  }).
  controller('ContestantCtrl', function ($scope, $routeParams, $window, contestantService, socket) {

	$scope.update = function() {
		$scope.contestant = contestantService.query({contestId:$routeParams.id,classId:$routeParams.classcode,amaId:$routeParams.amaid});
	};

	$scope.update();	
	socket.on('contestChanged', function(data) {
		console.log('got contestChanged event from server');
		$scope.update();
	});
	
	$scope.scoreHistogramOptions = {
		animate:true,
		seriesDefaults: {
			renderer: jQuery.jqplot.BarRenderer,
			rendererOptions: {fillToZero: true}
		},
		axes:{
			xaxis:{
				ticks:[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10],
				renderer:jQuery.jqplot.CategoryAxisRenderer,
				tickRenderer: jQuery.jqplot.AxisTickRenderer,
				tickOptions: {
					formatter: function(format, value) { return value/2; } 
				},		
			},
			yaxis:{
				padMin:0
			}
		}
	};
	$scope.kFactorOptions = {
		animate:true,
		seriesDefaults: {
			renderer: $.jqplot.BarRenderer,
			rendererOptions: {fillToZero: true}
		},
		axes:{
			xaxis:{
				renderer:$.jqplot.CategoryAxisRenderer,
				padMax:2
			},
			yaxis:{
				padMin:3
			}
		}
	};

	$scope.kFactorAverages = function(schedule) {
		var avgSeries = [];
		for (var i=0; i<schedule.kFactorAverages.length; i++) {
			avgSeries[i] = schedule.kFactorAverages[i].tot/schedule.kFactorAverages[i].count;
		}
		return [avgSeries];
	};

	$scope.radarOptions = {
		scaleOverlay : true,
		scaleOverride : true,
		scaleSteps : 10,
		scaleStepWidth : 1,
		scaleStartValue : 0,
		pointLabelFontSize : 12
	};

	$scope.radarRawFn = function(schedule) {
		var maneuverNames = [];
		for (var m=0; m<schedule.maneuverAverages.length; m++) {
			maneuverNames.push(m+1);
		}
		return {
			labels : maneuverNames,
			datasets : [
				{
					fillColor : "rgba(0,102,153,0.5)",
					strokeColor : "rgba(0,102,153,1)",
					pointColor : "rgba(0,102,153,1)",
					pointStrokeColor : "#fff",
					data : schedule.maneuverAverages
				},
				{
					fillColor : "rgba(220,220,220,0.5)",
					strokeColor : "rgba(220,220,220,1)",
					pointColor : "rgba(220,220,220,1)",
					pointStrokeColor : "#fff",
					data : schedule.opponentAverages
				}
			]
		};
	};

	$scope.radarKOptions = function(schedule) {
		var maxK = 0;
		for (var m=0; m<schedule.maneuvers.length; m++) {
			if (schedule.maneuvers[m].kfactor > maxK) {
				maxK = schedule.maneuvers[m].kfactor;
			}
		}
		return {
			scaleOverlay : true,
			scaleOverride : true,
			scaleSteps : maxK * 10,
			scaleStepWidth : 1,
			scaleStartValue : 0,
			pointLabelFontSize : 12
		};

	}

	$scope.radarKfactorFn = function(schedule) {
		var maneuverNames = [];
		for (var m=0; m<schedule.maneuverKAverages.length; m++) {
			maneuverNames.push(m+1);
		}
		return {
			labels : maneuverNames,
			datasets : [
				{
					fillColor : "rgba(0,102,153,0.5)",
					strokeColor : "rgba(0,102,153,1)",
					pointColor : "rgba(0,102,153,1)",
					pointStrokeColor : "#fff",
					data : schedule.maneuverKAverages
				},
				{
					fillColor : "rgba(220,220,220,0.5)",
					strokeColor : "rgba(220,220,220,1)",
					pointColor : "rgba(220,220,220,1)",
					pointStrokeColor : "#fff",
					data : schedule.opponentKAverages
				}
			]
		};
	};



	$scope.judges = function(schedule) {
		var judges=[];
		for (var r=0; r<schedule.flightAverages.length; r++) {
			for (var j =0; j < 2; j++) {
				judges.push(schedule.maneuvers[0].flights[r].JudgeManeuverScores[j].JudgeId);
			}
		}
		return judges;
	}

	$scope.scores = function(s, maneuver) {
		var scores=[];
		for (var r=0; r<s.flightAverages.length; r++) {
			for (var j=0; j < 2; j++) {
				scores.push(maneuver.flights[r].JudgeManeuverScores[j].score);
			}
		}
		return scores;
	}

	$scope.columnStyle = function(colIdx) {
		if (colIdx % 2 == 0) {
			return { 'background-color': 'aquamarine', 'text-align':'center'};
		} else {
			return { 'background-color': 'lemonchiffon', 'text-align':'center'};
		}
	}

	$scope.winWidth = function() {
		return ($window.innerWidth-100)/2 - 20;
	}

	window.onresize=function() { 
		$scope.$apply();
	}
	
});

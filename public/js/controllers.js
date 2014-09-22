'use strict';

/* Controllers */

angular.module('myApp.controllers', ['angles', 'nvd3']).
    controller('HomeCtrl', function($scope, $routeParams, contestListService, socket) {
        $scope.contestList = contestListService.query({'includeTest':0});
    }).
    controller('AppCtrl', function ($scope, $routeParams, $window, contestService, socket) {
        $scope.contestData = contestService.query({contestId:$routeParams.id});
        $scope.columnClass = ($window.innerWidth >= 1200) ? "col-lg-6 col-md-12" : "col-lg-6 col-md-12";
        socket.on('contestChanged', function(data) {
            console.log('got contestChanged event');
            $scope.contestData = contestService.query({contestId:$routeParams.id});
        });

        $scope.computeRows = function(data) {
            if (data === 'undefined') {
                return;
            }
            if (data.classData === 'undefined') {
                return;
            }
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

        $scope.timelineOptions = function() {
            return {
                chart: {
                    type: 'discreteBarChart',
                    height: $scope.winWidth() *.75,
                    //width
                    margin: {
                        top: 20,
                        right: 20,
                        bottom: 200,
                        left: 70
                    },
                    x: function (d) {
                        return d.label;
                    },
                    y: function (d) {
                        return d.value;
                    },
                    showValues: false,
                    valueFormat: function (d) {
                        return d3.format(',.3f')(d);
                    },
                    transitionDuration: 500,
                    xAxis: {
                        axisLabel: 'Maneuver',
                        "axisLabelDistance": 12,
                        rotateLabels: -45
                    },
                    yAxis: {
                        axisLabel: 'Diff from Average',
                        axisLabelDistance: 30
                    }
                }
            };
        };

        $scope.timelineData = function (s) {
            var values = [];
            for (var i=0; i< s.maneuverDiff.length; i++) {
                values[i] = {label: s.maneuverRealNames[i], value: s.maneuverDiff[i]};
            }
            console.log(values);
            return [
                {
                    values: values
                }
            ];
        };
        $scope.options = {
            chart: {
                type: 'discreteBarChart',
                rotateLabels: 90,
                height: 450,
                margin : {
                    top: 20,
                    right: 20,
                    bottom: 60,
                    left: 55
                },
                x: function(d){return d.label;},
                y: function(d){return d.value;},
                showValues: false,
                valueFormat: function(d){
                    return d3.format(',.4f')(d);
                },
                transitionDuration: 500,
                xAxis: {
                    axisLabel: 'X Axis'
                },
                yAxis: {
                    axisLabel: 'Y Axis',
                    axisLabelDistance: 30
                }
            }
        };

        $scope.data = [
            {
                key: "Cumulative Return",
                values: [
                    {
                        "label" : "A" ,
                        "value" : -29.765957771107
                    } ,
                    {
                        "label" : "B" ,
                        "value" : 0
                    } ,
                    {
                        "label" : "C" ,
                        "value" : 32.807804682612
                    } ,
                    {
                        "label" : "D" ,
                        "value" : 196.45946739256
                    } ,
                    {
                        "label" : "E" ,
                        "value" : 0.19434030906893
                    } ,
                    {
                        "label" : "F" ,
                        "value" : -98.079782601442
                    } ,
                    {
                        "label" : "G" ,
                        "value" : -13.925743130903
                    } ,
                    {
                        "label" : "H" ,
                        "value" : -5.1387322875705
                    }
                ]
            }
        ];
/*
           [
            {
                key: "Cumulative Return",
                values: [
                    {
                        "label" : "A" ,
                        "value" : -29.765957771107
                    } ,
                    {
                        "label" : "B" ,
                        "value" : 0
                    } ,
                    {
                        "label" : "C" ,
                        "value" : 32.807804682612
                    } ,
                    {
                        "label" : "D" ,
                        "value" : 196.45946739256
                    } ,
                    {
                        "label" : "E" ,
                        "value" : 0.19434030906893
                    } ,
                    {
                        "label" : "F" ,
                        "value" : -98.079782601442
                    } ,
                    {
                        "label" : "G" ,
                        "value" : -13.925743130903
                    } ,
                    {
                        "label" : "H" ,
                        "value" : -5.1387322875705
                    }
                ]
            }
        ]
    })
*/
        $scope.timelineOptionsFn = function (s) {
            return {
                animate : true,
                height: $scope.winWidth(),
                width: $scope.winWidth(),
                seriesDefaults: {
                    renderer: jQuery.jqplot.BarRenderer,
                    rendererOptions: {fillToZero:true}
                },
                axesDefaults: {
                },
                axes: {
                    xaxis: {
                        renderer: $.jqplot.CategoryAxisRenderer,
                        tickRenderer: $.jqplot.CanvasAxisTickRenderer,
                        tickOptions: {
                            angle: -90,
                            fontSize: '10pt'
                        },
                        ticks: s.maneuverRealNames
                    },
                    yaxis: {
                        padMin: 0,
                        pad: 1.05
                    }
                }
            };
        };
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
                    }
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
                return {  'text-align':'center'};
            } else {
                return {  'text-align':'center'};
            }
        }

        $scope.cellStyle = function(value) {
            if (value < 1)  {
                return {'text-align': 'center', 'background': '#E60000'};
            } else if (value < 2) {
                return {'text-align': 'center', 'background': '#E52200'};
            } else if (value < 3) {
                return {'text-align': 'center', 'background': '#E44501'};
            } else if (value < 4) {
                return {'text-align': 'center', 'background': '#E46701'};
            } else if (value < 5) {
                return {'text-align': 'center', 'background': '#E38902'};
            } else if (value < 6) {
                return {'text-align': 'center', 'background': '#E3AA03'};
            } else if (value < 7) {
                return {'text-align': 'center', 'background': '#E2CB03'};
            } else if (value < 8) {
                return {'text-align': 'center', 'background': '#D7E104'};
            } else if (value < 9) {
                return {'text-align': 'center', 'background': '#B5E104'};
            } else if (value < 10) {
                return {'text-align': 'center', 'background': '#94E005'};
            } else {
                return {'text-align': 'center', 'background': '#74E006'};
            }

        }
        $scope.cellClass = function(value) {
            if (value < 1)  {
                return 'zero';
            } else if (value < 2) {
                return 'one';
            } else if (value < 3) {
                return 'two';
            } else if (value < 4) {
                return 'three';
            } else if (value < 5) {
                return 'four';
            } else if (value < 6) {
                return 'five';
            } else if (value < 7) {
                return 'six';
            } else if (value < 8) {
                return 'seven';
            } else if (value < 9) {
                return 'eight';
            } else if (value < 10) {
                return 'nine';
            } else {
                return 'ten';
            }
        }

        $scope.winWidth = function() {
            return ($window.innerWidth-100)/2 - 20;
        }

        window.onresize=function() {
            $scope.$apply();
        }
	});

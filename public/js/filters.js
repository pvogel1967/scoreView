'use strict';

/* Filters */

angular.module('myApp.filters', []).
  filter('interpolate', function (version) {
    return function (text) {
      return String(text).replace(/\%VERSION\%/mg, version);
    };
  });
  
angular.module('myApp.filters').
  filter('rowfilter', function ($window) {
    return function (data) {
      var rows = [];
	  var colCount = ($window.innerWidth >= 1200) ? 3 : 2;
	  var columns = [];
	  for (var i = 0; i< data.length; i++) {
		columns.push(data[i]);
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
  });

angular.module('myApp.filters').
  filter('roundfilter', function () {
    return function (columnContestants) {
		var rounds = [];
		var roundCount = 0;
		for (var j=0; j<columnContestants.length; j++) {
			var contestant = columnContestants[j];
			if (contestant !== null && contestant.scoringData.length > 0) {
				var firstFlightNum = parseInt(contestant.scoringData[0].flightNumber);
				var lastFlightNum = parseInt(contestant.scoringData[contestant.scoringData.length-1].flightNumber);
				if (isNaN(firstFlightNum)  && lastFlightNum > 4) {
					lastFlightNum = lastFlightNum - 3;
				}
				if (lastFlightNum > roundCount) {
					roundCount = lastFlightNum;
				}
				if (contestant.scoringData.length > roundCount) {
					roundCount = contestant.scoringData.length;
				}
			}
		}
		for (var r=1; r<=roundCount; r++) {
			rounds.push(r);
		}
		return rounds;
    };
  }).filter('scorefilter', function() {
		return function (scoringData) {
			var retData = [];
			var currentRound = 1;
			var carryOver = false
			for (var j=0; j<scoringData.length;) {
				var flightNum = parseInt(scoringData[j].flightNumber);
				if (isNaN(flightNum)) {
					flightNum = 1; //carryover from previous
					carryOver = true;
				} else if (carryOver) {
					flightNum = flightNum - 3;
				}
				if (flightNum === currentRound) {
					retData.push(scoringData[j]);
					j++;
				} else {
					retData.push({normalizedScore:'-',roundDropped:false});
				}
				currentRound++;
			}
			return retData;
		};
	});


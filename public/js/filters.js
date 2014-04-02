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
			if (contestant !== null) {
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
  });


'use strict';

/* Directives */

angular.module('myApp.directives', []).
  directive('appVersion', function (version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  });

 angular.module('myApp.directives')
  .directive('uiChart', function ($window) {
    return {
      restrict: 'EACM',
      template: '<div></div>',
      replace: true,
      link: function (scope, elem, attrs) {
        var renderChart = function () {
          var data = scope.$eval(attrs.data);
          elem.html('');
          if (!angular.isArray(data)) {
            return;
          }

          var opts = {};
          if (!angular.isUndefined(attrs.chartOptions)) {
            opts = scope.$eval(attrs.chartOptions);
            if (!angular.isObject(opts)) {
              throw 'Invalid ui.chart options attribute';
            }
          }
		      jQuery.jqplot.config.enablePlugins = true;
		      elem.attr("id", attrs.uiChart);
          jQuery.jqplot(attrs.uiChart, data, opts);
        };

        scope.$watch(attrs.uiChart, function () {
          renderChart();
        }, true);

        scope.$watch(attrs.chartOptions, function () {
          renderChart();
        });

        scope.$watch(function() { return $window.innerWidth;},function(newWidth, oldWidth) {
            if (newWidth != oldWidth) {
              renderChart();
            }
        });
        window.onresize=function() { 
          scope.$apply();
        }
      }
    };
  });
  


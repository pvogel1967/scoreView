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

angular.module('bootstrap.tabset', [])
.directive('tabset', function () {
  return {
    restrict: 'E',
    replace: true,
    transclude: true,
    controller: function($scope) {
      $scope.templateUrl = '';
      var tabs = $scope.tabs = [];
      var controller = this;
 
      this.selectTab = function (tab) {
        angular.forEach(tabs, function (tab) {
          tab.selected = false;
        });
        tab.selected = true;
      };
 
      this.setTabTemplate = function (templateUrl) {
        $scope.templateUrl = templateUrl;
      }
 
      this.addTab = function (tab) {
        if (tabs.length == 0) {
          controller.selectTab(tab);
        }
        tabs.push(tab);
      };
    },
    template:
      '<div class="row-fluid">' +
        '<div class="row-fluid">' +
          '<div class="nav nav-tabs" ng-transclude></div>' +
        '</div>' +
        '<div class="row-fluid">' +
          '<ng-include src="templateUrl">' +
        '</ng-include></div>' +
      '</div>'
  };
})
.directive('tab', function () {
  return {
    restrict: 'E',
    replace: true,
    require: '^tabset',
    scope: {
      title: '@',
      templateUrl: '@'
    },
    link: function(scope, element, attrs, tabsetController) {
      tabsetController.addTab(scope);
 
      scope.select = function () {
        tabsetController.selectTab(scope);
      }
 
      scope.$watch('selected', function () {
        if (scope.selected) {
          tabsetController.setTabTemplate(scope.templateUrl);
        }
      });
    },
    template:
      '<li ng-class="{active: selected}">' +
        '<a href="" ng-click="select()">{{ title }}</a>' +
      '</li>'
  };
});

  


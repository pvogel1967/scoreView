angular.module('ng-xCharts', [])
    .directive('xchart', function () {
        var graphIdCount = 0;
        return {
            restrict: 'EACM',
            template: '<figure></figure>',
            replace: true,

            link: function (scope, elem, attrs) {
                var elemId;
                elemId = elem.attr('id');
                if (elemId === undefined || elemId === null) {
                    graphIdCount += 1;
                    elemId = 'graph-' + graphIdCount;
                    elem.attr('id', elemId);
                }
                var chart = null;
                scope.$watch(attrs.data, function (v) {
                    if (!chart) {
                        chart = new xChart(v.type, v, '#' + elemId);
                    } else {
                        chart.setData(v);
                    }
                }, true);
            }
        };
    });

'use strict';

angular.module('MozMap', [])
.controller('MozMapController', function ($scope, $http) {

	var featureLayer,
		map,
		colors = {
			city: '#c13832',
			region: '#c3716d',
			country: '#c3a9a8'
		},
		filterExpressions = [
			'settings.irc',
			'filter.vouched',
			'filter.precision.city',
			'filter.precision.region',
			'filter.precision.country',
			'filter.precision.none'
		];

	$scope.mozillians = [];
	$scope.activeUser = null;

	$scope.settings = {
		irc: false
	};

	$scope.queries = [];
	$scope.filter = {
		vouched: true,
		country: {},
		group: {},
		precision: {
			city: true,
			region: true,
			country: true,
			none: true
		}
	};

	$scope.precisionFilter = function (user) {
		return (
			($scope.filter.precision.city && user.city) ||
			($scope.filter.precision.region && user.region && !user.city) ||
			($scope.filter.precision.country && user.country && !user.region && !user.city) ||
			($scope.filter.precision.none && !user.map_data)
		);
	};

	$scope.queryFilter = function (user) {
		var i, type, value,
			len = $scope.queries.length;

		if ($scope.filter.vouched && !user.is_vouched) {
			return false;
		}

		for (i = 0; i < len; i++) {
			type = $scope.queries[i].type;
			value = $scope.queries[i].value;

			if ($scope.filter[type][value] && ( // tests if filter is checked
				(type === 'country' && user.country === value) ||
				(type === 'group' && user.groups.indexOf(value) !== -1)
			)) {
				return true;
			}
		}

		return false;
	};

	$scope.openPopup = function (user) {
		if (user.marker) {
			user.marker.openPopup();
		} else if ($scope.activeUser && $scope.activeUser.marker) {
			$scope.activeUser.marker.closePopup();
		}
		$scope.activeUser = user;
	};

	$http.get('./webconf.json').then(function (res) {

		L.mapbox.accessToken = res.data.mapbox_access_token;

		map = L.mapbox.map('map', 'mapbox.streets');

		$scope.queries = res.data.queries;
		angular.forEach($scope.queries, function (query) {
			$scope.filter[query.type][query.value] = query.default;
			filterExpressions.push('filter.' + query.type + '["' + query.value + '"]');
		});

		$http.get('./mozillians.json').then(function (res) {

			$scope.mozillians = res.data;

			for (var i = 0; i < $scope.mozillians.length; i++) {
				var user = $scope.mozillians[i];
				createLocationDetails(user);
			}

			featureLayer = new L.mapbox.featureLayer();
			featureLayer.addTo(map);

			updateLayers();

			$scope.$watchGroup(filterExpressions, function (oldVal, newVal) {
				updateLayers();
			});
		});
	});

	function updateLayers() {
		featureLayer.clearLayers();

		for (var i = 0; i < $scope.mozillians.length; i++) {
			var user = $scope.mozillians[i];
			if (user.map_data && $scope.precisionFilter(user) && $scope.queryFilter(user)) {
				addMarker(user);
			}
		}

		if (featureLayer.getLayers().length > 0) {
			map.fitBounds(featureLayer.getBounds());
		}
	}

	function addMarker(user) {
		user.marker = L.marker([user.map_data.center[1], user.map_data.center[0]], {
				icon: L.mapbox.marker.icon({
					'marker-color': colors[user.locationAccuracy]
				})
			})
			.bindPopup(getPopUpHTML(user))
			.addTo(featureLayer)
			.on('click', function (e) {
				$scope.activeUser = user;
				$scope.$apply();
			});
	}

	function getPopUpHTML(user) {
		return (
			'<div class="popup_main">' +

				'<img src="' + (user.photo ? user.photo : 'images/mozillian.png') + '" alt="Picture" width="50" height="50">' +

				'<div class="text_info">' +
					// name
					'<b>' + (user.full_name || user.username) + '</b>' +

					// vouch status
					(user.is_vouched
						? '' // ' <i class="fa fa-check" title="Andere Mozillianer haben für dieses Profil gebürgt."></i>'
						: ' <i class="fa fa-exclamation-circle" title="Für dieses Profil wurde noch nicht gebürgt."></i>') +

					'<br>' +

					// irc
					($scope.settings.irc && user.ircname
					    ? ('<i class="fa fa-fw fa-comments" title="IRC"></i> ' + user.ircname + '<br>') : '') +

					// location
					(user.location ? ('<i class="fa fa-fw fa-map-marker"></i> ' + user.location + '<br>') : '') +

					// profile
					'<i class="fa fa-fw fa-globe"></i> <a href="' + user.url + '" target="_blank">Mozillianer-Profil</a>' +

				'</div>'+

			'</div>' +

			'<div style="clear:both"></div>');
	}

	function createLocationDetails(user) {
		var location = [];

		if (user.city) {
			location.push(user.city);
		}
		if (user.region) {
			location.push(user.region);
		}
		if (user.country) {
			location.push(user.country);
		}

		user.location = location.join(', ');

		if (user.city) {
			user.locationAccuracy = 'city';
		} else if (user.region) {
			user.locationAccuracy = 'region';
		} else if (user.country) {
			user.locationAccuracy = 'country';
		}
	}

})

.directive('scrollIf', function () {
	var mozilliansContainer = document.getElementById('userlist-container');

	return function (scope, element, attrs) {
		scope.$watch(attrs.scrollIf, function (value) {
			if (scope.$eval(attrs.scrollIf)) {
				var el = element[0],
					elPos = el.offsetTop,
					mcPos = mozilliansContainer.scrollTop,
					upperEnd = 20,
					lowerEnd = mozilliansContainer.offsetHeight - el.offsetHeight - 20;

				if (elPos < mcPos + upperEnd) {
					$(mozilliansContainer).animate({ scrollTop: el.offsetTop - upperEnd });
				} else if (elPos > mcPos + lowerEnd) {
					$(mozilliansContainer).animate({ scrollTop: el.offsetTop - lowerEnd });
				}
			}
		});
	}
});

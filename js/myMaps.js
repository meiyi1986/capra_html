var map = null;
var chart = null;
	    
var elevationService = null;
var directionsService = null;
var directionsDisplay = null;

var mousemarker = null;
var elevations = null;
var infowindow = null;

var SAMPLES = 256;
var COLORS = ['#99FF33', '#009999', '#FFFF99', '#FF66FF', 
              '#FF9999', '#800000', '#FF0000', '#FF9900'];

var path_capra = null;
var path_google = null;
var path_Moa = [];
var path_moa_points = [];
	    
google.load("visualization", "1", {packages: ["columnchart"]});
	    
function initialize() {
	var mapOptions = {
			zoom: 8,
			center: new google.maps.LatLng(-37.8140000, 144.9633200)
	};

	map = new google.maps.Map(
			document.getElementById('map-canvas'), mapOptions);
	chart = new google.visualization.ColumnChart(
			document.getElementById('elevation_chart'));

	infowindow = new google.maps.InfoWindow();
	elevationService = new google.maps.ElevationService(); 
	directionsService = new google.maps.DirectionsService();
	directionsDisplay = new google.maps.DirectionsRenderer();

	// Add a listener for checking elevation value of a particular point
	google.maps.event.addListener(map, 'click', getElevation);
	// Add a listener for Path Tracker
	google.visualization.events.addListener(chart, 'onmouseover', getMarker);

	// Create an empty elevation chart
	var dummyData = new google.visualization.DataTable();
	dummyData.addColumn('string', 'Sample');
	dummyData.addColumn('number', 'Elevation');
	for (var i = 0; i < SAMPLES; i++) {
		dummyData.addRow(['', 0]);
	}

	document.getElementById('elevation_chart').style.display = 'block';
	chart.draw (dummyData, {
		height: 150,
		legend: 'none',
		titleY: 'Elevation(m)'
	});
}
	    
function getElevation(event) {
	var locations = [];

	// Retrieve the clicked location and push it on the array
	var clickedLocation = event.latLng;
	locations.push(clickedLocation);

	// Create a LocationElevationRequest object using the array's one value
	var positionalRequest = {
			'locations' : locations
	}

	// Initiate the location request
	elevationService.getElevationForLocations(positionalRequest,
			function(results, status) {
		if (status == google.maps.ElevationStatus.OK) {

			// Retrieve the first result
			if (results[0]) {

				// Open an info window indicating the elevation at the clicked position
				infowindow.setContent('The elevation at this point <br>is '
						+ parseInt(results[0].elevation)
						+ ' meters.');
				infowindow.setPosition(clickedLocation);
				infowindow.open(map);
			} 
			else {
				alert('No results found');
			}
		} 
		else {
			alert('Elevation service failed due to: ' + status);
		}
	});
}
	   	
function getMarker(event) {  	  
	if (mousemarker == null) {
		mousemarker = new google.maps.Marker({
			position: elevations[event.row].location,
			map: map,
			icon: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
		});
	} 
	else {
		mousemarker.setPosition(elevations[event.row].location);
	}
}

function plotElevation(results, status) {
	if (status != google.maps.ElevationStatus.OK) {
		return;
	}
	elevations = results;

	var elevationPath = [];
	var length = results.length
	for (var i = 0; i < length; i++) {
		elevationPath.push(elevations[i].location);
	}

	var data = new google.visualization.DataTable();
	data.addColumn('string', 'Sample');
	data.addColumn('number', 'Elevation');
	
	for (var i = 0; i < length; i++) {
		data.addRow(['', elevations[i].elevation]);
	}

	document.getElementById('elevation_chart').style.display = 'block';
	chart.draw (data, {
		height: 150,
		legend: 'none',
		titleY: 'Elevation(m)'
	});
}
	   	
function updateSolutions() {
	var mapOptions = {
			zoom:8,
			mapTypeId: 'terrain'
	};	   	  
	map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
	
	google.visualization.events.addListener(chart, 'onmouseover', getMarker);
	
	// Add a listener for checking elevation value of a particular point
	google.maps.event.addListener(map, 'click', getElevation);
	google.visualization.events.addListener(chart, 'onmouseover', getMarker);

	calcRoute();
	directionsDisplay.setMap(map);

	calcPath();
	path_capra.setMap(map);

	path_Moa = [];
	for (var i = 0; i < getMoaSize(); i++) {
		calcMoa(i);
		path_Moa[i].setMap(map);
		google.maps.event.addListener(path_Moa[i], 'click', getLine);
		path_Moa[i].getPath().forEach(function(routePoint, index) {
			var point = {
					point: routePoint,
					pathIndex: i
			};
			path_moa_points.push(point);
		})
	}

	selectTab(0);
}

function calcRoute() {
	var startLat = getStartLat();
	var startLng = getStartLng();
	var endLat = getEndLat();
	var endLng = getEndLng();
	var start = new google.maps.LatLng(startLat, startLng);
	var end = new google.maps.LatLng(endLat, endLng);
	var request = {
			origin:start,
			destination:end,
			travelMode: google.maps.TravelMode.WALKING
	};
	directionsService.route(request, function(response, status) {
		if (status == google.maps.DirectionsStatus.OK) {
			directionsDisplay.setDirections(response);
			path_google = response.routes[0];
		}
	});
}

// Load path data that is generated by original CAPRA algorithm
function calcPath() {
	var pathPlanCoordinates = [];
	var size = getPathSize(0);

	var startLat = getStartLat();
	var startLng = getStartLng();
	var endLat = getEndLat();
	var endLng = getEndLng();

	pathPlanCoordinates.push(new google.maps.LatLng(startLat, startLng));

	var firstLat = getFirstLat(0);
	var firstLng = getFirstLng(0);
	pathPlanCoordinates.push(new google.maps.LatLng(firstLat, firstLng));

	for (i = 0; i < size; i++) {
		var lat = getLat(i, 0);
		var lng = getLng(i, 0);
		pathPlanCoordinates.push(new google.maps.LatLng(lat, lng));
	}
	pathPlanCoordinates.push(new google.maps.LatLng(endLat, endLng));

	path_capra = new google.maps.Polyline({
		path: pathPlanCoordinates,
		geodesic: true,
		strokeColor: '#FF0000',
		strokeOpacity: 0.6,
		strokeWeight: 4
	});    
}

function calcMoa(pathIndex) {
	var pathPlanCoordinates = [];
	var size = getMoaPathSize(pathIndex);
	var startLat = getStartLat();
	var startLng = getStartLng();
	var endLat = getEndLat();
	var endLng = getEndLng();

	pathPlanCoordinates.push(new google.maps.LatLng(startLat, startLng));

	var firstLat = getMoaFirstLat(pathIndex);
	var firstLng = getMoaFirstLng(pathIndex);
	pathPlanCoordinates.push(new google.maps.LatLng(firstLat, firstLng));

	for (var j = 0; j < size; j++) {
		var lat = getMoaLat(j, pathIndex);
		var lng = getMoaLng(j, pathIndex);
		pathPlanCoordinates.push(new google.maps.LatLng(lat, lng));
	}
	pathPlanCoordinates.push(new google.maps.LatLng(endLat, endLng));

	var lineSymbol = {
			path: 'M 0,-1 0,1',
			strokeOpacity: 1,
			scale: 4
	};
	
	var color = getRandomColor();

	var newPath = new google.maps.Polyline({
		path: pathPlanCoordinates,
		geodesic: true,
		strokeColor: color,
		strokeOpacity: 0.6,
		strokeWeight: 2,
		icons: [{
			icon: lineSymbol,
			offset: '0',
			repeat: '20px'
		}]
	});

	path_Moa.push(newPath);
}

function getLine(pathIndex) {
	var currentPath = path_Moa[pathIndex - 1].getPath().getArray();
	
	showElevationChart(currentPath);
	displayInfomation(pathIndex);
}

function showElevationChart(path) {
	var pathRequest = {
			path: path,
			samples: SAMPLES
	}

	elevationService.getElevationAlongPath(pathRequest, plotElevation);
}

function selectTab(index) {
	if (index < 0) {
		showElevationChart(path_google.overview_path);
        displayInfomation(-1);
	}
	else if (index == 0) {
		showElevationChart(path_capra.getPath().getArray());
        displayInfomation(0);
	}
	else {
		getLine(index);
	}
}

function displayInfomation(pathIndex) {
	document.getElementById("distance").innerHTML = getDistance(pathIndex);
}

function displaySystemInfomation() {
	document.getElementById("system_infomation").innerHTML = getSysteInfomation();
}

function showDistribution() {
	var lat = (getStartLat() + getEndLat()) / 2;
	var lng = (getStartLng() + getEndLng()) / 2;
	var mapOptions = {
			zoom:15,
			center: new google.maps.LatLng(lat, lng)
	};

	map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
	
	// Add a listener for checking elevation value of a particular point
	google.maps.event.addListener(map, 'click', getElevation);

	var edgeSize = getEdgeSize();
	for (i = 0; i < edgeSize; i++) {
		var edgeStartLat = getEdgeStartLat(i);
		var edgeStartLng = getEdgeStartLng(i);
		var edgeEndLat = getEdgeEndLat(i);
		var edgeEndLng = getEdgeEndLng(i);
		var weight = getEdgeWeight(i);
		var edgeCoordinate = [
		                      new google.maps.LatLng(edgeStartLat, edgeStartLng), 
		                      new google.maps.LatLng(edgeEndLat, edgeEndLng)
		                      ]
		var color;
		switch (weight) {
		case 1 : color = '#00CC00';
		break;
		case 2 : color = '#3399FF';
		break;
		case 3 : color = '#FFFF00';
		break;
		default : color = '#FF0000';    
		}

		var edge = new google.maps.Polyline({
			path: edgeCoordinate,
			geodesic: true,
			strokeColor: color,
			strokeOpacity: 0.6,
			strokeWeight: 4
		});
		edge.setMap(map);
	}
}

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

google.maps.event.addDomListener(window, 'load', initialize);
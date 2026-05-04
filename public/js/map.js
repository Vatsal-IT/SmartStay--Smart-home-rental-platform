// 1. Get coordinates from the listing object (passed from show.ejs)
let coordinates = [28.6139, 77.2088]; // Default: Delhi
let locationName = "Exact Location";

if (listing.geometry && listing.geometry.coordinates && listing.geometry.coordinates.length === 2) {
    // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    coordinates = [listing.geometry.coordinates[1], listing.geometry.coordinates[0]];
    locationName = listing.location;
}

// 2. Initialize Map
var map = L.map('map').setView(coordinates, 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 3. Add Marker
L.marker(coordinates)
    .addTo(map)
    .bindPopup(`<h4>${listing.title}</h4><p>${locationName}</p>`)
    .openPopup();

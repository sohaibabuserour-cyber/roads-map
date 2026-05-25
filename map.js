export function initMap() {
  const map = L.map('map').setView([24.7, 46.7], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(map);

  // ✅ الحل هنا
  const basePath = window.location.pathname.includes('roads-map')
    ? '/roads-map/'
    : '/';

  fetch(basePath + 'ROADS.geojson')
    .then(res => res.json())
    .then(data => {
      console.log('GeoJSON loaded ✅');
      L.geoJSON(data).addTo(map);
    })
    .catch(err => {
      console.error('GeoJSON ERROR ❌:', err);
    });
}

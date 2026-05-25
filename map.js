export function initMap(){
 const map=L.map('map').setView([24.7,46.7],10);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

 fetch('./ROADS.geojson').then(r=>r.json()).then(data=>{
  L.geoJSON(data).addTo(map);
 });

 console.log('map loaded');
}
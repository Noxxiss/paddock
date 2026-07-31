import L from 'leaflet';

export const OSM_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
});

export const SATELLITE_LAYER = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  }
);

export function addBasemapControls(map) {
  const baseMaps = {
    OpenStreetMap: OSM_LAYER,
    Satellite: SATELLITE_LAYER,
  };
  OSM_LAYER.addTo(map);
  L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);
}

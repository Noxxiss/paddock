import L from 'leaflet';

const SnapToggle = L.Control.extend({
  options: {
    position: 'topleft',
  },

  onAdd: function (map) {
    this._map = map;
    this._active = true;

    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    container.id = 'snap-toggle';
    container.title = 'Snap to paddock boundaries';
    container.style.backgroundColor = 'white';
    container.style.width = '34px';
    container.style.height = '34px';
    container.style.cursor = 'pointer';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.borderRadius = '4px';
    container.style.border = '2px solid rgba(0,0,0,0.2)';
    container.style.backgroundClip = 'padding-box';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = `
      <path d="M21 21l-6-6" />
      <path d="M3 11a8 8 0 0 1 16 0" />
      <path d="M3 11a8 8 0 0 0 16 0" />
      <circle cx="11" cy="11" r="2" />
    `;
    container.appendChild(svg);

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(container, 'click', () => {
      this._active = !this._active;
      container.style.borderColor = this._active ? 'rgba(0,0,0,0.2)' : '#ccc';
      container.style.opacity = this._active ? '1' : '0.5';
      map.fire('snap:toggle', { enabled: this._active });
    });

    return container;
  },

  isEnabled: function () {
    return this._active;
  },
});

export default SnapToggle;

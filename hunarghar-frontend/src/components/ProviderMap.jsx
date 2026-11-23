import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

/** City-level markers only – the backend never sends exact coordinates (SFR-17). */
export default function ProviderMap({ markers }) {
  const el = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([30.4, 69.3], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    // spread providers of the same city slightly so markers don't stack
    const seen = {};
    markers.forEach((m) => {
      const k = `${m.latitude},${m.longitude}`; const n = (seen[k] = (seen[k] || 0) + 1) - 1;
      const lat = Number(m.latitude) + Math.sin(n * 2.4) * 0.03 * Math.ceil(n / 6);
      const lng = Number(m.longitude) + Math.cos(n * 2.4) * 0.03 * Math.ceil(n / 6);
      const icon = L.divIcon({ className: '', html: `<div style="background:#b83a5a;color:#fff;border:2px solid #fff;border-radius:999px;width:30px;height:30px;display:grid;place-items:center;font:700 12px sans-serif;box-shadow:0 1px 4px #0005">${(m.full_name || '?')[0]}</div>`, iconSize: [30, 30] });
      const pop = document.createElement('div');
      pop.innerHTML = `<strong></strong><br><span></span><br><a href="#" style="color:#2c2f73;font-weight:600">View profile</a>`;
      pop.querySelector('strong').textContent = m.full_name;
      pop.querySelector('span').textContent = `${m.city || ''} · ★ ${Number(m.avg_rating || 0).toFixed(1)}`;
      pop.querySelector('a').onclick = (e) => { e.preventDefault(); nav(`/providers/${m.provider_id}`); };
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(pop);
    });
    return () => map.remove();
  }, [markers, nav]);
  return <div ref={el} className="h-[28rem] w-full overflow-hidden rounded-2xl border border-indigo/10" role="img" aria-label="Map of provider locations (city level)" />;
}

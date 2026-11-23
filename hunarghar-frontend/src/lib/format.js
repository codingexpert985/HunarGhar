export const pkr = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
export const dt = (v) => (v ? new Date(v).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
export const d = (v) => (v ? new Date(v).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '–');
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Peshawar', 'Quetta', 'Multan', 'Hyderabad', 'Sialkot'];
export const CATEGORY_ICON = { tailoring: '🧵', cooking: '🍲', tutoring: '📚', beauty: '💄', handicrafts: '🧶' };
export const iconFor = (cat = '') => CATEGORY_ICON[cat.toLowerCase()] || '✨';


import { Link } from 'react-router-dom';
import { Avatar, Badge, Stars } from './ui.jsx';
import { iconFor, pkr } from '../lib/format.js';

export default function ProviderCard({ p }) {
  const cats = [...new Set((p.services || []).map((s) => s.category))];
  const place = [p.area, p.city].filter(Boolean).join(', ');
  const rating = Number(p.avg_rating || 0);

  return (
    <Link
      to={`/providers/${p.provider_id}`}
      className="provider-card group"
    >
      <div className="provider-card-top">
        <Avatar name={p.full_name} size="h-14 w-14 text-lg" />

        <div className="provider-card-identity">
          <h3>{p.full_name}</h3>
          <p>{place || 'Location not set'}</p>
        </div>

        <span className="provider-card-arrow" aria-hidden="true">↗</span>
      </div>

      <div className="provider-card-badge">
        <Badge status={p.verification_status === 'verified' ? 'verified' : 'unverified'} />
      </div>

      <div className="provider-card-rating">
        <Stars value={rating} />
        <strong>{rating.toFixed(1)}</strong>
        <span>({p.review_count || 0} reviews)</span>
      </div>

      {p.bio ? (
        <p className="provider-card-bio">{p.bio}</p>
      ) : (
        <p className="provider-card-bio muted">
          Discover this provider's available services and skills.
        </p>
      )}

      <div className="provider-card-bottom">
        <div className="provider-card-categories">
          {cats.slice(0, 2).map((category) => (
            <span key={category}>
              {iconFor(category)} {category}
            </span>
          ))}
          {cats.length > 2 && <span>+{cats.length - 2} more</span>}
          {cats.length === 0 && <span>Services available on profile</span>}
        </div>

        {p.min_price != null && (
          <div className="provider-card-price">
            <small>Starting from</small>
            <strong>{pkr(p.min_price)}</strong>
          </div>
        )}
      </div>

      <div className="provider-card-footer">
        <span>View provider profile</span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

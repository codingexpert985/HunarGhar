import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../components/useLoad.js';
import ProviderCard from '../components/ProviderCard.jsx';
import { iconFor } from '../lib/format.js';
import { Spinner } from '../components/ui.jsx';
import InspirationGallery from '../components/InspirationGallery.jsx';

const EXAMPLES = [
  'I need a tailor in Karachi under 3000',
  'Home tutor for O-level maths in Lahore',
  'Bridal mehndi artist',
  'Homemade biryani for 20 guests'
];

const STEPS = [
  ['01', 'Discover', 'Find talented women by service, city, price and rating.'],
  ['02', 'Send a request', 'Choose a provider and share what you need.'],
  ['03', 'Connect', 'Discuss details directly through your booking chat.'],
  ['04', 'Confirm', 'Track your booking and confirm the demo payment.']
];

const HERO_IMAGES = [
  { src: '/images/tailoring.png', alt: 'Tailoring and stitching', className: 'hero-photo-one' },
  { src: '/images/beauty.png', alt: 'Beauty and makeup', className: 'hero-photo-two' },
  { src: '/images/cooking.png', alt: 'Homemade cooking', className: 'hero-photo-three' },
  { src: '/images/mehendi.png', alt: 'Mehndi art', className: 'hero-photo-four' }
];

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const cats = useLoad(() => api.get('/categories'));
  const top = useLoad(() => api.get('/providers', { sort: 'rating', limit: 6 }));
  const ask = (text) => nav(`/assistant?q=${encodeURIComponent(text)}`);

  return (
    <div className="home-page">
      <section className="hero-section home-hero-advanced">
        <div className="hero-pattern" aria-hidden="true" />
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="hero-eyebrow-dot" /> A HOME FOR EVERY TALENT</div>
          <h1>Her talent.<br /><span>Her opportunity.</span></h1>
          <p className="hero-description">
            Discover the talented women behind beautiful handmade work, delicious food,
            expert teaching and services that make everyday life special.
          </p>
          <form className="hero-search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q.trim()); }}>
            <div className="hero-input-wrap">
              <span className="hero-search-icon" aria-hidden="true">⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What service are you looking for?" aria-label="Describe the service you need" />
            </div>
            <button className="hero-search-button" type="submit">Explore services <span aria-hidden="true">↗</span></button>
          </form>
          <div className="hero-suggestions">
            <span>Popular:</span>
            {EXAMPLES.map((item) => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}
          </div>
          <div className="hero-actions">
            <Link to="/search" className="hero-secondary-link">Browse all services <span aria-hidden="true">→</span></Link>
            <span className="hero-action-divider">·</span>
            <Link to="/register?role=provider" className="hero-secondary-link">Become a provider</Link>
          </div>
        </div>

        <div className="hero-image-stage" aria-label="A collage of services available on HunarGhar">
          <div className="hero-image-halo" />
          {HERO_IMAGES.map((item) => (
            <div className={`hero-floating-photo ${item.className}`} key={item.src}>
              <img src={item.src} alt={item.alt} />
            </div>
          ))}
          <div className="hero-round-sticker"><span>Made with</span><strong>♥</strong><span>by her</span></div>
          <div className="hero-image-note"><span className="hero-note-star">✦</span><span>Skills that bring<br />people together</span></div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section className="trust-strip" aria-label="HunarGhar benefits">
        <div className="trust-item"><span className="trust-symbol">✿</span><div><h3>Women-led talent</h3><p>Celebrate skills from home</p></div></div>
        <div className="trust-item"><span className="trust-symbol">⌖</span><div><h3>Find nearby services</h3><p>Explore providers across Pakistan</p></div></div>
        <div className="trust-item"><span className="trust-symbol">♡</span><div><h3>Connect with confidence</h3><p>Clear bookings and communication</p></div></div>
      </section>

      <InspirationGallery />

      <section className="home-section" aria-labelledby="categories-title">
        <div className="section-heading">
          <div><span className="section-kicker">FIND YOUR PERFECT MATCH</span><h2 id="categories-title">Explore by service</h2><p>From everyday essentials to the little details that make an occasion special.</p></div>
          <Link to="/search" className="section-link">View all services <span>→</span></Link>
        </div>
        {cats.loading ? <Spinner /> : cats.error ? <div className="home-message error-message">{cats.error.message}</div> : (
          <div className="category-grid">
            {(cats.data?.categories || []).map((category, index) => (
              <Link key={category.category_id} to={`/search?category=${encodeURIComponent(category.name)}`} className="category-card">
                <span className={`category-icon category-icon-${index % 5}`} aria-hidden="true">{iconFor(category.name)}</span>
                <span className="category-arrow" aria-hidden="true">↗</span>
                <div className="category-card-content"><h3>{category.name}</h3><p>{category.description || 'Discover talented local service providers.'}</p></div>
              </Link>
            ))}
            {!cats.data?.categories?.length && <div className="home-message">Service categories will appear here soon.</div>}
          </div>
        )}
      </section>

      <section className="home-section" aria-labelledby="providers-title">
        <div className="section-heading">
          <div><span className="section-kicker">COMMUNITY FAVOURITES</span><h2 id="providers-title">Meet our top providers</h2><p>Discover skilled people making a difference through their work.</p></div>
          <Link to="/search" className="section-link">Find a provider <span>→</span></Link>
        </div>
        {top.loading ? <Spinner /> : top.error ? <div className="home-message error-message">{top.error.message}</div> : (
          <div className="provider-grid">{(top.data?.providers || []).map((provider) => <ProviderCard key={provider.provider_id} p={provider} />)}</div>
        )}
        {!top.loading && !top.error && !top.data?.providers?.length && <div className="home-message">New providers are joining HunarGhar. Check back soon.</div>}
      </section>

      <section className="how-section home-section" aria-labelledby="how-title">
        <div className="how-intro">
          <span className="section-kicker">SIMPLE FROM START TO FINISH</span>
          <h2 id="how-title">A few simple steps to make it happen.</h2>
          <p>Whether you need a service or want to share your talent, HunarGhar makes getting started simple.</p>
          <Link to="/search" className="btn-primary how-button">Get started <span>→</span></Link>
        </div>
        <div className="steps-list">
          {STEPS.map(([number, title, description]) => <div className="step-row" key={number}>
            <span className="step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="step-check">✦</span>
          </div>)}
        </div>
      </section>

      <section className="provider-cta home-section">
        <div className="provider-cta-content">
          <span className="section-kicker">YOUR SKILL DESERVES TO SHINE</span>
          <h2>Turn what you love into an opportunity.</h2>
          <p>Are you a tailor, baker, tutor, artist or creative professional? Create your profile, showcase your work and connect with people who need your skills.</p>
          <Link to="/register?role=provider" className="provider-cta-button">Join HunarGhar <span>↗</span></Link>
        </div>
        <div className="provider-cta-art" aria-hidden="true"><span className="cta-ring cta-ring-one" /><span className="cta-ring cta-ring-two" /><span className="cta-heart">♡</span><img src="/images/embroidery.png" alt="" /></div>
      </section>
      <p className="home-disclaimer">HunarGhar is a student project. Payments shown on this website are demonstrations only; no real money is moved.</p>
    </div>
  );
}

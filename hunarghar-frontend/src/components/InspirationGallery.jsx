import { Link } from 'react-router-dom';
import './InspirationGallery.css';

const categories = [
  { title: 'Tailoring & Stitching', description: 'Custom dresses, alterations and stitching', image: '/images/tailoring.png', tag: 'Made to measure' },
  { title: 'Beauty & Makeup', description: 'Bridal makeup, skincare and beauty services', image: '/images/beauty.png', tag: 'Feel beautiful' },
  { title: 'Mehndi & Henna', description: 'Beautiful henna designs for every occasion', image: '/images/mehendi.png', tag: 'Artistry' },
  { title: 'Cooking & Baking', description: 'Homemade food, cakes and desserts', image: '/images/cooking.png', tag: 'Made at home' },
  { title: 'Embroidery & Crafts', description: 'Handmade gifts and creative work', image: '/images/embroidery.png', tag: 'Handcrafted' },
  { title: 'Teaching & Tutoring', description: 'Academic help and skill lessons', image: '/images/teaching.png', tag: 'Learn together' },
  { title: 'Fashion Designing', description: 'Creative designs and custom outfits', image: '/images/fashion.png', tag: 'Personal style' },
  { title: 'Home Services', description: 'Helpful services for everyday needs', image: '/images/home-services.png', tag: 'Here to help' }
];

export default function InspirationGallery() {
  return (
    <section className="hg-inspiration home-section" aria-labelledby="inspiration-title">
      <div className="hg-section-heading">
        <div>
          <span className="section-kicker">A WORLD OF WOMEN'S TALENT</span>
          <h2 id="inspiration-title">Discover skills.<br /><em>Celebrate talent.</em></h2>
          <p>Little passions. Beautiful skills. Big possibilities.</p>
        </div>
        <Link to="/search" className="section-link">Explore all services <span>→</span></Link>
      </div>

      <div className="hg-category-grid">
        {categories.map((category, index) => (
          <Link className={`hg-category-card hg-card-${index + 1}`} to={`/search?category=${encodeURIComponent(category.title)}`} key={category.title}>
            <div className="hg-category-image">
              <img src={category.image} alt={category.title} loading="lazy" />
              <span className="hg-category-tag">{category.tag}</span>
              <span className="hg-image-arrow" aria-hidden="true">↗</span>
            </div>
            <div className="hg-category-info"><h3>{category.title}</h3><p>{category.description}</p></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

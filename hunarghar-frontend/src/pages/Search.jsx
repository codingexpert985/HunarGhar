
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from '../components/useLoad.js';
import ProviderCard from '../components/ProviderCard.jsx';
import ProviderMap from '../components/ProviderMap.jsx';
import { Empty, ErrorNote, PageHead, Spinner } from '../components/ui.jsx';
import { CITIES } from '../lib/format.js';

/* Custom dropdown with readable options */

function FilterDropdown({ id, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected =
    options.find((option) => option.value === value) || options[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex min-h-[46px] w-full items-center justify-between rounded-xl border-2 border-[#d9d7e9] bg-white px-4 py-2.5 text-left text-[16px] font-medium text-[#292b50] transition hover:border-[#9d6680] focus:border-[#39347e] focus:outline-none focus:ring-2 focus:ring-[#39347e]/15"
      >
        <span>{selected.label}</span>

        <span
          className={`ml-3 text-xl transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 top-full z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#e4ddea] bg-white p-1.5 shadow-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-4 py-3 text-left text-[16px] leading-6 transition ${
                value === option.value
                  ? 'bg-[#eeeaf8] font-bold text-[#39347e]'
                  : 'font-medium text-[#33334d] hover:bg-[#f8f1f4] hover:text-[#963e61]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


const PRICE_MIN = 700;
const PRICE_MAX = 9000;
const PRICE_MESSAGE = `Prices on HunarGhar range from PKR ${PRICE_MIN} to PKR 9,000. Please enter an amount within this range.`;

function checkPrice(min, max) {
  const lo = min === '' ? null : Number(min);
  const hi = max === '' ? null : Number(max);
  const outside = (n) => n !== null && (!Number.isFinite(n) || n < PRICE_MIN || n > PRICE_MAX);
  if (outside(lo) || outside(hi)) return PRICE_MESSAGE;
  if (lo !== null && hi !== null && lo > hi) return 'Min price cannot be higher than max price.';
  return '';
}

const KEYS = [
  'category',
  'city',
  'minPrice',
  'maxPrice',
  'minRating',
  'sort',
  'verifiedOnly'
];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('list');

  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']));
  const page = Number(params.get('page') || 1);

  const [draft, setDraft] = useState(f);
  const [priceError, setPriceError] = useState('');

  useEffect(() => setDraft(f), [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = useLoad(() => api.get('/categories'));
  const res = useLoad(
    () => api.get('/providers', { ...f, page, limit: 9 }),
    [params.toString()]
  );

  const map = useLoad(
    () => (view === 'map' ? api.get('/providers/map') : Promise.resolve(null)),
    [view]
  );

  const apply = (e) => {
    e?.preventDefault();

    const problem = checkPrice(draft.minPrice, draft.maxPrice);
    setPriceError(problem);
    if (problem) return;

    const next = {};
    KEYS.forEach((k) => {
      if (draft[k]) next[k] = draft[k];
    });

    setParams(next);
  };

  const clear = () => {
    setPriceError('');
    setParams({});
  };

  const goPage = (p) =>
    setParams({ ...Object.fromEntries(params), page: p });

  const set = (k) => (e) =>
    setDraft({
      ...draft,
      [k]:
        e.target.type === 'checkbox'
          ? e.target.checked
            ? 'true'
            : ''
          : e.target.value
    });

  const setDropdown = (key) => (value) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const data = res.data;
  const hasFilters = KEYS.some((k) => f[k]);

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...(cats.data?.categories || []).map((c) => ({
      value: c.name,
      label: c.name
    }))
  ];

  const ratingOptions = [
    { value: '', label: 'Any rating' },
    { value: '4.5', label: '4.5+ stars' },
    { value: '4', label: '4+ stars' },
    { value: '3', label: '3+ stars' },
    { value: '2', label: '2+ stars' }
  ];

  const sortOptions = [
    { value: '', label: 'Highest rated' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'newest', label: 'Newest' }
  ];

  return (
    <>
      <PageHead title="Find a service">
        <div
          className="flex rounded-full border border-indigo/20 p-0.5 text-sm font-semibold"
          role="group"
          aria-label="Result view"
        >
          {['list', 'map'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-4 py-1.5 capitalize ${
                view === v ? 'bg-indigo text-white' : 'text-ink/60'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <form
          onSubmit={apply}
          className="card h-fit space-y-4 p-5"
          aria-label="Filters"
        >
          {/* CATEGORY */}
          <div>
            <label className="label mb-2 block" htmlFor="fc">
              Category
            </label>

            <FilterDropdown
              id="fc"
              value={draft.category}
              options={categoryOptions}
              onChange={setDropdown('category')}
            />
          </div>

          {/* CITY */}
          <div>
            <label className="label" htmlFor="fl">
              City or area
            </label>

            <input
              id="fl"
              list="cities"
              className="input"
              value={draft.city}
              onChange={set('city')}
              placeholder="Any location"
            />

            <datalist id="cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* PRICE */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="fmin">
                Min price
              </label>

              <input
                id="fmin"
                type="number"
                min={PRICE_MIN}
                max={PRICE_MAX}
                className="input"
                value={draft.minPrice}
                onChange={set('minPrice')}
                placeholder="PKR"
              />
            </div>

            <div>
              <label className="label" htmlFor="fmax">
                Max price
              </label>

              <input
                id="fmax"
                type="number"
                min={PRICE_MIN}
                max={PRICE_MAX}
                className="input"
                value={draft.maxPrice}
                onChange={set('maxPrice')}
                placeholder="PKR"
              />
            </div>
          </div>

          {priceError && (
            <p className="text-xs font-semibold text-madder" role="alert">
              {priceError}
            </p>
          )}

          {/* MINIMUM RATING */}
          <div>
            <label className="label mb-2 block" htmlFor="fr">
              Minimum rating
            </label>

            <FilterDropdown
              id="fr"
              value={draft.minRating}
              options={ratingOptions}
              onChange={setDropdown('minRating')}
            />
          </div>

          {/* SORT BY */}
          <div>
            <label className="label mb-2 block" htmlFor="fs">
              Sort by
            </label>

            <FilterDropdown
              id="fs"
              value={draft.sort}
              options={sortOptions}
              onChange={setDropdown('sort')}
            />
          </div>

          {/* VERIFIED */}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.verifiedOnly === 'true'}
              onChange={set('verifiedOnly')}
              className="h-4 w-4 accent-[#2c2f73]"
            />

            Verified providers only
          </label>

          {/* BUTTONS */}
          <div className="flex gap-2">
            <button className="btn-primary flex-1">
              Apply filters
            </button>

            {hasFilters && (
              <button
                type="button"
                onClick={clear}
                className="btn-ghost"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* SEARCH RESULTS */}
        <section aria-live="polite">
          {view === 'map' ? (
            map.loading ? (
              <Spinner />
            ) : map.error ? (
              <ErrorNote error={map.error} retry={map.reload} />
            ) : (
              <>
                <ProviderMap markers={map.data?.markers || []} />
                <p className="mt-2 text-xs text-ink/55">
                  {map.data?.note ||
                    'Locations are approximate (city level) for privacy.'}
                </p>
              </>
            )
          ) : res.loading ? (
            <Spinner label="Searching…" />
          ) : res.error ? (
            <ErrorNote error={res.error} retry={res.reload} />
          ) : data.providers.length === 0 ? (
            <Empty
              title="No providers found"
              action={
                <>
                  <button className="btn-ghost btn-sm" onClick={clear}>
                    Clear filters
                  </button>

                  <Link to="/assistant" className="btn-primary btn-sm">
                    Ask the assistant
                  </Link>
                </>
              }
            >
              Nothing matches all the filters you chose. Remove a filter or
              describe your need to the assistant.
            </Empty>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink/60">
                {data.pagination.total} provider
                {Number(data.pagination.total) === 1 ? '' : 's'} found
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.providers.map((p) => (
                  <ProviderCard key={p.provider_id} p={p} />
                ))}
              </div>

              {data.pagination.pages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3 text-sm">
                  <button
                    className="btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => goPage(page - 1)}
                  >
                    Previous
                  </button>

                  <span>
                    Page {data.pagination.page} of {data.pagination.pages}
                  </span>

                  <button
                    className="btn-ghost btn-sm"
                    disabled={page >= data.pagination.pages}
                    onClick={() => goPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

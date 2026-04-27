/* global React, ReactDOM, TRANSLATIONS */
const { useState, useEffect } = React;

function Stars({ n }) {
  return (
    <span aria-label={`${n} of 5 stars`} style={{ letterSpacing: 2, color: "var(--accent)" }}>
      {"★".repeat(n)}
      <span style={{ color: "var(--line-strong)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

function Wordmark({ small }) {
  return (
    <a href="#top" className="wordmark" aria-label="Physio Allmend">
      <span className="wm-leaf" aria-hidden="true">
        <svg viewBox="0 0 32 32" width={small ? 22 : 28} height={small ? 22 : 28}>
          <circle cx="16" cy="16" r="15" fill="var(--accent)" />
          <path d="M9 19c4 0 7-2 9-6 1 5-2 10-7 11-1 0-2-1-2-2v-3z" fill="var(--paper)" />
        </svg>
      </span>
      <span className="wm-text">
        <span className="wm-1">Physio</span>
        <span className="wm-2">Allmend</span>
      </span>
    </a>
  );
}

function Nav({ t, lang, onLang }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["about", t.nav.about],
    ["services", t.nav.services],
    ["pricing", t.nav.pricing],
    ["reviews", t.nav.reviews],
    ["location", t.nav.location],
    ["contact", t.nav.contact],
  ];

  return (
    <header className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
      <div className="nav__inner">
        <Wordmark small />
        <nav className="nav__links" aria-label="primary">
          {links.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <div className="nav__right">
          <div className="lang-switch" role="group" aria-label="Language">
            <button className={lang === "de" ? "is-on" : ""} onClick={() => onLang("de")} aria-pressed={lang === "de"}>DE</button>
            <span aria-hidden>·</span>
            <button className={lang === "en" ? "is-on" : ""} onClick={() => onLang("en")} aria-pressed={lang === "en"}>EN</button>
          </div>
          <a href="#contact" className="btn btn--solid btn--sm">{t.nav.book}</a>
        </div>
      </div>
    </header>
  );
}

function PlaceholderImage({ label, ratio = "4/3" }) {
  return (
    <div className="ph" style={{ aspectRatio: ratio }}>
      <svg className="ph__pattern" aria-hidden="true">
        <defs>
          <pattern id={`stripes-${label}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#stripes-${label})`} />
      </svg>
      <span className="ph__label">{label}</span>
    </div>
  );
}

function Hero({ t }) {
  return (
    <section id="top" className="hero">
      <div className="hero__grid">
        <div className="hero__copy">
          <div className="eyebrow">{t.hero.eyebrow}</div>
          <h1 className="display">
            {t.hero.title.split("\n").map((l, i) => (
              <span key={i} className="display__line">{l}</span>
            ))}
          </h1>
          <p className="lede">{t.hero.lede}</p>
          <div className="hero__ctas">
            <a href="#contact" className="btn btn--solid">{t.hero.ctaPrimary} <span aria-hidden>→</span></a>
            <a href="#about" className="btn btn--ghost">{t.hero.ctaSecondary}</a>
          </div>
          <ul className="hero__meta">
            <li><span className="dot" /> {t.hero.meta1}</li>
            <li><span className="dot" /> {t.hero.meta2}</li>
            <li><span className="dot" /> {t.hero.meta3}</li>
          </ul>
        </div>
        <div className="hero__image" aria-hidden="true">
          <PlaceholderImage label="practice room · natural light" ratio="4/5" />
          <div className="hero__chip">
            <span className="chip-dot" />
            <span>Birmensdorf ZH</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function About({ t }) {
  return (
    <section id="about" className="section">
      <div className="section__grid section__grid--2 section__grid--gap">
        <div className="section__media">
          <PlaceholderImage label="portrait · Anna Brunner" ratio="3/4" />
        </div>
        <div className="section__copy">
          <div className="eyebrow">{t.about.eyebrow}</div>
          <h2 className="display display--md">
            {t.about.title.split("\n").map((l, i) => (
              <span key={i} className="display__line">{l}</span>
            ))}
          </h2>
          <p className="prose">{t.about.body}</p>
          <p className="prose">{t.about.body2}</p>
          <div className="creds">
            <div className="creds__title">{t.about.credentialsTitle}</div>
            <ul className="creds__list">
              {t.about.credentials.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services({ t }) {
  return (
    <section id="services" className="section section--cream">
      <div className="section__head">
        <div className="eyebrow">{t.services.eyebrow}</div>
        <h2 className="display display--md">
          {t.services.title.split("\n").map((l, i) => (
            <span key={i} className="display__line">{l}</span>
          ))}
        </h2>
      </div>
      <div className="services">
        {t.services.items.map((s, i) => (
          <article className="service" key={i}>
            <div className="service__head">
              <span className="service__tag">{s.tag}</span>
              <h3 className="service__name">{s.name}</h3>
            </div>
            <p className="prose">{s.body}</p>
            <ul className="service__bullets">
              {s.bullets.map((b, j) => (
                <li key={j}><span className="tick" aria-hidden>—</span>{b}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Pricing({ t }) {
  return (
    <section id="pricing" className="section">
      <div className="section__head section__head--split">
        <div>
          <div className="eyebrow">{t.pricing.eyebrow}</div>
          <h2 className="display display--md">{t.pricing.title}</h2>
        </div>
        <p className="prose prose--narrow">{t.pricing.lede}</p>
      </div>
      <div className="pricing">
        {t.pricing.items.map((it, i) => (
          <div className="pricing__row" key={i}>
            <div className="pricing__name">
              <span>{it.name}</span>
              <span className="pricing__duration">{it.duration}</span>
            </div>
            <div className="pricing__dots" aria-hidden />
            <div className="pricing__right">
              <span className="pricing__price">{it.price}</span>
              <span className="pricing__note">{it.note}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="pricing__footnote">{t.pricing.footnote}</p>
    </section>
  );
}

function Reviews({ t }) {
  return (
    <section id="reviews" className="section section--cream">
      <div className="section__head section__head--split">
        <div>
          <div className="eyebrow">{t.reviews.eyebrow}</div>
          <h2 className="display display--md">{t.reviews.title}</h2>
        </div>
        <div className="reviews__summary">
          <div className="reviews__stars"><Stars n={5} /></div>
          <div className="reviews__rating">{t.reviews.rating}</div>
          <div className="reviews__source">{t.reviews.source}</div>
        </div>
      </div>
      <div className="reviews">
        {t.reviews.items.map((r, i) => (
          <article className="review" key={i}>
            <Stars n={r.stars} />
            <p className="review__text">{r.text}</p>
            <footer className="review__foot">
              <span className="review__avatar" aria-hidden>
                {r.name.split(" ").map(p => p[0]).join("")}
              </span>
              <span className="review__name">{r.name}</span>
              <span className="review__when">· {r.when}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function MapIllustration() {
  return (
    <svg viewBox="0 0 600 480" className="map__svg" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="480" fill="var(--cream-2)" />
      <g stroke="var(--line)" strokeWidth="1" fill="none" opacity="0.8">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50 + 80} y2="480" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2="600" y2={i * 50 + 30} />
        ))}
      </g>
      <path d="M-20 360 C 120 320, 220 380, 340 340 S 540 360, 640 320" fill="none" stroke="var(--accent-soft)" strokeWidth="22" strokeLinecap="round" opacity="0.75" />
      <path d="M40 80 L 360 200 L 560 460" fill="none" stroke="var(--paper)" strokeWidth="14" />
      <path d="M40 80 L 360 200 L 560 460" fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="6 6" />
      <path d="M0 240 Q 240 220 380 260 T 600 230" fill="none" stroke="var(--paper)" strokeWidth="9" />
      <g transform="translate(348 196)">
        <circle r="34" fill="var(--accent)" opacity="0.18" />
        <circle r="20" fill="var(--accent)" opacity="0.32" />
        <circle r="8" fill="var(--accent)" stroke="var(--paper)" strokeWidth="3" />
      </g>
      <g transform="translate(380 188)">
        <rect x="0" y="-14" width="148" height="28" rx="14" fill="var(--paper)" stroke="var(--line)" />
        <text x="74" y="5" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="12" fill="var(--ink)" fontWeight="500">Allmendstrasse 12</text>
      </g>
    </svg>
  );
}

function Location({ t }) {
  const mapsUrl = "https://www.google.ch/maps/place/Physio+Allmend+%2FPilates/@47.4738674,8.2950277,773m/data=!3m2!1e3!4b1";
  return (
    <section id="location" className="section">
      <div className="section__grid section__grid--2 section__grid--gap">
        <div className="section__copy">
          <div className="eyebrow">{t.location.eyebrow}</div>
          <h2 className="display display--md">
            {t.location.title.split("\n").map((l, i) => (
              <span key={i} className="display__line">{l}</span>
            ))}
          </h2>
          <address className="address">
            {t.location.address.map((l, i) => <div key={i}>{l}</div>)}
          </address>
          <div className="hours">
            {t.location.hours.map(([d, h], i) => (
              <div className="hours__row" key={i}>
                <span>{d}</span>
                <span className="hours__dots" aria-hidden />
                <span>{h}</span>
              </div>
            ))}
          </div>
          <p className="prose prose--narrow">{t.location.transit}</p>
        </div>
        <a className="map" href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Google Maps">
          <MapIllustration />
          <span className="map__hint">{t.location.mapNote}</span>
        </a>
      </div>
    </section>
  );
}

function Contact({ t }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: t.contact.topics[0], message: "", consent: false });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    setForm(f => ({ ...f, topic: t.contact.topics[0] }));
  }, [t.contact.topics[0]]); // eslint-disable-line

  const set = k => e => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };
  const blur = k => () => setTouched(s => ({ ...s, [k]: true }));

  const validate = f => {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = true;
    if (!f.message.trim() || f.message.trim().length < 10) e.message = true;
    if (!f.consent) e.consent = true;
    return e;
  };

  const onSubmit = e => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setTouched({ name: true, email: true, message: true, consent: true });
    if (Object.keys(errs).length === 0) setSubmitted(true);
  };

  if (submitted) {
    return (
      <section id="contact" className="section">
        <div className="contact-success">
          <div className="contact-success__check" aria-hidden>
            <svg viewBox="0 0 48 48" width="48" height="48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M14 25 l7 7 l13 -15" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="display display--md">{t.contact.success}</h2>
          <p className="prose prose--narrow">{t.contact.successBody}</p>
          <div className="contact-success__direct">
            <span>{t.contact.direct}</span>
            <a href="tel:+41441234567">+41 44 123 45 67</a>
            <span aria-hidden>·</span>
            <a href="mailto:hallo@physio-allmend.ch">hallo@physio-allmend.ch</a>
          </div>
        </div>
      </section>
    );
  }

  const showErr = k => touched[k] && errors[k];

  return (
    <section id="contact" className="section section--cream">
      <div className="section__grid section__grid--2 section__grid--gap section__grid--align-start">
        <div className="section__copy">
          <div className="eyebrow">{t.contact.eyebrow}</div>
          <h2 className="display display--md">{t.contact.title}</h2>
          <p className="prose">{t.contact.lede}</p>
          <div className="direct">
            <div className="direct__row">
              <span className="direct__lbl">Tel</span>
              <a href="tel:+41441234567">+41 44 123 45 67</a>
            </div>
            <div className="direct__row">
              <span className="direct__lbl">Mail</span>
              <a href="mailto:hallo@physio-allmend.ch">hallo@physio-allmend.ch</a>
            </div>
          </div>
        </div>

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="form__row form__row--2">
            <label className={`field ${showErr("name") ? "field--error" : ""}`}>
              <span className="field__lbl">{t.contact.labels.name}</span>
              <input type="text" value={form.name} onChange={set("name")} onBlur={blur("name")} placeholder={t.contact.placeholders.name} required />
            </label>
            <label className={`field ${showErr("email") ? "field--error" : ""}`}>
              <span className="field__lbl">{t.contact.labels.email}</span>
              <input type="email" value={form.email} onChange={set("email")} onBlur={blur("email")} placeholder={t.contact.placeholders.email} required />
            </label>
          </div>
          <div className="form__row form__row--2">
            <label className="field">
              <span className="field__lbl">{t.contact.labels.phone}</span>
              <input type="tel" value={form.phone} onChange={set("phone")} placeholder={t.contact.placeholders.phone} />
            </label>
            <label className="field">
              <span className="field__lbl">{t.contact.labels.topic}</span>
              <select value={form.topic} onChange={set("topic")}>
                {t.contact.topics.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            </label>
          </div>
          <label className={`field ${showErr("message") ? "field--error" : ""}`}>
            <span className="field__lbl">{t.contact.labels.message}</span>
            <textarea rows="5" value={form.message} onChange={set("message")} onBlur={blur("message")} placeholder={t.contact.placeholders.message} required />
          </label>
          <label className={`consent ${showErr("consent") ? "consent--error" : ""}`}>
            <input type="checkbox" checked={form.consent} onChange={set("consent")} />
            <span>{t.contact.labels.consent}</span>
          </label>
          <button type="submit" className="btn btn--solid btn--lg">
            {t.contact.labels.submit} <span aria-hidden>→</span>
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer({ t }) {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <Wordmark />
          <p className="footer__tagline">{t.footer.tagline}</p>
        </div>
        <div className="footer__cols">
          <div>
            <div className="footer__h">{t.footer.colNav}</div>
            <ul>
              <li><a href="#about">{t.nav.about}</a></li>
              <li><a href="#services">{t.nav.services}</a></li>
              <li><a href="#pricing">{t.nav.pricing}</a></li>
              <li><a href="#reviews">{t.nav.reviews}</a></li>
            </ul>
          </div>
          <div>
            <div className="footer__h">{t.footer.colContact}</div>
            <ul>
              <li>Allmendstrasse 12</li>
              <li>8903 Birmensdorf ZH</li>
              <li><a href="tel:+41441234567">+41 44 123 45 67</a></li>
              <li><a href="mailto:hallo@physio-allmend.ch">hallo@physio-allmend.ch</a></li>
            </ul>
          </div>
          <div>
            <div className="footer__h">{t.footer.colLegal}</div>
            <ul>
              {t.footer.legal.map((l, i) => <li key={i}><a href="#">{l}</a></li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="footer__bot">
        <span>{t.footer.copyright}</span>
        <span>Made with care.</span>
      </div>
    </footer>
  );
}

function App() {
  const [lang, setLang] = useState("de");
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const onClick = e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <Nav t={t} lang={lang} onLang={setLang} />
      <main>
        <Hero t={t} />
        <About t={t} />
        <Services t={t} />
        <Pricing t={t} />
        <Reviews t={t} />
        <Location t={t} />
        <Contact t={t} />
      </main>
      <Footer t={t} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

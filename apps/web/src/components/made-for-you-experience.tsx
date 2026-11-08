'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { EnquiryForm } from '@/components/request-forms';
import { WhatsAppLink } from '@/components/ui';
import { showroomDetails } from '@/lib/showroom-details';

interface MadeForYouProps {
  whatsappNumber?: string | null;
}

export function MadeForYouExperience({ whatsappNumber }: MadeForYouProps) {
  const [selectedType, setSelectedType] = useState<string>('');

  function handleSelectType(type: string) {
    setSelectedType(type);
    const formEl = document.getElementById('enquiry-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleScrollToForm(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const formEl = document.getElementById('enquiry-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="bespoke-page-container">
      {/* 1. HERO SECTION */}
      <section className="bespoke-hero" aria-labelledby="bespoke-hero-title">
        <div className="bespoke-hero-content">
          <p className="eyebrow">MADE FOR YOU</p>
          <h1 id="bespoke-hero-title" className="bespoke-hero-title">
            Jewellery that begins with your imagination.
          </h1>
          <p className="bespoke-hero-copy">
            Some pieces are chosen. Others are imagined. Share your idea with us, and let's create something that feels entirely yours.
          </p>
          <div className="bespoke-hero-actions">
            <a href="#enquiry-form" onClick={handleScrollToForm} className="button button-bespoke-primary">
              Start your creation
            </a>
            <Link href="/appointments" className="button button-bespoke-secondary">
              Visit our showroom
            </Link>
          </div>
        </div>

        <div className="bespoke-hero-visual" aria-hidden="true">
          <div className="bespoke-arch-frame">
            <div className="bespoke-arch-inner">
              <div className="bespoke-arch-crest">
                <span className="bespoke-monogram">SR</span>
                <Sparkles size={18} className="bespoke-sparkle-icon" />
              </div>
              <span className="bespoke-arch-eyebrow">BESPOKE ATELIER</span>
              <h2 className="bespoke-arch-title">Handcrafted for your story.</h2>
              <p className="bespoke-arch-desc">
                From initial sketch to master goldsmithing, every custom commission is shaped by heritage craftsmanship.
              </p>
              <div className="bespoke-arch-tag">
                <span>SHREE RAM JEWELLERS</span>
                <span className="tag-separator">·</span>
                <span>WADALA, MUMBAI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INSPIRATION SECTION */}
      <section className="bespoke-inspiration" aria-labelledby="inspiration-title">
        <div className="section-heading-centered">
          <p className="eyebrow">YOUR BESPOKE COMMISSIONS</p>
          <h2 id="inspiration-title" className="bespoke-section-title">
            Your idea. Your jewellery.
          </h2>
          <p className="bespoke-section-intro">
            Whether you have a design in mind or just a little inspiration, we'd love to hear about it.
          </p>
        </div>

        <div className="bespoke-inspiration-grid">
          {/* Card 1: Rings */}
          <button
            type="button"
            className={`bespoke-inspiration-card ${selectedType === 'Ring' ? 'is-selected' : ''}`}
            onClick={() => handleSelectType('Ring')}
            aria-label="Select Rings inspiration"
          >
            <div className="bespoke-card-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="30" r="13" />
                <path d="M19 17L24 10L29 17" />
                <path d="M18 17H30" />
                <path d="M24 10V17" />
                <circle cx="24" cy="8" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3 className="bespoke-card-title">Rings</h3>
            <p className="bespoke-card-desc">
              Engagement solitaires, heirloom cocktail rings and bespoke everyday gold bands.
            </p>
            <span className="bespoke-card-action">
              Design a ring <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>

          {/* Card 2: Necklaces */}
          <button
            type="button"
            className={`bespoke-inspiration-card ${selectedType === 'Necklace' ? 'is-selected' : ''}`}
            onClick={() => handleSelectType('Necklace')}
            aria-label="Select Necklaces inspiration"
          >
            <div className="bespoke-card-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 16C10 26 16 34 24 34C32 34 38 26 38 16" />
                <path d="M14 18C14 24 18 30 24 30C30 30 34 24 34 18" strokeDasharray="2 3" />
                <circle cx="24" cy="38" r="2.5" fill="currentColor" stroke="none" />
                <path d="M24 34V36" />
              </svg>
            </div>
            <h3 className="bespoke-card-title">Necklaces</h3>
            <p className="bespoke-card-desc">
              Heritage kundan chokers, temple haar and contemporary handcrafted pendants.
            </p>
            <span className="bespoke-card-action">
              Design a necklace <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>

          {/* Card 3: Bracelets */}
          <button
            type="button"
            className={`bespoke-inspiration-card ${selectedType === 'Bracelet' ? 'is-selected' : ''}`}
            onClick={() => handleSelectType('Bracelet')}
            aria-label="Select Bracelets inspiration"
          >
            <div className="bespoke-card-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="24" cy="24" rx="17" ry="13" />
                <path d="M7 24C7 26 10 28 14 29" />
                <path d="M41 24C41 22 38 20 34 19" />
                <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="32" cy="30" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3 className="bespoke-card-title">Bracelets</h3>
            <p className="bespoke-card-desc">
              Artisanal polki kadas, solid 22K gold bangles and delicate articulated cuffs.
            </p>
            <span className="bespoke-card-action">
              Design a bracelet <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>

          {/* Card 4: Earrings */}
          <button
            type="button"
            className={`bespoke-inspiration-card ${selectedType === 'Earrings' ? 'is-selected' : ''}`}
            onClick={() => handleSelectType('Earrings')}
            aria-label="Select Earrings inspiration"
          >
            <div className="bespoke-card-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="12" r="3" fill="currentColor" stroke="none" />
                <path d="M24 15V20" />
                <path d="M15 28C15 22 33 22 33 28C33 34 15 34 15 28Z" />
                <path d="M19 33V37" />
                <path d="M24 34V39" />
                <path d="M29 33V37" />
              </svg>
            </div>
            <h3 className="bespoke-card-title">Earrings</h3>
            <p className="bespoke-card-desc">
              Floral chandbalis, temple jhumkas and timeless solitaire diamond ear studs.
            </p>
            <span className="bespoke-card-action">
              Design earrings <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="bespoke-process" aria-labelledby="process-title">
        <div className="section-heading-centered">
          <p className="eyebrow">THE CRAFTING PROCESS</p>
          <h2 id="process-title" className="bespoke-section-title">
            From your imagination to something personal.
          </h2>
        </div>

        <div className="bespoke-steps-grid">
          <div className="bespoke-step-card">
            <span className="bespoke-step-num">01 — Share your idea</span>
            <h3 className="bespoke-step-title">Share your idea</h3>
            <p className="bespoke-step-desc">
              Tell us what you have in mind, whether it's a design, a reference or a special occasion.
            </p>
          </div>

          <div className="bespoke-step-card">
            <span className="bespoke-step-num">02 — Let's discuss</span>
            <h3 className="bespoke-step-title">Let's discuss</h3>
            <p className="bespoke-step-desc">
              Our showroom team will connect with you to understand your preferences and requirements.
            </p>
          </div>

          <div className="bespoke-step-card">
            <span className="bespoke-step-num">03 — Explore the possibilities</span>
            <h3 className="bespoke-step-title">Explore the possibilities</h3>
            <p className="bespoke-step-desc">
              Discuss design options, materials, feasibility and a quotation with our team.
            </p>
          </div>
        </div>
      </section>

      {/* 4. CUSTOM JEWELLERY ENQUIRY FORM */}
      <section id="enquiry-form" className="bespoke-form-section" aria-labelledby="form-heading">
        <div className="bespoke-form-wrap">
          <div className="bespoke-form-header">
            <p className="eyebrow">START YOUR CREATION</p>
            <h2 id="form-heading" className="bespoke-form-title">
              Let's create something special.
            </h2>
            <p className="bespoke-form-subtitle">
              Tell us a little about your idea. Our team will get in touch to discuss the possibilities.
            </p>
            <p className="sr-only">Tell us your idea</p>
          </div>

          <div className="bespoke-form-box">
            <EnquiryForm
              kind="custom"
              whatsappEnabled={!!whatsappNumber}
              selectedJewelleryType={selectedType}
              onTypeSelected={setSelectedType}
              submitLabel="SEND MY ENQUIRY →"
            />

            {whatsappNumber && (
              <div className="bespoke-whatsapp-strip">
                <span className="whatsapp-strip-label">Prefer immediate assistance?</span>
                <WhatsAppLink
                  number={whatsappNumber}
                  message="Hello Shree Ram Jewellers, I would like to discuss a custom jewellery design."
                  label="Chat with our showroom on WhatsApp"
                  className="button button-outline whatsapp-strip-btn"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. SHOWROOM CTA */}
      <section className="bespoke-showroom-cta" id="showroom-cta" aria-labelledby="showroom-cta-title">
        <div className="bespoke-showroom-cta-inner">
          <p className="eyebrow cta-eyebrow">IN-PERSON CONSULTATION</p>
          <h2 id="showroom-cta-title" className="bespoke-showroom-cta-title">
            Some ideas are best discussed in person.
          </h2>
          <p className="bespoke-showroom-cta-text">
            Visit our Wadala showroom and talk to us about the jewellery you've imagined.
          </p>
          <div className="bespoke-showroom-cta-actions">
            <Link href="/appointments" className="button button-showroom-cta">
              VISIT THE SHOWROOM →
            </Link>
          </div>
          <div className="bespoke-showroom-address-card">
            <p className="bespoke-showroom-address-name">
              <MapPin size={15} className="location-pin" aria-hidden="true" />
              Shree Ram Jewellers — Wadala Atelier
            </p>
            <address className="bespoke-showroom-address-text">{showroomDetails.address}</address>
            <p className="bespoke-showroom-hint">Please confirm visiting hours with the showroom before travelling.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

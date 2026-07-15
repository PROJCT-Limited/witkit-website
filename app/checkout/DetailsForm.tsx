// FILE: app/checkout/DetailsForm.tsx
// -----------------------------------------------------------------------------
// Step 1 of guest checkout: customer + shipping + consent. Posts to
// POST /api/preorders, then hands the returned Stripe clientSecret to the
// payment step via sessionStorage (never the URL) and navigates there.
// -----------------------------------------------------------------------------
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DetailsForm({ configurationId }: { configurationId: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (!termsAgreed) {
      setErrors(["You must agree to the payment terms to continue."]);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/preorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configurationId,
          customer: { email, name, phone: phone || undefined },
          shipping: {
            line1,
            line2: line2 || undefined,
            city,
            region: region || undefined,
            postalCode,
            country,
          },
          termsAgreed,
          marketingConsent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong. Please try again."]);
        setSubmitting(false);
        return;
      }

      // Handoff to the payment step: keep the client secret out of the URL/history.
      sessionStorage.setItem(`witkit:checkout:${data.preorderId}`, data.clientSecret);
      router.push(`/checkout/${data.preorderId}`);
    } catch {
      setErrors(["Network error. Please try again."]);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <ul style={{ color: "crimson" }}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <label>
        Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Full name
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Phone (optional)
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <fieldset>
        <legend>Shipping address</legend>
        <label>
          Address line 1
          <input type="text" required value={line1} onChange={(e) => setLine1(e.target.value)} />
        </label>
        <label>
          Address line 2 (optional)
          <input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} />
        </label>
        <label>
          City
          <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          State / region (optional)
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>
        <label>
          Postal code
          <input
            type="text"
            required
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </label>
        <label>
          Country
          <input
            type="text"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="US"
          />
        </label>
      </fieldset>

      <label>
        <input
          type="checkbox"
          required
          checked={termsAgreed}
          onChange={(e) => setTermsAgreed(e.target.checked)}
        />
        I agree to pay 20% now and the remaining 80% automatically when production starts,
        unless I cancel before then for a full refund of my deposit.
      </label>

      <label>
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
        />
        Join wit kit — send me occasional updates on what we're building.
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? "Please wait…" : "Continue to payment"}
      </button>
    </form>
  );
}

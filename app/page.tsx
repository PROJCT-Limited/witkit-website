import { HeroSection } from "./HeroSection";
import { Button } from "@/components/Button";
import { getHomePageContent, getFaqItems } from "@/lib/sanity/content";
import styles from "./page.module.css";

// Shown whenever Sanity isn't configured, or has no homePage document yet —
// see lib/sanity/content.ts. Keeps the page fully functional with zero CMS setup.
const FALLBACK_SECTIONS = [
  {
    title: "What wit kit is",
    body: "wit kit is a small-batch object maker. Every table, stool, and shelf is configured by you — its dimensions, its proportions — and built to order once you commit. Nothing sits in a warehouse; nothing is mass-produced.",
  },
  {
    title: "Made to order",
    body: "Production starts once enough deposits are in, and each piece is built specifically for you from that point. Lead time varies by object and is shown on your order once production begins. We ship worldwide.",
  },
  {
    title: "How payment works",
    body: "Pay a 20% deposit to reserve your configuration. The remaining 80% is charged automatically when production starts. You can cancel any time before then for a full refund of your deposit — after production starts, the piece is being built specifically to your spec and can no longer be cancelled.",
  },
];

export default async function Home() {
  const [homeContent, faqItems] = await Promise.all([getHomePageContent(), getFaqItems()]);

  const sections = homeContent?.storySections?.length ? homeContent.storySections : FALLBACK_SECTIONS;

  return (
    <main>
      <HeroSection labels={homeContent?.fragmentLabels ?? undefined} />

      <div className={styles.content}>
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <p className={styles.sectionBody}>{section.body}</p>
          </section>
        ))}

        {homeContent?.leadTimeNote && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Lead time</h2>
            <p className={styles.sectionBody}>{homeContent.leadTimeNote}</p>
          </section>
        )}

        {faqItems && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>FAQ</h2>
            <dl className={styles.faqList}>
              {faqItems.map((item) => (
                <div key={item.question} className={styles.faqItem}>
                  <dt className={styles.faqQuestion}>{item.question}</dt>
                  <dd className={styles.faqAnswer}>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className={styles.ctaRow}>
          <Button variant="primary" href="/configure">
            Start designing
          </Button>
        </div>
      </div>
    </main>
  );
}

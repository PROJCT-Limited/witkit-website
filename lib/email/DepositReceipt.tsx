// FILE: lib/email/DepositReceipt.tsx
// -----------------------------------------------------------------------------
// React Email template for the deposit confirmation / receipt. Rendered to HTML
// by lib/email/send.ts and sent via Resend. No design system dependency — plain,
// readable markup that survives every email client's CSS support (or lack of it).
// -----------------------------------------------------------------------------

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { formatMoney, formatDate } from "./format";

export interface DepositReceiptEmailProps {
  orderRef: string;
  productName: string;
  params: Record<string, number>;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationDeadline: string; // ISO date string
  leadTimeWeeks: number | null;
  orderStatusUrl: string;
  marketingConsent: boolean;
}

const paramLabels: Record<string, string> = {
  width: "Width",
  depth: "Depth",
  height: "Height",
  legWidth: "Leg width",
  topThickness: "Top thickness",
};

export function DepositReceiptEmail({
  orderRef,
  productName,
  params,
  totalCents,
  depositCents,
  balanceCents,
  currency,
  cancellationDeadline,
  leadTimeWeeks,
  orderStatusUrl,
  marketingConsent,
}: DepositReceiptEmailProps) {
  const deadlineLabel = formatDate(cancellationDeadline);

  return (
    <Html>
      <Head />
      <Preview>
        Your {productName} deposit is confirmed — order {orderRef}
      </Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          <Heading style={{ fontSize: "20px" }}>Deposit received — thank you</Heading>
          <Text>
            Order <strong>{orderRef}</strong> for your <strong>{productName}</strong> is
            confirmed. Here's the spec you configured:
          </Text>

          <Section style={{ margin: "16px 0" }}>
            {Object.entries(params).map(([key, value]) => (
              <Text key={key} style={{ margin: "2px 0" }}>
                {paramLabels[key] ?? key}: <strong>{value}</strong>
              </Text>
            ))}
          </Section>

          <Hr />

          <Section style={{ margin: "16px 0" }}>
            <Text style={{ margin: "2px 0" }}>
              Total: <strong>{formatMoney(totalCents, currency)}</strong>
            </Text>
            <Text style={{ margin: "2px 0" }}>
              Deposit paid today: <strong>{formatMoney(depositCents, currency)}</strong>
            </Text>
            <Text style={{ margin: "2px 0" }}>
              Balance due: <strong>{formatMoney(balanceCents, currency)}</strong>
            </Text>
          </Section>

          <Text>
            We'll charge the remaining {formatMoney(balanceCents, currency)} on{" "}
            <strong>{deadlineLabel}</strong>, when production starts. Cancel before then for
            a full refund of your deposit.
          </Text>

          {leadTimeWeeks ? (
            <Text>
              Every {productName} is made to order — plan on about {leadTimeWeeks}{" "}
              week{leadTimeWeeks === 1 ? "" : "s"} from production start to delivery.
            </Text>
          ) : (
            <Text>Every {productName} is made to order once production begins.</Text>
          )}

          <Text>
            Track your order: <Link href={orderStatusUrl}>{orderStatusUrl}</Link>
          </Text>

          {marketingConsent ? (
            <Text>Welcome to wit kit — we'll keep you posted on what we're building next.</Text>
          ) : null}

          <Hr />
          <Text style={{ fontSize: "12px", color: "#888" }}>Payments powered by Stripe.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DepositReceiptEmail;

// FILE: lib/email/BalanceFinalNotice.tsx
// -----------------------------------------------------------------------------
// Sent once, when chargeBalanceForPreorder's automatic retries are exhausted
// (balance_attempts hits BALANCE_RETRY_MAX_ATTEMPTS and it's still declining).
// The order is left `deposit_paid` with balance_abandoned_at set — a human
// decides what happens next; nothing here auto-cancels or auto-refunds.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface BalanceFinalNoticeEmailProps {
  orderRef: string;
  productName: string;
  balanceCents: number;
  currency: string;
}

export function BalanceFinalNoticeEmail({
  orderRef,
  productName,
  balanceCents,
  currency,
}: BalanceFinalNoticeEmailProps) {
  const balanceLabel = formatMoney(balanceCents, currency);

  return (
    <Html>
      <Head />
      <Preview>We still can't charge your card for order {orderRef}</Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>We still couldn't charge your card</Heading>
          <Text>
            Order <strong>{orderRef}</strong> — we've tried several times to charge the
            remaining <strong>{balanceLabel}</strong> for your {productName} and haven't been
            able to get it through.
          </Text>
          <Text>
            We've stopped retrying automatically. Please reply to this email or get in touch so
            we can sort out payment together — your order is on hold until then.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BalanceFinalNoticeEmail;

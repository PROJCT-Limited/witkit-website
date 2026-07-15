// FILE: lib/email/RefundConfirmation.tsx
// -----------------------------------------------------------------------------
// Sent from the `charge.refunded` webhook once Stripe has actually processed
// the refund — distinct from CancellationConfirmation, which acks the request.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface RefundConfirmationEmailProps {
  orderRef: string;
  depositCents: number;
  currency: string;
}

export function RefundConfirmationEmail({
  orderRef,
  depositCents,
  currency,
}: RefundConfirmationEmailProps) {
  const amountLabel = formatMoney(depositCents, currency);

  return (
    <Html>
      <Head />
      <Preview>Your {amountLabel} refund for order {orderRef} is complete</Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>Refund complete</Heading>
          <Text>
            Order <strong>{orderRef}</strong> — your <strong>{amountLabel}</strong> deposit has
            been refunded. It should appear on your statement in a few business days, depending
            on your bank.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default RefundConfirmationEmail;

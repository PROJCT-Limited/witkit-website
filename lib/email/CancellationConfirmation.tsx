// FILE: lib/email/CancellationConfirmation.tsx
// -----------------------------------------------------------------------------
// Sent immediately when the customer cancels (POST /api/preorders/[token]/cancel),
// before Stripe has actually processed the refund — RefundConfirmation follows
// once the `charge.refunded` webhook lands.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface CancellationConfirmationEmailProps {
  orderRef: string;
  productName: string;
  depositCents: number;
  currency: string;
}

export function CancellationConfirmationEmail({
  orderRef,
  productName,
  depositCents,
  currency,
}: CancellationConfirmationEmailProps) {
  const amountLabel = formatMoney(depositCents, currency);

  return (
    <Html>
      <Head />
      <Preview>Order {orderRef} cancelled — refund on its way</Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>Your order is cancelled</Heading>
          <Text>
            Order <strong>{orderRef}</strong> for your {productName} has been cancelled. Your{" "}
            <strong>{amountLabel}</strong> deposit is being refunded — you'll get a separate
            email once it's complete.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CancellationConfirmationEmail;

// FILE: lib/email/BalanceFailed.tsx
// -----------------------------------------------------------------------------
// Sent when the off-session balance charge is declined outright (not SCA).
// The order stays `deposit_paid` and surfaces in admin for manual follow-up —
// no self-service retry link here, unlike the SCA branch.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface BalanceFailedEmailProps {
  orderRef: string;
  productName: string;
  balanceCents: number;
  currency: string;
}

export function BalanceFailedEmail({
  orderRef,
  productName,
  balanceCents,
  currency,
}: BalanceFailedEmailProps) {
  const balanceLabel = formatMoney(balanceCents, currency);

  return (
    <Html>
      <Head />
      <Preview>We couldn't charge your card for order {orderRef}</Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>We couldn't charge your card</Heading>
          <Text>
            Order <strong>{orderRef}</strong> — your card was declined when we tried to charge
            the remaining <strong>{balanceLabel}</strong> for your {productName}.
          </Text>
          <Text>We'll be in touch to sort out payment before production can start.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BalanceFailedEmail;

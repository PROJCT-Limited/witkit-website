// FILE: lib/email/BalanceActionRequired.tsx
// -----------------------------------------------------------------------------
// Sent when the off-session balance charge needs SCA (3D Secure) — the
// customer must authenticate on-session via /order/[token]/complete-payment.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface BalanceActionRequiredEmailProps {
  orderRef: string;
  productName: string;
  balanceCents: number;
  currency: string;
  completePaymentUrl: string;
}

export function BalanceActionRequiredEmail({
  orderRef,
  productName,
  balanceCents,
  currency,
  completePaymentUrl,
}: BalanceActionRequiredEmailProps) {
  const balanceLabel = formatMoney(balanceCents, currency);

  return (
    <Html>
      <Head />
      <Preview>Action needed to complete your {productName} payment</Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>Your bank needs you to verify this payment</Heading>
          <Text>
            Order <strong>{orderRef}</strong> — we tried to charge the remaining{" "}
            <strong>{balanceLabel}</strong>, but your bank requires additional verification
            before it can go through.
          </Text>
          <Text>
            Please complete the payment here: <Link href={completePaymentUrl}>{completePaymentUrl}</Link>
          </Text>
          <Text>Your order won't move into production until this is completed.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BalanceActionRequiredEmail;

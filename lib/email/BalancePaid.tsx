// FILE: lib/email/BalancePaid.tsx
// -----------------------------------------------------------------------------
// Sent when the balance charge succeeds and the order moves to `confirmed`.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { formatMoney } from "./format";

export interface BalancePaidEmailProps {
  orderRef: string;
  productName: string;
  totalCents: number;
  currency: string;
  leadTimeWeeks: number | null;
}

export function BalancePaidEmail({
  orderRef,
  productName,
  totalCents,
  currency,
  leadTimeWeeks,
}: BalancePaidEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {productName} paid in full — order {orderRef} is entering production
      </Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>Paid in full — entering production</Heading>
          <Text>
            Order <strong>{orderRef}</strong> is paid in full ({formatMoney(totalCents, currency)}{" "}
            total). Your {productName} is now entering production.
          </Text>
          {leadTimeWeeks ? (
            <Text>
              Estimated delivery: about {leadTimeWeeks} week{leadTimeWeeks === 1 ? "" : "s"} from
              today.
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export default BalancePaidEmail;

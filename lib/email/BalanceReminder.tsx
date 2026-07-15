// FILE: lib/email/BalanceReminder.tsx
// -----------------------------------------------------------------------------
// Sent once, a few days before cancellation_deadline, to deposit_paid orders.
// -----------------------------------------------------------------------------

import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";
import { formatMoney, formatDate } from "./format";

export interface BalanceReminderEmailProps {
  orderRef: string;
  productName: string;
  balanceCents: number;
  currency: string;
  cancellationDeadline: string;
  orderStatusUrl: string;
}

export function BalanceReminderEmail({
  orderRef,
  productName,
  balanceCents,
  currency,
  cancellationDeadline,
  orderStatusUrl,
}: BalanceReminderEmailProps) {
  const deadlineLabel = formatDate(cancellationDeadline);
  const balanceLabel = formatMoney(balanceCents, currency);

  return (
    <Html>
      <Head />
      <Preview>
        Your {productName} balance charges on {deadlineLabel}
      </Preview>
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6f6f4" }}>
        <Container
          style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "480px", margin: "0 auto" }}
        >
          <Heading style={{ fontSize: 20 }}>Your balance is due soon</Heading>
          <Text>
            Order <strong>{orderRef}</strong> — we'll charge the remaining{" "}
            <strong>{balanceLabel}</strong> on <strong>{deadlineLabel}</strong>, when production
            starts.
          </Text>
          <Text>
            To cancel and get a full refund of your deposit, do so before then from your order
            page: <Link href={orderStatusUrl}>{orderStatusUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BalanceReminderEmail;

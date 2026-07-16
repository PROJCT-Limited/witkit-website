import { ConfiguratorClient } from "./ConfiguratorClient";

export const metadata = {
  title: "Configure — wit kit",
  description: "Design your own table, stool, or shelf and see the price update live.",
};

export default function ConfigurePage() {
  return <ConfiguratorClient initialType="table" />;
}

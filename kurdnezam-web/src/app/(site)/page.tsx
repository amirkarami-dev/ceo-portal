import Hero, { PortalDock } from "@/components/Hero";
import { NewsHub, Ticker, UnitsCompact } from "@/components/home-sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PortalDock />
      <div className="mt-10">
        <Ticker />
      </div>
      <UnitsCompact />
      <NewsHub />

    </>
  );
}

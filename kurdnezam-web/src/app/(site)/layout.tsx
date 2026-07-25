import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <VisitTracker />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}

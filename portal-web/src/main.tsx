import "@fontsource/vazirmatn/400.css"
import "@fontsource/vazirmatn/500.css"
import "@fontsource/vazirmatn/700.css"
import { ArrowUpLeft, BarChart3, Building2, FileText, HeartHandshake, LayoutDashboard, LogIn, MapPinned, ShieldCheck } from "lucide-react"
import { createRoot } from "react-dom/client"
import "./styles.css"

const services = [
  { title: "ارزیابی انرژی ساختمان", description: "سامانه مبحث ۱۹ برای پروژه‌ها و ارزیابی‌های انرژی.", href: "https://mabhas19.myceo.ir", icon: Building2, accent: "teal" },
  { title: "تحلیل و گزارش", description: "گزارش‌ها و داشبوردهای تحلیلی سازمانی.", href: "https://analytic.myceo.ir", icon: BarChart3, accent: "orange" },
  { title: "مدیریت کاربران", description: "مدیریت حساب‌ها، نقش‌ها و دسترسی‌های سامانه‌ها.", href: "https://admin.myceo.ir", icon: ShieldCheck, accent: "blue" },
  { title: "پنل محتوا", description: "مدیریت محتوای سایت و سرویس‌های اطلاع‌رسانی.", href: "https://landing-panel.myceo.ir", icon: LayoutDashboard, accent: "violet" },
  { title: "شهرداری سنندج", description: "خدمات و یکپارچه‌سازی‌های سامانه شهرداری سنندج.", href: "https://mun-sanandaj.myceo.ir", icon: MapPinned, accent: "red" },
  { title: "نظام مهندسی کردستان", description: "پرتال عمومی سازمان نظام مهندسی ساختمان کردستان.", href: "https://kurdnezam.ir", icon: FileText, accent: "gold" },
  { title: "خدمات رفاهی مهندسین", description: "رزرو خدمات و پیگیری استفاده از امکانات رفاهی.", href: "https://refahi.kurdnezam.ir", icon: HeartHandshake, accent: "green" },
  { title: "ورود یکپارچه", description: "ورود امن و متمرکز برای سرویس‌های مای‌سی‌ای‌او.", href: "https://auth.myceo.ir", icon: LogIn, accent: "ink" },
]

function App() {
  return (
    <main>
      <a className="skip-link" href="#services">رفتن به فهرست خدمات</a>
      <header className="masthead">
        <div className="brand" aria-label="مای سی ای او">myceo<span>.ir</span></div>
        <p>درگاه یکپارچه خدمات سازمانی</p>
      </header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">خدمات دیجیتال سازمان</p>
        <h1 id="page-title">یک نقطه شروع برای سرویس‌های شما</h1>
        <p className="lede">سرویس موردنظر خود را انتخاب کنید تا مستقیماً به فضای کاری آن وارد شوید.</p>
      </section>
      <section id="services" className="services" aria-label="فهرست خدمات">
        {services.map(({ title, description, href, icon: Icon, accent }) => (
          <a className={`service-card ${accent}`} href={href} key={href}>
            <span className="icon-shell"><Icon aria-hidden="true" size={25} strokeWidth={1.8} /></span>
            <span className="copy"><strong>{title}</strong><small>{description}</small></span>
            <ArrowUpLeft className="arrow" aria-hidden="true" size={20} />
          </a>
        ))}
      </section>
      <footer>مای‌سی‌ای‌او · سکوی خدمات یکپارچه</footer>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)

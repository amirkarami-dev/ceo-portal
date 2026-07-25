"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  ClipboardPen,
  Megaphone,
  Newspaper,
  UserRound,
  Users,
} from "lucide-react";
import { useContent } from "@/lib/store";
import { Breadcrumb, NewsCard, Reveal, SectionHeading } from "@/components/ui";

export default function UnitPage() {
  const { id } = useParams<{ id: string }>();
  const { content } = useContent();
  const unit = content.units.find((u) => String(u.id) === id);

  if (!unit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">واحد یافت نشد</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-copper px-6 py-3 font-semibold text-white"
        >
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  // Unit news: prefer the real relation. Seeded rows still carry `unitId: null`,
  // so fall back to the old title-keyword match rather than show an empty section.
  const linked = content.news.filter((n) => n.unitId === unit.id);
  const keyword = unit.title.replace("واحد ", "");
  const unitNews = (
    linked.length
      ? linked
      : content.news.filter((n) => n.title.includes(keyword))
  ).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Breadcrumb
        items={[{ title: "واحدهای سازمان", href: "/" }, { title: unit.title }]}
      />

      {/* Unit hero — the site's signature blueprint panel, kept but tightened so the
          page opens straight into content instead of a full screen of banner. */}
      <Reveal>
        <div className="blueprint flex flex-wrap items-center gap-5 rounded-3xl p-6 text-white sm:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10">
            <Building2 className="size-7 text-gold" aria-hidden />
          </span>
          <div className="min-w-60 flex-1">
            <h1 className="font-display text-3xl sm:text-4xl">{unit.title}</h1>
            {unit.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-7 text-mist">
                {unit.description}
              </p>
            ) : null}
          </div>
        </div>
      </Reveal>

      {/* Two-column body: news carries the page, while the unit's people + forms sit in a
          sticky rail. Previously these were three stacked full-width sections, which made
          the page scroll far longer than it had content for. */}
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading
            icon={Megaphone}
            title="آخرین اخبار و اطلاعیه‌ها"
            subtitle={`اخبار مرتبط با ${unit.title}`}
          />
          {unitNews.length ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {unitNews.map((n, i) => (
                <NewsCard key={n.id} item={n} index={i} />
              ))}
            </div>
          ) : (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line bg-white py-14 text-steel">
              <Newspaper className="size-9" aria-hidden />
              <p className="text-sm">
                هیچ خبر یا اطلاعیه‌ای برای این بخش ثبت نشده است.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {unit.headName ? (
            <Reveal>
              <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Users className="size-4 text-copper" aria-hidden />
                  معرفی اعضا و مسئولین
                </h2>
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink text-mist">
                    <UserRound className="size-7" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">
                      {unit.headName}
                    </p>
                    {unit.headRole ? (
                      <p className="mt-1.5 w-fit rounded-full bg-copper-soft px-3 py-1 text-xs text-copper-dark">
                        {unit.headRole}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Reveal>
          ) : null}

          <Reveal>
            <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <ClipboardPen className="size-4 text-copper" aria-hidden />
                فرم‌ها و نظرسنجی‌ها
              </h2>
              <p className="mt-2 text-sm leading-7 text-steel">
                درخواست‌ها، نظرسنجی‌ها و خدمات الکترونیک مرتبط با این واحد.
              </p>
              <Link
                href={`/forms/${content.forms[0]?.id ?? 1}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-copper"
              >
                مشاهده فرم‌های فعال
              </Link>
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

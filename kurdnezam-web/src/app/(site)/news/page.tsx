"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Newspaper } from "lucide-react";
import { useContent } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { NewsCard } from "@/components/ui";

function NewsList() {
  const { content } = useContent();
  const { t } = useI18n();
  const params = useSearchParams();
  const category = params.get("category");
  const q = params.get("q")?.trim() ?? "";

  const items = useMemo(() => {
    let list = [...content.news];
    if (category) list = list.filter((n) => String(n.categoryId) === category);
    if (q) list = list.filter((n) => n.title.includes(q) || n.body.includes(q));
    return list;
  }, [content.news, category, q]);

  const filters = [
    { id: null as string | null, title: t("news.all") },
    ...content.categories.map((c) => ({ id: String(c.id), title: c.title })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* page hero */}
      <div className="blueprint overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10">
          <Newspaper className="size-7 text-gold" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-5xl">{t("news.title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-mist">
          {t("news.subtitle")}
        </p>
      </div>

      {/* filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-steel">{t("news.category")}</span>
        {filters.map((f) => {
          const selected = category === f.id || (!category && f.id === null);
          return (
            <Link
              key={f.title}
              href={f.id ? `/news?category=${f.id}` : "/news"}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-ink bg-ink text-gold"
                  : "border-line bg-white text-steel hover:border-copper/50 hover:text-copper"
              }`}
            >
              {f.title}
            </Link>
          );
        })}
      </div>

      {q && (
        <p className="mt-4 text-sm text-steel">
          نتایج جستجو برای: <span className="font-bold text-ink">«{q}»</span>
        </p>
      )}

      {/* grid */}
      {items.length ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <NewsCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid place-items-center gap-3 rounded-2xl border border-dashed border-line bg-white py-20 text-steel">
          <Newspaper className="size-10" aria-hidden />
          <p>{t("home.noNews")}</p>
          <Link href="/news" className="text-sm font-medium text-copper">
            {t("home.viewAllNews")}
          </Link>
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense>
      <NewsList />
    </Suspense>
  );
}

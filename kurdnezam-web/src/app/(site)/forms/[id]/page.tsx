"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { imageUrl } from "@/lib/api";
import { useContent } from "@/lib/store";
import { Breadcrumb, Reveal } from "@/components/ui";
import { FormRunner } from "@/components/FormRunner";

/**
 * A form on its own page. Everything below the picture is drawn by `FormRunner` from the fields an
 * administrator defined — this page only frames it. The same component renders inside a news
 * article, so the two can never drift apart.
 */
export default function FormPage() {
  const { id } = useParams<{ id: string }>();
  const { content } = useContent();
  const form = content.forms.find((f) => String(f.id) === id);

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">فرم یافت نشد</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-copper px-6 py-3 font-semibold text-white"
        >
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumb items={[{ title: "فرم‌ها و نظرسنجی‌ها" }, { title: form.title }]} />
      <h1 className="font-display text-4xl leading-snug sm:text-5xl">{form.title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-steel">
        {form.deadline ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-copper" aria-hidden />
            مهلت تکمیل: {form.deadline}
          </span>
        ) : null}
        {form.note ? (
          <span className="rounded-full bg-copper-soft px-3 py-1 text-xs text-copper-dark">
            {form.note}
          </span>
        ) : null}
      </div>

      {form.image ? (
        <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-3xl border border-line shadow-card">
          <Image
            src={imageUrl(form.image)}
            alt=""
            fill
            sizes="(max-width: 896px) 100vw, 896px"
            className="object-cover"
          />
        </div>
      ) : null}

      <Reveal>
        <div className="mt-8">
          <FormRunner form={form} headingLevel={2} />
        </div>
      </Reveal>
    </div>
  );
}

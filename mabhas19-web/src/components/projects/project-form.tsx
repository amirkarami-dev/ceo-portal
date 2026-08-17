"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import {
  M19_CITY_CLIMATE,
  M19_CLIMATE_DEFINITIONS,
  getCityAppendix2Class,
  getCityClimate,
} from "@/features/assessment/data/climate"
import { calcBuildingGroup } from "@/features/assessment/data/utils"
import type { CreateProjectInput } from "@/lib/types"
import {
  Button,
  Field,
  Input,
  Select,
  Spinner,
} from "@/components/ui"

export type ProjectFormValues = CreateProjectInput

interface ProjectFormProps {
  initial?: Partial<ProjectFormValues>
  submitting?: boolean
  onSubmit: (input: CreateProjectInput) => void
  onCancel?: () => void
}

// numeric input -> number | undefined
function toNum(v: string): number | undefined {
  if (v.trim() === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * The cities on offer, and the one a new project starts on.
 *
 * Kurdistan only for now — the province this is being used in. **This is a UI gate and nothing
 * else:** `M19_CITY_CLIMATE` still carries all 31 cities and every climate lookup still answers for
 * them, so opening the list back up means listing more names here (or dropping the filter below) and
 * nothing more. No data was removed to make this happen.
 */
const ALLOWED_CITIES = ["سنندج"]
const DEFAULT_CITY = "سنندج"

export function ProjectForm({ initial, submitting, onSubmit, onCancel }: ProjectFormProps) {
  const t = useTranslations("projects")
  const tCommon = useTranslations("common")

  const [title, setTitle] = useState(initial?.title ?? "")
  const [client, setClient] = useState(initial?.client ?? "")
  const [address, setAddress] = useState(initial?.address ?? "")
  /**
   * A new project opens on the default city; an existing one keeps exactly what it has, including
   * nothing. Defaulting in edit mode too would let opening a city-less project and pressing save
   * assign it a city nobody chose.
   */
  const initialCity = initial ? (initial.city ?? "") : DEFAULT_CITY
  const [city, setCity] = useState(initialCity)
  const [climateCode, setClimateCode] = useState(
    initial?.climateCode ?? (initialCity ? getCityClimate(initialCity) : "")
  )
  const [totalArea, setTotalArea] = useState(
    initial?.totalArea != null ? String(initial.totalArea) : ""
  )
  const [floorCount, setFloorCount] = useState(
    initial?.floorCount != null ? String(initial.floorCount) : ""
  )
  const [unitCount, setUnitCount] = useState(
    initial?.unitCount != null ? String(initial.unitCount) : ""
  )
  const [usage, setUsage] = useState(initial?.usage ?? "")

  const handleCity = (next: string) => {
    setCity(next)
    setClimateCode(next ? getCityClimate(next) : "")
  }

  /**
   * The allowed cities, plus the project's own city when it is not among them. A project created
   * before this gate — or imported from the other system — must still show its real city: dropping it
   * from the list would leave the select with a value it has no option for, which renders blank and
   * looks like the city was lost.
   */
  const cityOptions = useMemo(() => {
    const allowed = M19_CITY_CLIMATE.filter((c) => ALLOWED_CITIES.includes(c.city))
    if (!initialCity || allowed.some((c) => c.city === initialCity)) return allowed
    const own = M19_CITY_CLIMATE.find((c) => c.city === initialCity)
    return own ? [own, ...allowed] : allowed
  }, [initialCity])

  const group = useMemo(
    () =>
      calcBuildingGroup({
        area: toNum(totalArea) ?? 0,
        floors: toNum(floorCount) ?? 0,
        units: toNum(unitCount) ?? 0,
      }),
    [totalArea, floorCount, unitCount]
  )

  const climateLabel = climateCode
    ? M19_CLIMATE_DEFINITIONS[climateCode] ?? climateCode
    : ""

  // «رده اقلیمی» as published in پیوست ۲ of the 5th edition, shown next to the code the assessment
  // actually uses — the two come from different zoning systems and routinely disagree, so both are
  // named rather than one being silently presented as the other.
  const appendix2Class = city ? getCityAppendix2Class(city) : undefined

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      title: title.trim(),
      client: client.trim() || undefined,
      address: address.trim() || undefined,
      city: city || undefined,
      climateCode: climateCode || undefined,
      totalArea: toNum(totalArea),
      floorCount: toNum(floorCount),
      unitCount: toNum(unitCount),
      usage: usage.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label={t("name")}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label={t("client")}>
          <Input value={client} onChange={(e) => setClient(e.target.value)} />
        </Field>
        <Field label={t("usage")}>
          <Input value={usage} onChange={(e) => setUsage(e.target.value)} />
        </Field>
      </div>

      <Field label={t("address")}>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label={t("city")}>
          <Select value={city} onChange={(e) => handleCity(e.target.value)}>
            {/* The "choose a city" placeholder only where it is a real choice: with one city already
                selected it would exist purely to let someone clear the field. */}
            {cityOptions.length > 1 || !city ? (
              <option value="">{t("selectCity")}</option>
            ) : null}
            {cityOptions.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.province})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("climateCode")}>
          <Input
            value={climateLabel ? `${climateCode} — ${climateLabel}` : ""}
            placeholder={t("noClimate")}
            readOnly
            disabled
          />
          {city ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("climateAppendix2")}:{" "}
              {appendix2Class ? (
                // The class is Latin inside RTL copy; its own dir keeps «5C» from being reordered.
                <span dir="ltr" className="font-semibold">
                  {appendix2Class}
                </span>
              ) : (
                t("climateAppendix2Missing")
              )}
            </p>
          ) : null}
        </Field>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-3">
        <Field label={t("totalArea")}>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            value={totalArea}
            onChange={(e) => setTotalArea(e.target.value)}
          />
        </Field>
        <Field label={t("floorCount")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={floorCount}
            onChange={(e) => setFloorCount(e.target.value)}
          />
        </Field>
        <Field label={t("unitCount")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={unitCount}
            onChange={(e) => setUnitCount(e.target.value)}
          />
        </Field>
      </div>

      {/* Live building group */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3 text-sm">
        <span className="text-slate-600">{t("buildingGroup")}</span>
        <span className="font-bold text-brand-800">{group.label}</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {tCommon("cancel")}
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting || !title.trim()}>
          {submitting ? <Spinner /> : null}
          {tCommon("save")}
        </Button>
      </div>
    </form>
  )
}

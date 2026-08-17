import { describe, it, expect } from "vitest"
import {
  M19_APPENDIX2_ALIASES,
  M19_APPENDIX2_CLASS,
  M19_APPENDIX2_ROWS,
  M19_CITY_CLIMATE,
  OPAQUE_BASE_R_BY_CLIMATE,
  getCityAppendix2Class,
  getOpaqueTargetR,
} from "../src/index"

describe("پیوست ۲ — the published city→climate-class table", () => {
  it("carries all 76 rows, with no city listed twice", () => {
    expect(M19_APPENDIX2_ROWS).toHaveLength(76)
    expect(Object.keys(M19_APPENDIX2_CLASS)).toHaveLength(76)
  })

  it("reads back spot values transcribed from the document", () => {
    expect(getCityAppendix2Class("اردبیل")).toBe("5C") // row 5, the only 5C in the table
    expect(getCityAppendix2Class("اهواز")).toBe("0B") // row 12
    expect(getCityAppendix2Class("گچساران")).toBe("2A") // row 65, the only 2A
    expect(getCityAppendix2Class("یزد")).toBe("2B") // row 76, the last row
  })

  it("resolves a city the document names by its station", () => {
    // The appendix says «بندر بوشهر» and «تهران (مهرآباد)»; the form offers «بوشهر» and «تهران».
    expect(getCityAppendix2Class("بوشهر")).toBe("1B")
    expect(getCityAppendix2Class("تهران")).toBe("3B")
    for (const target of Object.values(M19_APPENDIX2_ALIASES)) {
      expect(M19_APPENDIX2_CLASS[target]).toBeDefined()
    }
  })

  it("returns undefined for a city the document does not list", () => {
    // زاهدان is genuinely absent — row 40 is زهبندان. The UI has to say "not listed" rather than
    // borrow a neighbour's class, so this must stay undefined and never fall back.
    expect(getCityAppendix2Class("زاهدان")).toBeUndefined()
    expect(getCityAppendix2Class("قلعه‌ای که وجود ندارد")).toBeUndefined()
  })

  it("covers every city the project form offers, except زاهدان", () => {
    const missing = M19_CITY_CLIMATE.filter((c) => !getCityAppendix2Class(c.city)).map((c) => c.city)
    expect(missing).toEqual(["زاهدان"])
  })

  /**
   * The guard that matters. These two tables are different classification systems, and the R-value
   * lookup is keyed to the older one. If anyone ever wires the appendix class into the scoring, this
   * fails instead of quietly grading buildings against the wrong requirement.
   */
  it("uses classes the scoring tables do not know, so they can never be fed to it", () => {
    const foreign = ["0B", "1B", "2A", "2B", "4A", "4B", "5B", "5C"]
    for (const cls of foreign) {
      expect(OPAQUE_BASE_R_BY_CLIMATE[cls]).toBeUndefined()
      // …and what that costs if it happens: the silent 3B fallback, not an error.
      expect(getOpaqueTargetR("wall_ext_open", cls)).toBe(getOpaqueTargetR("wall_ext_open", "3B"))
    }
  })

  it("disagrees with the older zoning for 25 of the 31 cities on offer", () => {
    const differing = M19_CITY_CLIMATE.filter((c) => {
      const published = getCityAppendix2Class(c.city)
      return published !== undefined && published !== c.climateCode
    })
    expect(differing).toHaveLength(25)
    // تبریز is the plainest example: «خیلی سرد» in the app, mixed-dry in the appendix.
    expect(getCityAppendix2Class("تبریز")).toBe("4B")
  })

  /**
   * Five strings coincide — and that is a collision of notation, not agreement. `3B` means
   * «چهارفصل و کم باران» in the older scheme and warm-dry in ASHRAE 169. Pinned as a list so a
   * future edit to either table shows up here as a named city rather than a shifted count.
   */
  it("coincides on five cities, which is not the same as agreeing", () => {
    const same = M19_CITY_CLIMATE.filter((c) => getCityAppendix2Class(c.city) === c.climateCode).map(
      (c) => c.city
    )
    expect(same).toEqual(["کرج", "تهران", "شیراز", "رشت", "ساری"])
  })
})

import { it } from "vitest"
import {
  gregorianToJdn,
  jalaliToJdn,
  jdnToGregorian,
  jdnToJalali,
  toJalali,
  complianceBandOf,
} from "../src/index"

it("debug", () => {
  for (const [jy, jm, jd] of [
    [1404, 10, 19],
    [1405, 10, 19],
    [1405, 1, 1],
    [1403, 12, 30],
    [1399, 6, 31],
  ]) {
    const jdn = jalaliToJdn({ jy, jm, jd })
    console.log(
      `J ${jy}/${jm}/${jd} -> jdn ${jdn} -> G ${JSON.stringify(jdnToGregorian(jdn))} -> back ${JSON.stringify(jdnToJalali(jdn))}`
    )
  }
  for (const [gy, gm, gd] of [
    [2026, 1, 7],
    [2027, 1, 7],
    [2027, 1, 8],
  ]) {
    const jdn = gregorianToJdn({ gy, gm, gd })
    const d = new Date(Date.UTC(gy, gm - 1, gd, 8, 30))
    console.log(
      `G ${gy}-${gm}-${gd} -> jdn ${jdn} -> J ${JSON.stringify(jdnToJalali(jdn))} | toJalali ${JSON.stringify(toJalali(d))} | band ${complianceBandOf(d)}`
    )
  }
})

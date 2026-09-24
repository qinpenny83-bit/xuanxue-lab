// ============================================================
// 历法模块：儒略日换算 + 太阳视黄经 + 二十四节气（十二「节」）
// 确定性与可解释性优先。精度说明见 README。
// ============================================================

const DEG2RAD = Math.PI / 180

export function norm360(x) {
  return ((x % 360) + 360) % 360
}

/**
 * 太阳视黄经（低精度天文算法，用于节气推算）。
 * T = 自 J2000.0(2451545.0) 起的儒略世纪数（TT）。
 * 含一阶光行差近似（-0.00569°），返回值单位为度。
 */
export function sunApparentLongitude(T) {
  const L = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T
  const mr = M * DEG2RAD
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * mr) +
    0.000289 * Math.sin(3 * mr)
  return norm360(L + C - 0.00569)
}

// 公历 → 儒略日序数（JDN，整数）
export function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  )
}

// 公历 UTC 时刻 → 儒略日（浮点）
export function utcToJD(y, mo, d, h = 0, mi = 0, s = 0) {
  let yy = y
  let mm = mo
  if (mm <= 2) {
    yy -= 1
    mm += 12
  }
  const A = Math.floor(yy / 100)
  const B = 2 - A + Math.floor(A / 4)
  return (
    Math.floor(365.25 * (yy + 4716)) +
    Math.floor(30.6001 * (mm + 1)) +
    d +
    B -
    1524.5 +
    h / 24 +
    mi / 1440 +
    s / 86400
  )
}

// 儒略日（浮点）→ 公历 UTC 时刻
export function jdToUTC(jd) {
  const z = Math.floor(jd + 0.5)
  const f = jd + 0.5 - z
  let a
  if (z < 2299161) {
    a = z
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25)
    a = z + 1 + alpha - Math.floor(alpha / 4)
  }
  const b = a + 1524
  const c = Math.floor((b - 122.1) / 365.25)
  const d = Math.floor(365.25 * c)
  const e = Math.floor((b - d) / 30.6001)
  const day = b - d - Math.floor(30.6001 * e)
  const month = e < 14 ? e - 1 : e - 13
  const year = month > 2 ? c - 4716 : c - 4715

  let t = f * 24
  const hour = Math.floor(t)
  t = (t - hour) * 60
  const minute = Math.floor(t)
  t = (t - minute) * 60
  const second = Math.round(t)
  return { year, month, day, hour, minute, second }
}

/**
 * 求太阳视黄经到达 targetAngle（度）的精确儒略日（TT≈UTC）。
 * 通过牛顿迭代求解，收敛阈值 < 1e-7 度（约 1 秒）。
 */
export function solarTermJD(year, targetAngle) {
  const jd0 = utcToJD(year, 1, 1, 0, 0, 0)
  const T0 = (jd0 - 2451545.0) / 36525
  const meanL0 = norm360(280.46646 + 36000.76983 * T0)
  const f = norm360(targetAngle - meanL0) / 360
  let jd = jd0 + f * 365.2422
  for (let i = 0; i < 60; i++) {
    const T = (jd - 2451545.0) / 36525
    const lambda = sunApparentLongitude(T)
    let delta = targetAngle - lambda
    delta = ((delta + 180) % 360 + 360) % 360 - 180
    jd += delta / 0.98564736
    if (Math.abs(delta) < 1e-7) break
  }
  return jd
}

// 十二「节」（决定月柱边界），按黄经排列，从立春开始一个循环。
export const JIE_TERMS = [
  { name: '立春', angle: 315, branchIndex: 2 },
  { name: '惊蛰', angle: 345, branchIndex: 3 },
  { name: '清明', angle: 15, branchIndex: 4 },
  { name: '立夏', angle: 45, branchIndex: 5 },
  { name: '芒种', angle: 75, branchIndex: 6 },
  { name: '小暑', angle: 105, branchIndex: 7 },
  { name: '立秋', angle: 135, branchIndex: 8 },
  { name: '白露', angle: 165, branchIndex: 9 },
  { name: '寒露', angle: 195, branchIndex: 10 },
  { name: '立冬', angle: 225, branchIndex: 11 },
  { name: '大雪', angle: 255, branchIndex: 0 },
  { name: '小寒', angle: 285, branchIndex: 1 },
]

/**
 * 计算某「八字年」（以立春为界）内十二「节」的儒略日（UTC）。
 * 返回 [{ name, branchIndex, year, jd }]，其中小寒隶属于该年的次年。
 */
export function jieTermsOfYear(year) {
  return JIE_TERMS.map((t, i) => {
    const y = i === 11 ? year + 1 : year
    return { ...t, year: y, jd: solarTermJD(y, t.angle) }
  })
}
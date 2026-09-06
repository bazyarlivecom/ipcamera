/**
 * Persian (Jalali) and precise timestamp utilities
 */

export function toPersianDigits(num: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

// Accurate Gregorian to Jalali converter
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function formatExactTimestamp(dateInput: Date | string | number = new Date()): {
  jalaliDate: string;
  jalaliTime: string;
  exactIso: string;
  exactMs: number;
  fullPersianDateTime: string;
} {
  const d = new Date(dateInput);
  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();

  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const milliseconds = d.getMilliseconds();

  const jalaliDate = `${jy}/${pad(jm)}/${pad(jd)}`;
  const jalaliTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad3(milliseconds)}`;

  return {
    jalaliDate: toPersianDigits(jalaliDate),
    jalaliTime: toPersianDigits(jalaliTime),
    exactIso: d.toISOString(),
    exactMs: d.getTime(),
    fullPersianDateTime: `${toPersianDigits(jalaliDate)} ساعت ${toPersianDigits(
      `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    )}`,
  };
}

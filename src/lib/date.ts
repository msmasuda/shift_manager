// ponytail: 営業拠点は日本のみの前提で JST 固定。多拠点化したら Organization にタイムゾーンを持たせる
export function todayJST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

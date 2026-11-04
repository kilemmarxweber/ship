export type CountryDial = {
  iso: string;
  name: string;
  flag: string;
  dial: string;
  min: number;
  max: number;
};

export const countries: CountryDial[] = [
  { iso: "CD", name: "RD Congo", flag: "🇨🇩", dial: "243", min: 9, max: 9 },
  { iso: "CG", name: "Congo", flag: "🇨🇬", dial: "242", min: 9, max: 9 },
  { iso: "RW", name: "Rwanda", flag: "🇷🇼", dial: "250", min: 9, max: 9 },
  { iso: "BI", name: "Burundi", flag: "🇧🇮", dial: "257", min: 8, max: 8 },
  { iso: "UG", name: "Ouganda", flag: "🇺🇬", dial: "256", min: 9, max: 9 },
  { iso: "KE", name: "Kenya", flag: "🇰🇪", dial: "254", min: 9, max: 9 },
  { iso: "TZ", name: "Tanzanie", flag: "🇹🇿", dial: "255", min: 9, max: 9 },
  { iso: "AO", name: "Angola", flag: "🇦🇴", dial: "244", min: 9, max: 9 },
  { iso: "ZM", name: "Zambie", flag: "🇿🇲", dial: "260", min: 9, max: 9 },
  { iso: "ZW", name: "Zimbabwe", flag: "🇿🇼", dial: "263", min: 9, max: 9 },
  { iso: "CM", name: "Cameroun", flag: "🇨🇲", dial: "237", min: 9, max: 9 },
  { iso: "GA", name: "Gabon", flag: "🇬🇦", dial: "241", min: 7, max: 8 },
  {
    iso: "GQ",
    name: "Guinée équatoriale",
    flag: "🇬🇶",
    dial: "240",
    min: 9,
    max: 9,
  },
  { iso: "CF", name: "Centrafrique", flag: "🇨🇫", dial: "236", min: 8, max: 8 },
  { iso: "TD", name: "Tchad", flag: "🇹🇩", dial: "235", min: 8, max: 8 },
  { iso: "SS", name: "Soudan du Sud", flag: "🇸🇸", dial: "211", min: 9, max: 9 },
  { iso: "NG", name: "Nigeria", flag: "🇳🇬", dial: "234", min: 10, max: 10 },
  { iso: "GH", name: "Ghana", flag: "🇬🇭", dial: "233", min: 9, max: 9 },
  { iso: "SN", name: "Sénégal", flag: "🇸🇳", dial: "221", min: 9, max: 9 },
  {
    iso: "CI",
    name: "Côte d'Ivoire",
    flag: "🇨🇮",
    dial: "225",
    min: 10,
    max: 10,
  },
  { iso: "ML", name: "Mali", flag: "🇲🇱", dial: "223", min: 8, max: 8 },
  { iso: "BF", name: "Burkina Faso", flag: "🇧🇫", dial: "226", min: 8, max: 8 },
  { iso: "NE", name: "Niger", flag: "🇳🇪", dial: "227", min: 8, max: 8 },
  { iso: "BJ", name: "Bénin", flag: "🇧🇯", dial: "229", min: 8, max: 8 },
  { iso: "TG", name: "Togo", flag: "🇹🇬", dial: "228", min: 8, max: 8 },
  { iso: "GN", name: "Guinée", flag: "🇬🇳", dial: "224", min: 9, max: 9 },
  { iso: "MA", name: "Maroc", flag: "🇲🇦", dial: "212", min: 9, max: 9 },
  { iso: "DZ", name: "Algérie", flag: "🇩🇿", dial: "213", min: 9, max: 9 },
  { iso: "TN", name: "Tunisie", flag: "🇹🇳", dial: "216", min: 8, max: 8 },
  { iso: "EG", name: "Égypte", flag: "🇪🇬", dial: "20", min: 10, max: 10 },
  { iso: "ZA", name: "Afrique du Sud", flag: "🇿🇦", dial: "27", min: 9, max: 9 },
  { iso: "FR", name: "France", flag: "🇫🇷", dial: "33", min: 9, max: 9 },
  { iso: "BE", name: "Belgique", flag: "🇧🇪", dial: "32", min: 8, max: 9 },
  { iso: "DE", name: "Allemagne", flag: "🇩🇪", dial: "49", min: 10, max: 11 },
  { iso: "GB", name: "Royaume-Uni", flag: "🇬🇧", dial: "44", min: 10, max: 10 },
  { iso: "US", name: "États-Unis", flag: "🇺🇸", dial: "1", min: 10, max: 10 },
  { iso: "CA", name: "Canada", flag: "🇨🇦", dial: "1", min: 10, max: 10 },
  { iso: "CN", name: "Chine", flag: "🇨🇳", dial: "86", min: 11, max: 11 },
  { iso: "IN", name: "Inde", flag: "🇮🇳", dial: "91", min: 10, max: 10 },
  { iso: "AE", name: "Émirats", flag: "🇦🇪", dial: "971", min: 9, max: 9 },
  { iso: "TR", name: "Turquie", flag: "🇹🇷", dial: "90", min: 10, max: 10 },
  { iso: "BR", name: "Brésil", flag: "🇧🇷", dial: "55", min: 10, max: 11 },
];

export const defaultCountry =
  countries.find((item) => item.iso === "CD") ?? countries[0];

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

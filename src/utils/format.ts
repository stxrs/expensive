export const formatCurrency = (value: number, locale = 'en-IN', currency = 'INR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);

export const formatDate = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().substring(0, 10);
};

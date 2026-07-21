import { NumericFormat } from 'react-number-format'

/* A money field, backed by react-number-format (Sami's rule 7):
   - accepts digits and one dot only; letters/minus/symbols are ignored on entry
   - shows formatted currency ($1,234.56) with live thousands separators
   - clamps to a sane maximum (a $1e9 typo can never enter the system)
   Emits the raw numeric string upward; parents keep using Number(value). */
export default function MoneyInput({ value, onChange, placeholder = '', max = 10000000, ...rest }) {
  return (
    <NumericFormat
      value={value == null ? '' : value}
      placeholder={placeholder}
      thousandSeparator=","
      prefix="$"
      decimalScale={2}
      allowNegative={false}
      inputMode="decimal"
      isAllowed={({ floatValue }) => floatValue == null || floatValue <= max}
      onValueChange={(v) => onChange(v.value)}   // v.value = raw unformatted numeric string
      {...rest}
    />
  )
}

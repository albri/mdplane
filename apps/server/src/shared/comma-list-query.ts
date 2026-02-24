import { z } from 'zod'

function normalizeCsv(input: string): string {
  return input
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .join(',')
}

export function createCommaSeparatedEnumQuerySchema<const T extends readonly string[]>(
  values: T,
  fieldName: string
) {
  const normalizedValues = values.map((value) => value.toLowerCase())
  const allowedSet = new Set(normalizedValues)

  return z.preprocess(
    (value) => (Array.isArray(value) ? value.join(',') : value),
    z
      .string()
      .trim()
      .min(1)
      .transform(normalizeCsv)
      .refine((value) => value.length > 0, {
        message: `${fieldName} must include at least one value`,
      })
      .refine((value) => value.split(',').every((item) => allowedSet.has(item)), {
        message: `${fieldName} must be a comma-separated list of: ${normalizedValues.join(', ')}`,
      })
      .optional()
  )
}

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn's class combiner — merge conditional classes without tailwind conflicts.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

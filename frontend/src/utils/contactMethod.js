import { useEffect, useRef, useState } from 'react'

// Strip everything but digits and standard phone punctuation — the one rule for "contact" as
// a phone number everywhere in the app (matches the backend's phoneOnly() normalization).
export const sanitizePhone = (value) => value.replace(/[^0-9()+\-.\s]/g, '')

// Which contact method (email or phone) is active for a client's phone/email pair. Email is
// primary everywhere in the app; phone is only the active method when the rep explicitly
// switches to it, or when a record loads (or autofills) with a phone number but no email —
// so an existing phone-only quote doesn't open looking contact-less.
export function useContactMethod(email, phone) {
  const [method, setMethod] = useState('email')
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || (!email && !phone)) return
    hydrated.current = true
    if (!email && phone) setMethod('phone')
  }, [email, phone])
  return [method, setMethod]
}

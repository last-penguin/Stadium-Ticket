export const formatPrice = (n: number) => `Rs ${n.toLocaleString('en-PK')}`
export const formatMeters = (n: number) => `${Math.round(n)} m`

/** "Seat 23A" on a plane, "Row 7, Seat 12" elsewhere. */
export const seatName = (seat: { label?: string; rowLabel: string; number: number }) =>
  seat.label ? `Seat ${seat.label}` : `Row ${seat.rowLabel}, Seat ${seat.number}`

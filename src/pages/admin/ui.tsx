// Small form controls shared by the admin editors.

export const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] outline-none transition placeholder:text-white/30 focus:border-mint/60 focus:bg-white/[0.08]'

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted/80">{hint}</span>}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (!Number.isNaN(v)) onChange(max !== undefined ? Math.min(max, min !== undefined ? Math.max(min, v) : v) : v)
      }}
      className={`${inputCls} tabular`}
    />
  )
}

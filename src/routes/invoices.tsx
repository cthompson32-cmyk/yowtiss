import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

export const Route = createFileRoute('/invoices')({
   head: () => ({
     meta: [{ title: 'Invoices' }],
  }),
  component: InvoicesPage,
})

const DEFAULT_COMPANY_NAME = 'Harbor'
const DEFAULT_COMPANY_TAGLINE = 'Shipping invoices, simplified'

const SEA_RATES: Record<number, number> = {
  1:500,2:850,3:1050,4:1250,5:1500,6:1750,7:2000,8:2250,9:2650,10:3050,
  11:3350,12:3650,13:3950,14:4250,15:4550,16:4850,17:5150,18:5450,19:5750,20:5900,
  21:6100,22:6300,23:6500,24:6700,25:6900,26:7100,27:7300,28:7500,29:7700,30:7900,
  31:8100,32:8300,33:8500,34:8700,35:8900,36:9100,37:9300,38:9500,39:9700,40:9900,
  41:10000,42:10150,43:10250,44:10450,45:10600,46:10750,47:10800,48:10950,49:11100,50:11250,
  51:11400,52:11550,53:11700,54:11850,55:12000,56:12150,57:12300,58:12450,59:12600,60:12750,
  61:12900,62:13050,63:13200,64:13350,65:13500,66:13650,67:13800,68:13950,69:14100,70:14250,
  71:14400,72:14550,73:14600,74:14850,75:15000,76:15150,77:15300,78:15450,79:15600,80:15750,
}

const AIR_RATES: Record<number, number> = {
  1:800,2:1150,3:1600,4:2050,5:2450,6:2800,7:3250,8:3650,9:4200,10:4650,
  11:5000,12:5400,13:5950,14:6300,15:6750,16:7100,17:7550,18:7950,19:8500,20:9150,
  21:9250,22:9650,23:10450,24:10850,25:11300,26:11200,27:11750,28:12200,29:12650,30:13100,
  31:13550,32:14000,33:14450,34:14900,35:15350,36:15800,37:16250,38:16700,39:17100,40:17600,
  41:18050,42:18500,43:18950,44:19400,45:20300,46:20750,47:21200,48:22100,49:22500,50:23000,
}

function getRateForLbs(lbs: number, freightType: 'air' | 'sea'): number {
  const table = freightType === 'air' ? AIR_RATES : SEA_RATES
  const rounded = Math.ceil(lbs)
  const clamped = Math.min(Math.max(rounded, 1), freightType === 'air' ? 50 : 80)
  return table[clamped] ?? 0
}

type Package = {
  weight: string
  weight_unit: 'lb' | 'kg'
  rounding: 'up' | 'down'
  description: string
  // Custom price override
  useCustomPrice?: boolean
  customPrice?: string
}

type Invoice = {
  id: string
  customer_id: string
  customer_name: string
  customer_email: string
  weight_kg: number
  amount: number
  status: string
  rate_per_lb: number
  rounding: 'up' | 'down'
  weight_unit: 'lb' | 'kg'
  notes: string
  created_at: string
  freight_type?: 'air' | 'sea'
  packages?: Package[]
  period_start?: string | null
  period_end?: string | null
}

function formatPeriod(start?: string | null, end?: string | null): string {
  if (!start || !end) return ''
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
}

type Customer = {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

const KG_TO_LB = 2.20462

function toLbs(weight: number, unit: 'lb' | 'kg') {
  return unit === 'kg' ? weight * KG_TO_LB : weight
}

function calcPackageAmount(pkg: Package, freightType: 'air' | 'sea'): number {
  // If custom price is set and valid, use it
  if (pkg.useCustomPrice) {
    const custom = parseFloat(pkg.customPrice ?? '')
    if (!isNaN(custom) && custom >= 0) return custom
  }
  const w = parseFloat(pkg.weight) || 0
  const lbs = toLbs(w, pkg.weight_unit)
  const rounded = pkg.rounding === 'up' ? Math.ceil(lbs) : Math.floor(lbs)
  return getRateForLbs(rounded, freightType)
}

function calcTotalAmount(packages: Package[], freightType: 'air' | 'sea'): number {
  return packages.reduce((sum, pkg) => sum + calcPackageAmount(pkg, freightType), 0)
}

const statusColor: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f1f5f9', color: '#64748b' },
  sent: { bg: '#dcfce7', color: '#16a34a' },
  paid: { bg: '#dbeafe', color: '#2563eb' },
}

const STATUS_OPTIONS = ['draft', 'sent', 'paid'] as const

const Sidebar = ({ email, companyName, onSignOut }: {
  email: string
  companyName: string
  onSignOut: () => void
}) => (
  <div style={{ width: 230, background: '#0a1628', display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9396', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2H2v2z" />
          <path d="M2 14h20M6 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8" />
        </svg>
      </div>
      <div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{companyName}</div>
        <div style={{ color: '#64748b', fontSize: 11 }}>{companyName} HQ</div>
      </div>
    </div>
    <nav style={{ flex: 1, padding: '0 12px' }}>
      {[
        { label: 'Dashboard', to: '/dashboard', icon: '⊞' },
        { label: 'Customers', to: '/customers', icon: '👤' },
        { label: 'Invoices', to: '/invoices', icon: '🧾' },
      ].map((item) => (
        <Link key={item.to} to={item.to}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 4 }}
          activeProps={{ style: { background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, fontSize: 14, textDecoration: 'none', marginBottom: 4 } }}
        >
          <span>{item.icon}</span> {item.label}
        </Link>
      ))}
    </nav>
    <div style={{ padding: '0 12px 8px' }}>
      <Link to="/dashboard"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 4 }}
      >
        <span>⚙️</span> Settings
      </Link>
    </div>
    <div style={{ padding: '0 20px', borderTop: '1px solid #1e293b', paddingTop: 14 }}>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12, wordBreak: 'break-all' }}>{email}</div>
      <button onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
        ↪ Sign out
      </button>
    </div>
  </div>
)

function RateSheetModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'air' | 'sea'>('air')
  const airRows = Object.entries(AIR_RATES).map(([lb, rate]) => ({ lb: Number(lb), rate }))
  const seaRows = Object.entries(SEA_RATES).map(([lb, rate]) => ({ lb: Number(lb), rate }))
  const rows = tab === 'air' ? airRows : seaRows

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Rate Sheet</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
            {(['air', 'sea'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 20px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === t ? '#0a1628' : '#f1f5f9',
                color: tab === t ? 'white' : '#64748b',
              }}>
                {t === 'air' ? '✈️ Air Freight' : '🚢 Ocean Freight'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            {tab === 'air' ? 'AIR RATE — as of January 2026' : 'Ocean Rate'}
            {tab === 'air' ? ' · 1–50 lbs' : ' · 1–80 lbs'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a1628', color: 'white' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '6px 0 0 0' }}>Weight (lb)</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Rate (JMD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lb, rate }, i) => (
                <tr key={lb} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '6px 12px', color: '#374151' }}>{lb} lb{lb > 1 ? 's' : ''}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#0a1628' }}>
                    ${rate.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PackageRow({ pkg, index, freightType, onChange, onRemove, canRemove }: {
  pkg: Package
  index: number
  freightType: 'air' | 'sea'
  onChange: (pkg: Package) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const w = parseFloat(pkg.weight) || 0
  const lbsRaw = toLbs(w, pkg.weight_unit)
  const lbsRounded = pkg.rounding === 'up' ? Math.ceil(lbsRaw) : Math.floor(lbsRaw)
  const calculatedAmount = w > 0 ? getRateForLbs(lbsRounded, freightType) : 0
  const displayAmount = calcPackageAmount(pkg, freightType)
  const isCustom = pkg.useCustomPrice ?? false

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box', ...(props.style ?? {}) }} />
  )

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 12, border: `1.5px solid ${isCustom ? '#f59e0b' : '#e2e8f0'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Package {index + 1}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(w > 0 || isCustom) && (
            <span style={{ fontSize: 12, color: isCustom ? '#b45309' : '#0e9396', fontWeight: 600 }}>
              ${displayAmount.toLocaleString()} JMD
              {isCustom && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.75 }}>(custom)</span>}
            </span>
          )}
          {canRemove && (
            <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#e11d48', cursor: 'pointer', fontSize: 16 }}>✕</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Description</label>
          {inp({ placeholder: 'e.g. Box, Bag...', value: pkg.description, onChange: e => onChange({ ...pkg, description: e.target.value }) })}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Weight</label>
          {inp({ type: 'number', placeholder: '0.0', value: pkg.weight, onChange: e => onChange({ ...pkg, weight: e.target.value }) })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Unit</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['lb', 'kg'] as const).map(u => (
              <button key={u} onClick={() => onChange({ ...pkg, weight_unit: u })} style={{
                flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid',
                borderColor: pkg.weight_unit === u ? '#0a1628' : '#e2e8f0',
                background: pkg.weight_unit === u ? '#0a1628' : 'white',
                color: pkg.weight_unit === u ? 'white' : '#64748b',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>{u}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Rounding</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['up', 'down'] as const).map(r => (
              <button key={r} onClick={() => onChange({ ...pkg, rounding: r })} style={{
                flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid',
                borderColor: pkg.rounding === r ? '#0a1628' : '#e2e8f0',
                background: pkg.rounding === r ? '#0a1628' : 'white',
                color: pkg.rounding === r ? 'white' : '#64748b',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>Round {r}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom price toggle + input */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCustom ? 8 : 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: isCustom ? '#b45309' : '#64748b' }}>
            <div
              onClick={() => onChange({ ...pkg, useCustomPrice: !isCustom, customPrice: isCustom ? '' : String(calculatedAmount) })}
              style={{
                width: 34, height: 18, borderRadius: 9, background: isCustom ? '#f59e0b' : '#cbd5e1',
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: isCustom ? 16 : 2, width: 14, height: 14,
                borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            Custom price
          </label>
          {!isCustom && w > 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Calculated: ${calculatedAmount.toLocaleString()} JMD
            </span>
          )}
        </div>

        {isCustom && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#64748b', fontWeight: 600 }}>$</span>
            <input
              type="number"
              placeholder={String(calculatedAmount || 0)}
              value={pkg.customPrice ?? ''}
              onChange={e => onChange({ ...pkg, customPrice: e.target.value })}
              style={{
                width: '100%', padding: '8px 80px 8px 28px', borderRadius: 8,
                border: '1.5px solid #f59e0b', fontSize: 13, boxSizing: 'border-box',
                background: '#fffbeb', outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#b45309', fontWeight: 600 }}>JMD</span>
          </div>
        )}
      </div>
    </div>
  )
}

type FormState = {
  customer_id: string
  freight_type: 'air' | 'sea'
  packages: Package[]
  status: string
  notes: string
  invoice_date: string
  period_start: string
  period_end: string
}

const emptyPackage = (): Package => ({ weight: '', weight_unit: 'lb', rounding: 'up', description: '', useCustomPrice: false, customPrice: '' })

function InvoiceForm({ customers, initial, onSave, onCancel, title }: {
  customers: Customer[]
  initial: FormState
  onSave: (form: FormState) => Promise<void>
  onCancel: () => void
  title: string
}) {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = calcTotalAmount(form.packages, form.freight_type)
  const hasCustomPrice = form.packages.some(p => p.useCustomPrice)

  function setPackage(i: number, pkg: Package) {
    const pkgs = [...form.packages]
    pkgs[i] = pkg
    setForm({ ...form, packages: pkgs })
  }

  function addPackage() {
    setForm({ ...form, packages: [...form.packages, emptyPackage()] })
  }

  function removePackage(i: number) {
    setForm({ ...form, packages: form.packages.filter((_, idx) => idx !== i) })
  }

  async function handleSave() {
    setError('')
    if (!form.customer_id) return setError('Please select a customer.')
    if (!form.invoice_date) return setError('Please select an invoice date.')
    if ((form.period_start && !form.period_end) || (!form.period_start && form.period_end)) {
      return setError('Please set both a start and end date for the billing period, or leave both blank.')
    }
    if (form.period_start && form.period_end && form.period_end < form.period_start) {
      return setError('Period end date must be on or after the period start date.')
    }
    if (form.packages.some(p => !p.weight)) return setError('Please enter weight for all packages.')
    if (form.packages.some(p => p.useCustomPrice && (p.customPrice === '' || isNaN(parseFloat(p.customPrice ?? ''))))) {
      return setError('Please enter a valid custom price for all overridden packages.')
    }
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  const sel = (props: React.SelectHTMLAttributes<HTMLSelectElement>, children: React.ReactNode) => (
    <select {...props} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}>{children}</select>
  )

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
  )

  const f = (label: string, node: React.ReactNode) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {node}
    </div>
  )

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>{title}</h2>

      {f('Customer', sel({ value: form.customer_id, onChange: e => setForm({ ...form, customer_id: e.target.value }) },
        <><option value="">Select a customer...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</>
      ))}

      {f('Invoice date', inp({ type: 'date', value: form.invoice_date, onChange: e => setForm({ ...form, invoice_date: e.target.value }) }))}

      {f('Billing period (optional)',
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={form.period_end} min={form.period_start || undefined} onChange={e => setForm({ ...form, period_end: e.target.value })}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
          {(form.period_start || form.period_end) && (
            <button onClick={() => setForm({ ...form, period_start: '', period_end: '' })} title="Clear period"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
          )}
        </div>
      )}

      {f('Freight type',
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            { val: 'air', label: '✈️ Air Freight', color: '#0369a1' },
            { val: 'sea', label: '🚢 Ocean Freight', color: '#0e9396' },
          ] as const).map(o => (
            <button key={o.val} onClick={() => setForm({ ...form, freight_type: o.val })} style={{
              flex: 1, padding: '12px', borderRadius: 10, border: '2px solid',
              borderColor: form.freight_type === o.val ? o.color : '#e2e8f0',
              background: form.freight_type === o.val ? o.color : 'white',
              color: form.freight_type === o.val ? 'white' : '#64748b',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>{o.label}</button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Packages ({form.packages.length})</label>
          <button onClick={addPackage} style={{ fontSize: 13, color: '#0e9396', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add package</button>
        </div>
        {form.packages.map((pkg, i) => (
          <PackageRow
            key={i}
            pkg={pkg}
            index={i}
            freightType={form.freight_type}
            onChange={p => setPackage(i, p)}
            onRemove={() => removePackage(i)}
            canRemove={form.packages.length > 1}
          />
        ))}
      </div>

      <div style={{ background: hasCustomPrice ? '#fffbeb' : '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: `1.5px solid ${hasCustomPrice ? '#f59e0b' : '#e2e8f0'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {form.freight_type === 'air' ? '✈️ Air' : '🚢 Ocean'} · {form.packages.length} package{form.packages.length > 1 ? 's' : ''}
            {hasCustomPrice && <span style={{ marginLeft: 6, color: '#b45309', fontWeight: 600 }}>· custom pricing</span>}
          </span>
          <span style={{ fontWeight: 700, fontSize: 16, color: hasCustomPrice ? '#b45309' : '#0e9396' }}>${totalAmount.toLocaleString()} JMD</span>
        </div>
      </div>

      {f('Status', sel({ value: form.status, onChange: e => setForm({ ...form, status: e.target.value }) },
        <><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option></>
      ))}

      {f('Notes (optional)', inp({ type: 'text', value: form.notes, placeholder: 'Any notes...', onChange: e => setForm({ ...form, notes: e.target.value }) }))}

      {error && <div style={{ color: '#e11d48', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
        <button onClick={handleSave} disabled={loading} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#0a1628', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          {loading ? 'Saving...' : 'Save invoice'}
        </button>
      </div>
    </div>
  )
}

function generateInvoicePDF(invoice: Invoice, customer: Customer | null, companyName: string, companyTagline: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const packages: Package[] = invoice.packages ?? [{
    weight: String(invoice.weight_kg),
    weight_unit: invoice.weight_unit ?? 'lb',
    rounding: invoice.rounding ?? 'up',
    description: 'Shipment',
  }]
  const freightType = invoice.freight_type ?? 'sea'
  const freightLabel = freightType === 'air' ? 'Air Freight' : 'Ocean Freight'
  const totalAmount = calcTotalAmount(packages, freightType)
  const invoiceNo = invoice.id.slice(0, 8).toUpperCase()
  const dateStr = new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  doc.setFillColor(10, 22, 40)
  doc.rect(0, 0, W, 110, 'F')
  doc.setFillColor(14, 147, 150)
  doc.roundedRect(40, 24, 36, 36, 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('H', 58, 48, { align: 'center' })
  doc.setFontSize(20)
  doc.text(companyName, 86, 44)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 170, 190)
  doc.text(companyTagline, 86, 58)
  doc.setTextColor(150, 170, 190)
  doc.setFontSize(9)
  doc.text('INVOICE', W - 40, 30, { align: 'right' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`#${invoiceNo}`, W - 40, 48, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 170, 190)
  doc.text(dateStr, W - 40, 62, { align: 'right' })
  const badgeColor: [number, number, number] = freightType === 'air' ? [3, 105, 161] : [14, 147, 150]
  doc.setFillColor(...badgeColor)
  doc.roundedRect(W - 120, 70, 80, 18, 9, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(freightLabel, W - 80, 82, { align: 'center' })

  let y = 140
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', 40, y)
  y += 16
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(customer?.name ?? invoice.customer_name, 40, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  if (customer?.email) { doc.text(customer.email, 40, y); y += 13 }
  if (customer?.phone) { doc.text(customer.phone, 40, y); y += 13 }
  if (customer?.address) { doc.text(customer.address, 40, y); y += 13 }
  if (invoice.period_start && invoice.period_end) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(`Billing period: ${formatPeriod(invoice.period_start, invoice.period_end)}`, 40, y)
    y += 13
    doc.setFont('helvetica', 'normal')
  }

  y += 16
  doc.setFillColor(241, 245, 249)
  doc.rect(40, y, W - 80, 24, 'F')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIPTION', 52, y + 16)
  doc.text('WEIGHT', W - 160, y + 16, { align: 'right' })
  doc.text('AMOUNT (JMD)', W - 48, y + 16, { align: 'right' })
  y += 24

  packages.forEach((pkg, i) => {
    const lbs = toLbs(parseFloat(pkg.weight) || 0, pkg.weight_unit)
    const rounded = pkg.rounding === 'up' ? Math.ceil(lbs) : Math.floor(lbs)
    const amount = calcPackageAmount(pkg, freightType)
    const rowBg = i % 2 === 0 ? [248, 250, 252] : [255, 255, 255]
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2])
    doc.rect(40, y, W - 80, 30, 'F')
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const desc = `${pkg.description || `Package ${i + 1}`} — ${pkg.weight} ${pkg.weight_unit} (${rounded} lbs)`
    doc.text(desc, 52, y + 19, { maxWidth: W - 280 })
    doc.setTextColor(100, 116, 139)
    doc.text(`${rounded} lbs`, W - 160, y + 19, { align: 'right' })
    doc.setTextColor(55, 65, 81)
    doc.setFont('helvetica', 'bold')
    doc.text(`$${amount.toLocaleString()}`, W - 48, y + 19, { align: 'right' })
    y += 30
  })

  y += 10
  doc.setDrawColor(10, 22, 40)
  doc.setLineWidth(1.5)
  doc.line(W - 240, y, W - 40, y)
  y += 16
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Total', W - 240, y)
  doc.setTextColor(14, 147, 150)
  doc.setFontSize(16)
  doc.text(`$${totalAmount.toLocaleString()} JMD`, W - 48, y, { align: 'right' })

  y += 30
  const bgMap: Record<string, [number,number,number]> = {
    draft: [241,245,249], sent: [220,252,231], paid: [219,234,254],
  }
  const txMap: Record<string, [number,number,number]> = {
    draft: [100,116,139], sent: [22,163,74], paid: [37,99,235],
  }
  doc.setFillColor(...(bgMap[invoice.status] ?? [241,245,249]))
  doc.roundedRect(40, y - 12, 60, 18, 9, 9, 'F')
  doc.setTextColor(...(txMap[invoice.status] ?? [100,116,139]))
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.status.toUpperCase(), 70, y, { align: 'center' })

  if (invoice.notes) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Note: ${invoice.notes}`, W - 48, y, { align: 'right' })
  }

  y = doc.internal.pageSize.getHeight() - 30
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${companyName} · ${companyTagline}`, W / 2, y, { align: 'center' })

  return doc
}

function SendModal({ invoice, customer, companyName, onClose }: { invoice: Invoice; customer: Customer | null; companyName: string; onClose: () => void }) {
  const packages: Package[] = invoice.packages ?? [{
    weight: String(invoice.weight_kg),
    weight_unit: invoice.weight_unit ?? 'lb',
    rounding: invoice.rounding ?? 'up',
    description: 'Shipment',
  }]

  const pkgLines = packages.map((p, i) => {
    const lbs = toLbs(parseFloat(p.weight) || 0, p.weight_unit)
    const rounded = p.rounding === 'up' ? Math.ceil(lbs) : Math.floor(lbs)
    const amount = calcPackageAmount(p, invoice.freight_type ?? 'sea')
    return `  Package ${i + 1}${p.description ? ` (${p.description})` : ''}: ${rounded} lbs — $${amount.toLocaleString()} JMD`
  }).join('\n')

  const total = calcTotalAmount(packages, invoice.freight_type ?? 'sea')
  const freightLabel = invoice.freight_type === 'air' ? 'Air Freight' : 'Ocean Freight'
  const invoiceNo = invoice.id.slice(0, 8).toUpperCase()
  const companyTagline = localStorage.getItem('companyTagline') ?? DEFAULT_COMPANY_TAGLINE

  const message = encodeURIComponent(
    `Hi ${customer?.name ?? invoice.customer_name},\n\nHere is your ${companyName} shipping invoice:\n\n` +
    `Invoice #: ${invoiceNo}\n` +
    `Freight type: ${freightLabel}\n` +
    (invoice.period_start && invoice.period_end ? `Billing period: ${formatPeriod(invoice.period_start, invoice.period_end)}\n` : '') +
    `Packages:\n${pkgLines}\n` +
    `Total: $${total.toLocaleString()} JMD\n` +
    `Status: ${invoice.status}\n\n` +
    `Thank you for shipping with ${companyName}!`
  )

  const phone = customer?.phone?.replace(/\D/g, '') ?? ''
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`
  const emailUrl = `mailto:${customer?.email ?? invoice.customer_email}?subject=${companyName} Invoice %23${invoiceNo}&body=${message}`

  function handleDownloadPDF() {
    const doc = generateInvoicePDF(invoice, customer, companyName, companyTagline)
    doc.save(`${companyName}-Invoice-${invoiceNo}.pdf`)
  }

  function handleEmailWithPDF() {
    handleDownloadPDF()
    setTimeout(() => { window.location.href = emailUrl }, 500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 440 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Send Invoice</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          Invoice #{invoiceNo} · {customer?.name ?? invoice.customer_name}
        </p>

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: '1.5px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>📄 Step 1 — Download PDF</div>
          <button onClick={handleDownloadPDF} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '12px 20px', borderRadius: 10, border: 'none',
            background: '#0a1628', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>📤 Step 2 — Send</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderRadius: 12,
            background: '#25D366', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 14,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.527 5.845L.057 23.57a.75.75 0 0 0 .93.93l5.725-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.716 9.716 0 0 1-4.951-1.354l-.355-.211-3.656.939.955-3.538-.231-.366A9.718 9.718 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
            </svg>
            WhatsApp (text summary)
          </a>

          <button onClick={handleEmailWithPDF} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderRadius: 12,
            background: '#6366f1', color: 'white', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            Email (downloads PDF + opens mail)
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, textAlign: 'center' }}>
          Tip: download the PDF first, then attach it manually to WhatsApp or email for a polished send.
        </p>

        {!customer?.phone && <p style={{ color: '#f59e0b', fontSize: 12, marginBottom: 12 }}>⚠️ No phone number on file.</p>}
        {!customer?.email && !invoice.customer_email && <p style={{ color: '#f59e0b', fontSize: 12, marginBottom: 12 }}>⚠️ No email on file.</p>}
        <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}>Close</button>
      </div>
    </div>
  )
}

function PrintableInvoice({ invoice, customer, companyName, companyTagline, onClose }: { invoice: Invoice; customer: Customer | null; companyName: string; companyTagline: string; onClose: () => void }) {
  const packages: Package[] = invoice.packages ?? [{
    weight: String(invoice.weight_kg),
    weight_unit: invoice.weight_unit ?? 'lb',
    rounding: invoice.rounding ?? 'up',
    description: 'Shipment',
  }]
  const freightType = invoice.freight_type ?? 'sea'
  const totalAmount = calcTotalAmount(packages, freightType)
  const freightLabel = freightType === 'air' ? '✈️ Air Freight' : '🚢 Ocean Freight'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #0a1628, #0e4f5c)', padding: '32px 40px', borderRadius: '20px 20px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9396', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2H2v2z" />
                    <path d="M2 14h20M6 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8" />
                  </svg>
                </div>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>{companyName}</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{companyTagline}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>INVOICE</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>#{invoice.id.slice(0, 8).toUpperCase()}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div style={{ marginTop: 6, background: freightType === 'air' ? '#0369a1' : '#0e9396', color: 'white', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>{freightLabel}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 40px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 10 }}>BILL TO</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{customer?.name ?? invoice.customer_name}</div>
            {customer?.email && <div style={{ color: '#64748b', fontSize: 14 }}>{customer.email}</div>}
            {customer?.phone && <div style={{ color: '#64748b', fontSize: 14 }}>{customer.phone}</div>}
            {customer?.address && <div style={{ color: '#64748b', fontSize: 14 }}>{customer.address}</div>}
            {invoice.period_start && invoice.period_end && (
              <div style={{ marginTop: 10, display: 'inline-block', background: '#f1f5f9', color: '#374151', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                Billing period: {formatPeriod(invoice.period_start, invoice.period_end)}
              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px 20px', background: '#f1f5f9', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              <span>DESCRIPTION</span><span style={{ textAlign: 'right' }}>WEIGHT</span><span style={{ textAlign: 'right' }}>AMOUNT (JMD)</span>
            </div>
            {packages.map((pkg, i) => {
              const lbs = toLbs(parseFloat(pkg.weight) || 0, pkg.weight_unit)
              const rounded = pkg.rounding === 'up' ? Math.ceil(lbs) : Math.floor(lbs)
              const amount = calcPackageAmount(pkg, freightType)
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '12px 20px', fontSize: 14, borderBottom: i < packages.length - 1 ? '1px solid #f1f5f9' : 'none', background: 'white' }}>
                  <span>{pkg.description || `Package ${i + 1}`} — {pkg.weight} {pkg.weight_unit} ({rounded} lbs)</span>
                  <span style={{ textAlign: 'right', color: '#64748b' }}>{rounded} lbs</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: '#374151' }}>${amount.toLocaleString()}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #0a1628', marginTop: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 20, color: '#0e9396' }}>${totalAmount.toLocaleString()} JMD</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ background: statusColor[invoice.status]?.bg, color: statusColor[invoice.status]?.color, fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 20 }}>{invoice.status.toUpperCase()}</span>
            {invoice.notes && <div style={{ color: '#64748b', fontSize: 13 }}>Note: {invoice.notes}</div>}
          </div>
        </div>

        <div style={{ padding: '0 40px 32px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}>Close</button>
          <button onClick={() => {
            const doc = generateInvoicePDF(invoice, customer, companyName, companyTagline)
            doc.save(`${companyName}-Invoice-${invoice.id.slice(0, 8).toUpperCase()}.pdf`)
          }} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#6366f1', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            ⬇ Download PDF
          </button>
          <button onClick={() => window.print()} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#0a1628', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>🖨️ Print</button>
        </div>
      </div>
    </div>
  )
}

function InvoicesPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null)
  const [showRates, setShowRates] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>([])
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('companyName') ?? DEFAULT_COMPANY_NAME)
  const [companyTagline, setCompanyTagline] = useState(() => localStorage.getItem('companyTagline') ?? DEFAULT_COMPANY_TAGLINE)

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'companyName' && e.newValue) setCompanyName(e.newValue)
      if (e.key === 'companyTagline' && e.newValue) setCompanyTagline(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const emptyForm: FormState = {
    customer_id: '',
    freight_type: 'sea',
    packages: [emptyPackage()],
    status: 'draft',
    notes: '',
    invoice_date: new Date().toLocaleDateString('en-CA'),
    period_start: '',
    period_end: '',
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/' })
      else setEmail(data.user.email ?? '')
    })
    fetchAll()
  }, [])

  async function fetchAll() {
    const [inv, cust] = await Promise.all([
      supabase.from('recent_invoices').select('*'),
      supabase.from('customers').select('*'),
    ])
    if (inv.data) setInvoices(inv.data)
    if (cust.data) setCustomers(cust.data)
  }

  // Combine a YYYY-MM-DD date with the current local time so we don't
  // shift the invoice date when it's converted to a UTC ISO string.
  function dateToTimestamp(dateStr: string, original?: string) {
    const time = original ? new Date(original) : new Date()
    const [y, m, d] = dateStr.split('-').map(Number)
    const combined = new Date(y, m - 1, d, time.getHours(), time.getMinutes(), time.getSeconds())
    return combined.toISOString()
  }

  async function handleCreate(form: FormState) {
    const { data: { user } } = await supabase.auth.getUser()
    const total = calcTotalAmount(form.packages, form.freight_type)
    const firstPkg = form.packages[0]
    await supabase.from('invoices').insert({
      user_id: user!.id,
      customer_id: form.customer_id,
      weight_kg: parseFloat(firstPkg.weight) || 0,
      weight_unit: firstPkg.weight_unit,
      rate_per_lb: 0,
      rounding: firstPkg.rounding,
      amount: total,
      status: form.status,
      notes: form.notes,
      freight_type: form.freight_type,
      packages: form.packages,
      created_at: dateToTimestamp(form.invoice_date),
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    })
    setShowCreate(false)
    fetchAll()
  }

  async function handleEdit(form: FormState) {
    if (!editInvoice) return
    const total = calcTotalAmount(form.packages, form.freight_type)
    const firstPkg = form.packages[0]
    await supabase.from('invoices').update({
      customer_id: form.customer_id,
      weight_kg: parseFloat(firstPkg.weight) || 0,
      weight_unit: firstPkg.weight_unit,
      rate_per_lb: 0,
      rounding: firstPkg.rounding,
      amount: total,
      status: form.status,
      notes: form.notes,
      freight_type: form.freight_type,
      packages: form.packages,
      created_at: dateToTimestamp(form.invoice_date, editInvoice.created_at),
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    }).eq('id', editInvoice.id)
    setEditInvoice(null)
    fetchAll()
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const getCustomer = (id: string) => customers.find(c => c.id === id) ?? null

  const filteredInvoices = invoices
    .filter(inv => !filterDate || new Date(inv.created_at).toLocaleDateString('en-CA') === filterDate)
    .filter(inv => !hiddenStatuses.includes(inv.status))
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? diff : -diff
    })

  function toggleStatus(status: string) {
    setHiddenStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])
  }

  const grouped: Record<string, Invoice[]> = {}
  filteredInvoices.forEach(inv => {
    const day = new Date(inv.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(inv)
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      <Sidebar email={email} companyName={companyName} onSignOut={signOut} />

      <div style={{ flex: 1, padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Invoices</h1>
            <p style={{ color: '#64748b', marginTop: 4, marginBottom: 0 }}>Manage your shipping invoices.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowRates(true)} style={{ background: 'white', color: '#0a1628', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              📋 Rate Sheet
            </button>
            <button onClick={() => setShowCreate(true)} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              + New invoice
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Filter by day:</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, background: 'white' }}
          />
          {filterDate && (
            <button onClick={() => setFilterDate('')} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
              ✕ Clear
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Sort:</label>
            <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {([
                { val: 'desc', label: 'Newest first' },
                { val: 'asc', label: 'Oldest first' },
              ] as const).map(o => (
                <button key={o.val} onClick={() => setSortOrder(o.val)} style={{
                  padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: sortOrder === o.val ? '#0a1628' : 'white',
                  color: sortOrder === o.val ? 'white' : '#64748b',
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setStatusMenuOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: hiddenStatuses.length ? '#fffbeb' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: hiddenStatuses.length ? '#b45309' : '#374151',
            }}>
              Status {hiddenStatuses.length ? `(${STATUS_OPTIONS.length - hiddenStatuses.length}/${STATUS_OPTIONS.length} shown)` : ''} ▾
            </button>
            {statusMenuOpen && (
              <>
                <div onClick={() => setStatusMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'white', border: '1.5px solid #e2e8f0',
                  borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 12, zIndex: 10, minWidth: 180,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: 0.5 }}>SHOW STATUSES</div>
                  {STATUS_OPTIONS.map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
                      <input type="checkbox" checked={!hiddenStatuses.includes(s)} onChange={() => toggleStatus(s)} />
                      {s}
                    </label>
                  ))}
                  {hiddenStatuses.length > 0 && (
                    <button onClick={() => setHiddenStatuses([])} style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Show all
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            {filterDate && ` on ${new Date(filterDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          </span>
        </div>

        {filteredInvoices.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            {filterDate ? 'No invoices on this date.' : 'No invoices yet. Create your first one!'}
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayInvoices]) => (
            <div key={day} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>{day}</div>
              <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {dayInvoices.map((inv, i) => {
                  const freightType = inv.freight_type ?? 'sea'
                  const packages = inv.packages ?? [{ weight: String(inv.weight_kg), weight_unit: inv.weight_unit, rounding: inv.rounding, description: 'Shipment' }]
                  const total = calcTotalAmount(packages, freightType)
                  const hasCustom = packages.some(p => p.useCustomPrice && p.customPrice !== '')
                  return (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < dayInvoices.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{inv.customer_name}</span>
                          <span style={{ fontSize: 11, background: freightType === 'air' ? '#e0f2fe' : '#ccfbf1', color: freightType === 'air' ? '#0369a1' : '#0f766e', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                            {freightType === 'air' ? '✈ Air' : '🚢 Ocean'}
                          </span>
                          {packages.length > 1 && (
                            <span style={{ fontSize: 11, background: '#f3e8ff', color: '#7c3aed', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                              {packages.length} pkgs
                            </span>
                          )}
                          {hasCustom && (
                            <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                              ✏️ custom price
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>
                          {packages.map(p => `${p.weight} ${p.weight_unit}`).join(' + ')} · {new Date(inv.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {inv.period_start && inv.period_end && ` · Period: ${formatPeriod(inv.period_start, inv.period_end)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: statusColor[inv.status]?.bg, color: statusColor[inv.status]?.color, fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>{inv.status}</span>
                        <span style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>${total.toLocaleString()} JMD</span>
                        <button onClick={() => setEditInvoice(inv)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                        <button onClick={() => setSendInvoice(inv)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#25D366', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Send</button>
                        <button onClick={() => setViewInvoice(inv)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#0e9396', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>View</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <InvoiceForm customers={customers} initial={emptyForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} title="New Invoice" />
        </div>
      )}

      {editInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <InvoiceForm
            customers={customers}
            initial={{
              customer_id: editInvoice.customer_id,
              freight_type: editInvoice.freight_type ?? 'sea',
              packages: editInvoice.packages ?? [{
                weight: String(editInvoice.weight_kg),
                weight_unit: editInvoice.weight_unit ?? 'lb',
                rounding: editInvoice.rounding ?? 'up',
                description: '',
              }],
              status: editInvoice.status,
              notes: editInvoice.notes ?? '',
              invoice_date: new Date(editInvoice.created_at).toLocaleDateString('en-CA'),
              period_start: editInvoice.period_start ?? '',
              period_end: editInvoice.period_end ?? '',
            }}
            onSave={handleEdit}
            onCancel={() => setEditInvoice(null)}
            title="Edit Invoice"
          />
        </div>
      )}

      {sendInvoice && <SendModal invoice={sendInvoice} customer={getCustomer(sendInvoice.customer_id)} companyName={companyName} onClose={() => setSendInvoice(null)} />}
      {viewInvoice && <PrintableInvoice invoice={viewInvoice} customer={getCustomer(viewInvoice.customer_id)} companyName={companyName} companyTagline={companyTagline} onClose={() => setViewInvoice(null)} />}
      {showRates && <RateSheetModal onClose={() => setShowRates(false)} />}
    </div>
  )
}
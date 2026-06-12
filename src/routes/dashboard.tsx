import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/dashboard')({
   head: () => ({
     meta: [{ title: 'Dashboard' }],
  }),
  component: Dashboard,
})

// ── Company config defaults ────────────────────────────────────────────────
const DEFAULT_COMPANY_NAME = 'Harbor'
const DEFAULT_COMPANY_TAGLINE = 'Shipping invoices, simplified'

type Stats = {
  total_revenue: number
  total_customers: number
  total_invoices: number
  total_weight_kg: number
}

type RecentInvoice = {
  id: string
  customer_name: string
  weight_kg: number
  amount: number
  status: string
  created_at: string
}

// ── Settings Modal ─────────────────────────────────────────────────────────
function SettingsModal({ email, companyName, tagline, onSaveCompany, onClose }: {
  email: string
  companyName: string
  tagline: string
  onSaveCompany: (name: string, tagline: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'company' | 'password' | 'forgot'>('company')
  const [name, setName] = useState(companyName)
  const [tag, setTag] = useState(tagline)
  const [savedMsg, setSavedMsg] = useState('')

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  function handleSaveCompany() {
    if (!name.trim()) return
    onSaveCompany(name.trim(), tag.trim())
    setSavedMsg('Saved!')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  async function handleChangePassword() {
    setPwMsg(''); setPwError('')
    if (!newPw) return setPwError('Please enter a new password.')
    if (newPw.length < 6) return setPwError('Password must be at least 6 characters.')
    if (newPw !== confirmPw) return setPwError('Passwords do not match.')
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) setPwError(error.message)
    else { setPwMsg('Password updated successfully!'); setNewPw(''); setConfirmPw('') }
  }

  async function handleForgotPassword() {
    setResetMsg(''); setResetError('')
    if (!email) return setResetError('No email address found.')
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    setResetLoading(false)
    if (error) setResetError(error.message)
    else setResetMsg(`Reset link sent to ${email}. Check your inbox.`)
  }

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
  )

  const tabs = [
    { key: 'company', label: '🏢 Company' },
    { key: 'password', label: '🔒 Password' },
    { key: 'forgot', label: '📧 Forgot password' },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '16px 28px 0', borderBottom: '1px solid #f1f5f9' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12,
              background: tab === t.key ? '#0a1628' : '#f1f5f9',
              color: tab === t.key ? 'white' : '#64748b',
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '24px 28px 28px' }}>

          {tab === 'company' && (
            <div>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                This name appears in the sidebar, invoices, PDFs, and messages.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Company name</label>
                {inp({ value: name, onChange: e => setName(e.target.value), placeholder: 'e.g. CS Couriers' })}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Tagline</label>
                {inp({ value: tag, onChange: e => setTag(e.target.value), placeholder: 'e.g. Shipping made simple' })}
              </div>
              {savedMsg && <div style={{ color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>✓ {savedMsg}</div>}
              <button onClick={handleSaveCompany} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#0a1628', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Save changes
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                Signed in as <strong>{email}</strong>
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>New password</label>
                {inp({ type: 'password', value: newPw, onChange: e => setNewPw(e.target.value), placeholder: 'At least 6 characters' })}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm new password</label>
                {inp({ type: 'password', value: confirmPw, onChange: e => setConfirmPw(e.target.value), placeholder: 'Repeat new password' })}
              </div>
              {pwError && <div style={{ color: '#e11d48', fontSize: 13, marginBottom: 12 }}>⚠ {pwError}</div>}
              {pwMsg && <div style={{ color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>✓ {pwMsg}</div>}
              <button onClick={handleChangePassword} disabled={pwLoading} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#0a1628', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {pwLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          )}

          {tab === 'forgot' && (
            <div>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                We'll send a password reset link to <strong>{email}</strong>. Click the link in your email to set a new password.
              </p>
              {resetError && <div style={{ color: '#e11d48', fontSize: 13, marginBottom: 12 }}>⚠ {resetError}</div>}
              {resetMsg
                ? <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 10, padding: '14px 16px', fontSize: 14, fontWeight: 600 }}>✓ {resetMsg}</div>
                : (
                  <button onClick={handleForgotPassword} disabled={resetLoading} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#0369a1', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    {resetLoading ? 'Sending...' : '📧 Send reset link'}
                  </button>
                )
              }
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [stats, setStats] = useState<Stats>({ total_revenue: 0, total_customers: 0, total_invoices: 0, total_weight_kg: 0 })
  const [invoices, setInvoices] = useState<RecentInvoice[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('companyName') ?? DEFAULT_COMPANY_NAME)
  const [companyTagline, setCompanyTagline] = useState(() => localStorage.getItem('companyTagline') ?? DEFAULT_COMPANY_TAGLINE)

  function handleSaveCompany(name: string, tag: string) {
    setCompanyName(name)
    setCompanyTagline(tag)
    localStorage.setItem('companyName', name)
    localStorage.setItem('companyTagline', tag)
    // Broadcast to other open tabs/pages
    window.dispatchEvent(new StorageEvent('storage', { key: 'companyName', newValue: name }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'companyTagline', newValue: tag }))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/' })
      else setEmail(data.user.email ?? '')
    })

    supabase.from('dashboard_stats').select('*').single().then(({ data }) => {
      if (data) setStats(data)
    })

    supabase.from('recent_invoices').select('*').limit(5).then(({ data }) => {
      if (data) setInvoices(data)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const statCards = [
    { label: 'Total revenue', value: `$${Number(stats.total_revenue).toFixed(2)}`, icon: '$', teal: true },
    { label: 'Customers', value: stats.total_customers, icon: '👥', teal: false },
    { label: 'Invoices', value: stats.total_invoices, icon: '🧾', teal: false },
    { label: 'Total weight', value: `${Number(stats.total_weight_kg).toFixed(1)} kg`, icon: '📦', teal: false },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>

      {/* Sidebar */}
      <div style={{ width: 230, background: '#0a1628', display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9396', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2H2v2z"/>
              <path d="M2 14h20M6 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/>
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
            <Link
              key={item.to}
              to={item.to}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#94a3b8', fontSize: 14, textDecoration: 'none', marginBottom: 4 }}
              activeProps={{ style: { background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, fontSize: 14, textDecoration: 'none', marginBottom: 4 } }}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>

        {/* Settings button */}
        <div style={{ padding: '0 12px 8px' }}>
          <button onClick={() => setShowSettings(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 8, color: '#94a3b8',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 4,
          }}>
            <span>⚙️</span> Settings
          </button>
        </div>

        <div style={{ padding: '0 20px', borderTop: '1px solid #1e293b', paddingTop: 14 }}>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12, wordBreak: 'break-all' }}>{email}</div>
          <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
            ↪ Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '40px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ color: '#64748b', marginTop: 4, marginBottom: 32 }}>An overview of your shipping operations.</p>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {statCards.map((card) => (
            <div key={card.label} style={{
              background: card.teal ? 'linear-gradient(135deg, #0e4f5c, #0e9396)' : 'white',
              borderRadius: 16, padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 13, color: card.teal ? 'rgba(255,255,255,0.7)' : '#64748b', marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.teal ? 'white' : '#0a1628' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Recent invoices */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Recent invoices</h2>
            <Link to="/invoices" style={{ color: '#0e9396', fontSize: 14, textDecoration: 'none' }}>View all</Link>
          </div>

          {invoices.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 14 }}>No invoices yet.</p>
          ) : invoices.map((inv) => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{inv.customer_name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{inv.weight_kg} kg · {new Date(inv.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>{inv.status}</span>
                <span style={{ fontWeight: 600 }}>${Number(inv.amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          email={email}
          companyName={companyName}
          tagline={companyTagline}
          onSaveCompany={handleSaveCompany}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
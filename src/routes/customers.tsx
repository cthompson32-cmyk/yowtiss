import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/customers')({
  head: () => ({
     meta: [{ title: 'Customers ' }],
  }),
  component: CustomersPage,
})

// ── Company config defaults ────────────────────────────────────────────────
const DEFAULT_COMPANY_NAME = 'Harbor'

type Customer = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  created_at: string
}

type FormState = {
  name: string
  email: string
  phone: string
  address: string
}

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
    {/* Settings link — navigates to dashboard where settings lives */}
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

function CustomerForm({ initial, onSave, onCancel, title }: {
  initial: FormState
  onSave: (form: FormState) => Promise<void>
  onCancel: () => void
  title: string
}) {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!form.name.trim()) return setError('Name is required.')
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  const inp = (label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      <input {...props} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>{title}</h2>

      {inp('Full name *', { type: 'text', value: form.name, placeholder: 'John Smith', onChange: e => setForm({ ...form, name: e.target.value }) })}
      {inp('Email', { type: 'email', value: form.email, placeholder: 'john@example.com', onChange: e => setForm({ ...form, email: e.target.value }) })}
      {inp('Phone (with country code)', { type: 'tel', value: form.phone, placeholder: '+1 876 555 0000', onChange: e => setForm({ ...form, phone: e.target.value }) })}
      {inp('Address', { type: 'text', value: form.address, placeholder: '123 Main St, Kingston', onChange: e => setForm({ ...form, address: e.target.value }) })}

      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
        💡 Add phone with country code (e.g. +1876...) for WhatsApp links to work correctly.
      </p>

      {error && <div style={{ color: '#e11d48', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
        <button onClick={handleSave} disabled={loading} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#0a1628', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          {loading ? 'Saving...' : 'Save customer'}
        </button>
      </div>
    </div>
  )
}

function CustomersPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('companyName') ?? DEFAULT_COMPANY_NAME)

  // Sync company name when changed from dashboard (same or other tabs)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'companyName' && e.newValue) setCompanyName(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const emptyForm: FormState = { name: '', email: '', phone: '', address: '' }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/' })
      else setEmail(data.user.email ?? '')
    })
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    if (data) setCustomers(data)
  }

  async function handleCreate(form: FormState) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('customers').insert({ user_id: user!.id, ...form })
    setShowCreate(false)
    fetchCustomers()
  }

  async function handleEdit(form: FormState) {
    if (!editCustomer) return
    await supabase.from('customers').update(form).eq('id', editCustomer.id)
    setEditCustomer(null)
    fetchCustomers()
  }

  async function handleDelete(id: string) {
    await supabase.from('customers').delete().eq('id', id)
    setDeleteId(null)
    fetchCustomers()
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const avatar = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      <Sidebar email={email} companyName={companyName} onSignOut={signOut} />

      <div style={{ flex: 1, padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Customers</h1>
            <p style={{ color: '#64748b', marginTop: 4, marginBottom: 0 }}>Manage your shipping customers.</p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            + New customer
          </button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or phone..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, marginBottom: 20, boxSizing: 'border-box', outline: 'none', background: 'white' }}
        />

        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 14, padding: 24 }}>
              {customers.length === 0 ? 'No customers yet. Add your first one!' : 'No customers match your search.'}
            </p>
          ) : filtered.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 24px',
              borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #0e4f5c, #0e9396)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {avatar(c.name)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                  {c.email && <span>✉ {c.email}</span>}
                  {c.phone && <span>📱 {c.phone}</span>}
                  {c.address && <span>📍 {c.address}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {c.phone && (
                  <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#25D366', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    WhatsApp
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: '#0a1628', cursor: 'pointer', fontSize: 13, textDecoration: 'none' }}>
                    Email
                  </a>
                )}
                <button onClick={() => setEditCustomer(c)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                <button onClick={() => setDeleteId(c.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#e11d48', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <CustomerForm initial={emptyForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} title="New Customer" />
        </div>
      )}

      {editCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <CustomerForm
            initial={{ name: editCustomer.name, email: editCustomer.email ?? '', phone: editCustomer.phone ?? '', address: editCustomer.address ?? '' }}
            onSave={handleEdit}
            onCancel={() => setEditCustomer(null)}
            title="Edit Customer"
          />
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Delete customer?</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>This will also delete all their invoices. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#e11d48', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
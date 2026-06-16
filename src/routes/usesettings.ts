import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEFAULT_COMPANY_NAME = 'Harbor'
const DEFAULT_COMPANY_TAGLINE = 'Shipping invoices, simplified'

export type Settings = {
  companyName: string
  companyTagline: string
}

export function useSettings() {
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME)
  const [companyTagline, setCompanyTagline] = useState(DEFAULT_COMPANY_TAGLINE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('settings')
        .select('company_name, company_tagline')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setCompanyName(data.company_name ?? DEFAULT_COMPANY_NAME)
        setCompanyTagline(data.company_tagline ?? DEFAULT_COMPANY_TAGLINE)
      }
      setLoading(false)
    }

    fetchSettings()
  }, [])

  async function saveSettings(name: string, tagline: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('settings')
      .upsert(
        { user_id: user.id, company_name: name, company_tagline: tagline },
        { onConflict: 'user_id' }
      )

    setCompanyName(name)
    setCompanyTagline(tagline)
  }

  return { companyName, companyTagline, saveSettings, loading }
}
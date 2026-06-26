// hooks/useCalendarData.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, Category, Subcategory, Season, UserProfile } from '@/types'

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setSeasons(data ?? [])
        setLoading(false)
      })
  }, [])

  return { seasons, loading }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { categories, loading, refresh }
}

export function useSubcategories(categoryId?: string) {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const supabase = createClient()

  useEffect(() => {
    let query = supabase
      .from('subcategories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (categoryId) query = query.eq('category_id', categoryId)

    query.then(({ data }) => setSubcategories(data ?? []))
  }, [categoryId])

  return { subcategories }
}

export function useEvents(seasonId?: string, filters?: {
  categoryId?: string
  keyword?: string
  month?: number
  weekNumber?: number
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(() => {
    if (!seasonId) return

    setLoading(true)
    let query = supabase
      .from('events')
      .select(`
        *,
        category:categories(*),
        subcategory:subcategories(*),
        event_documents(*)
      `)
      .eq('season_id', seasonId)
      .order('start_date')

    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters?.weekNumber) query = query.eq('week_number', filters.weekNumber)
    if (filters?.keyword) {
      query = query.or(
        `title.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%,location.ilike.%${filters.keyword}%`
      )
    }

    query.then(({ data }) => {
      setEvents(data ?? [])
      setLoading(false)
    })
  }, [seasonId, filters?.categoryId, filters?.keyword, filters?.weekNumber])

  useEffect(() => { refresh() }, [refresh])

  return { events, loading, refresh }
}

export function useCurrentUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    })
  }, [])

  return { profile, loading, isAdmin: profile?.role === 'admin' }
}

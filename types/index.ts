// types/index.ts

export type EventStatus = 'previsionnel' | 'confirme' | 'annule' | 'reporte'
export type UserRole = 'admin' | 'club'

export interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface EventDocument {
  id: string
  event_id: string
  filename: string
  file_url: string
  file_size: number | null
  uploaded_at: string
}

export interface CalendarEvent {
  id: string
  season_id: string
  category_id: string
  subcategory_id: string | null
  title: string
  description: string | null
  location: string | null
  target_audience: string | null
  start_date: string
  end_date: string
  week_number: number
  sport_week_start: string
  status: EventStatus
  color: string | null
  created_at: string
  updated_at: string
  // Relations jointes
  category?: Category
  subcategory?: Subcategory
  event_documents?: EventDocument[]
}

export interface UserProfile {
  id: string
  role: UserRole
  club_name: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  changed_by: string | null
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

// Semaine sportive pour la vue planning
export interface SportWeek {
  week_number: number
  monday: Date
  friday: Date
  saturday: Date
  sunday: Date
  events: CalendarEvent[]
}

// Format d'export/import Excel normalisé
export interface ExportRow {
  saison: string
  date_debut: string
  date_fin: string
  semaine: number
  categorie: string
  sous_categorie: string
  titre: string
  description: string
  lieu: string
  public_concerne: string
  statut: string
  couleur: string
}

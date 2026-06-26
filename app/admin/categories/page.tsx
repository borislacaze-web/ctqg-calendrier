// app/admin/categories/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, GripVertical, Save, X, ChevronDown, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { useCurrentUser } from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import type { Category, Subcategory } from '@/types'
import toast from 'react-hot-toast'

export default function CategoriesPage() {
  const { isAdmin, loading } = useCurrentUser()
  const router = useRouter()
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [newCat, setNewCat] = useState({ name: '', color: '#3B82F6', icon: 'calendar' })
  const [showNewCat, setShowNewCat] = useState(false)
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null)
  const [newSubs, setNewSubs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/')
  }, [loading, isAdmin])

  const load = async () => {
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('sort_order'),
    ])
    setCategories(cats ?? [])
    setSubcategories(subs ?? [])
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const saveCategory = async () => {
    if (!newCat.name.trim()) return
    const { error } = await supabase.from('categories').insert({
      name: newCat.name.trim(),
      color: newCat.color,
      icon: newCat.icon,
      sort_order: categories.length,
    })
    if (error) { toast.error('Erreur'); return }
    toast.success('Catégorie créée')
    setNewCat({ name: '', color: '#3B82F6', icon: 'calendar' })
    setShowNewCat(false)
    load()
  }

  const updateCategory = async (cat: Category) => {
    const { error } = await supabase.from('categories').update({
      name: cat.name, color: cat.color, icon: cat.icon
    }).eq('id', cat.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Catégorie mise à jour')
    setEditingCat(null)
    load()
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie et tous ses événements ?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Catégorie supprimée')
    load()
  }

  const addSubcategory = async (categoryId: string) => {
    const name = newSubs[categoryId]?.trim()
    if (!name) return
    const subs = subcategories.filter(s => s.category_id === categoryId)
    const { error } = await supabase.from('subcategories').insert({
      category_id: categoryId,
      name,
      sort_order: subs.length,
    })
    if (error) { toast.error('Erreur'); return }
    toast.success('Sous-catégorie ajoutée')
    setNewSubs(prev => ({ ...prev, [categoryId]: '' }))
    load()
  }

  const deleteSubcategory = async (id: string) => {
    await supabase.from('subcategories').delete().eq('id', id)
    toast.success('Sous-catégorie supprimée')
    load()
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Catégories</h1>
          <button onClick={() => setShowNewCat(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Nouvelle catégorie
          </button>
        </div>

        {/* Formulaire nouvelle catégorie */}
        {showNewCat && (
          <div className="card p-4 mb-4">
            <h3 className="font-semibold text-slate-800 mb-3">Nouvelle catégorie</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                className="input flex-1 min-w-[200px]"
                placeholder="Nom de la catégorie"
                value={newCat.name}
                onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveCategory()}
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Couleur</label>
                <input
                  type="color"
                  value={newCat.color}
                  onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))}
                  className="h-9 w-10 rounded border border-slate-300 p-0.5 cursor-pointer"
                />
              </div>
              <button onClick={saveCategory} className="btn-primary text-sm"><Save className="w-4 h-4" />Créer</button>
              <button onClick={() => setShowNewCat(false)} className="btn-secondary text-sm"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* Liste catégories */}
        <div className="space-y-2">
          {categories.map(cat => {
            const subs = subcategories.filter(s => s.category_id === cat.id)
            const isExpanded = expanded.has(cat.id)

            return (
              <div key={cat.id} className="card overflow-hidden">
                {/* En-tête catégorie */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />

                  {editingCat?.id === cat.id ? (
                    <div className="flex-1 flex gap-2 flex-wrap">
                      <input
                        className="input flex-1 text-sm"
                        value={editingCat.name}
                        onChange={e => setEditingCat(p => p ? { ...p, name: e.target.value } : p)}
                      />
                      <input
                        type="color"
                        value={editingCat.color}
                        onChange={e => setEditingCat(p => p ? { ...p, color: e.target.value } : p)}
                        className="h-9 w-10 rounded border border-slate-300 p-0.5 cursor-pointer"
                      />
                      <button onClick={() => updateCategory(editingCat)} className="btn-primary text-xs py-1"><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingCat(null)} className="btn-secondary text-xs py-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-slate-800 flex-1">{cat.name}</span>
                      <span className="text-xs text-slate-400">{subs.length} sous-cat.</span>
                      <button onClick={() => setEditingCat(cat)} className="p-1 rounded hover:bg-slate-100">
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                      <button onClick={() => toggleExpand(cat.id)} className="p-1 rounded hover:bg-slate-100">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-500" />
                          : <ChevronRight className="w-4 h-4 text-slate-500" />
                        }
                      </button>
                    </>
                  )}
                </div>

                {/* Sous-catégories */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                    <ul className="space-y-1 mb-3">
                      {subs.length === 0 && (
                        <li className="text-xs text-slate-400 italic">Aucune sous-catégorie</li>
                      )}
                      {subs.map(sub => (
                        <li key={sub.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span className="text-sm text-slate-700 flex-1">{sub.name}</span>
                          <button
                            onClick={() => deleteSubcategory(sub.id)}
                            className="p-0.5 rounded hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {/* Ajouter sous-catégorie */}
                    <div className="flex gap-2">
                      <input
                        className="input text-xs flex-1 py-1.5"
                        placeholder="Nouvelle sous-catégorie..."
                        value={newSubs[cat.id] ?? ''}
                        onChange={e => setNewSubs(p => ({ ...p, [cat.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addSubcategory(cat.id)}
                      />
                      <button
                        onClick={() => addSubcategory(cat.id)}
                        className="btn-secondary text-xs py-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

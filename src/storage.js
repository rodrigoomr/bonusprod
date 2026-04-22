import { supabase } from './supabase.js'

// ═══════════════════════════════════════════════════════════════
// BonusProd v4 — API Supabase
// Meta em pontos por colaborador + setor final (Acabamento)
// ═══════════════════════════════════════════════════════════════

// ── USERS ──
export async function getUsers() {
  const { data, error } = await supabase.from('users').select('*').order('name')
  if (error) { console.error('getUsers:', error); return []; }
  return data.map(u => ({ ...u, sectorIds: u.sector_ids || [], pointsGoal: u.points_goal || 500 }))
}

export async function upsertUser(user) {
  const row = { id: user.id, name: user.name, login: user.login, password: user.password, role: user.role || 'employee', sector_ids: user.sectorIds || [], points_goal: user.pointsGoal || 500 }
  const { data, error } = await supabase.from('users').upsert(row, { onConflict: 'id' }).select().single()
  if (error) { console.error('upsertUser:', error); return null; }
  return { ...data, sectorIds: data.sector_ids || [], pointsGoal: data.points_goal || 500 }
}

export async function deleteUser(id) {
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) console.error('deleteUser:', error)
}

// ── SECTORS ──
export async function getSectors() {
  const { data, error } = await supabase.from('sectors').select('*').order('name')
  if (error) { console.error('getSectors:', error); return []; }
  return data.map(s => ({ id: s.id, name: s.name, pointsPerUnit: Number(s.points_per_unit), isFinal: s.is_final || false }))
}

export async function upsertSector(sector) {
  const row = { id: sector.id, name: sector.name, points_per_unit: sector.pointsPerUnit, is_final: sector.isFinal || false }
  const { data, error } = await supabase.from('sectors').upsert(row, { onConflict: 'id' }).select().single()
  if (error) { console.error('upsertSector:', error); return null; }
  return { id: data.id, name: data.name, pointsPerUnit: Number(data.points_per_unit), isFinal: data.is_final || false }
}

export async function deleteSector(id) {
  const { error } = await supabase.from('sectors').delete().eq('id', id)
  if (error) console.error('deleteSector:', error)
}

// ── PRODUCTION ──
export async function getProduction() {
  const { data, error } = await supabase.from('production').select('*').order('created_at', { ascending: false })
  if (error) { console.error('getProduction:', error); return []; }
  return data.map(p => ({ id: p.id, userId: p.user_id, sectorId: p.sector_id, quantity: p.quantity, date: p.date, createdAt: p.created_at }))
}

export async function addProduction(entry) {
  const row = { id: entry.id, user_id: entry.userId, sector_id: entry.sectorId, quantity: entry.quantity, date: entry.date }
  const { data, error } = await supabase.from('production').insert(row).select().single()
  if (error) { console.error('addProduction:', error); return null; }
  return { id: data.id, userId: data.user_id, sectorId: data.sector_id, quantity: data.quantity, date: data.date, createdAt: data.created_at }
}

export async function updateProduction(entry) {
  const row = { user_id: entry.userId, sector_id: entry.sectorId, quantity: entry.quantity, date: entry.date }
  const { data, error } = await supabase.from('production').update(row).eq('id', entry.id).select().single()
  if (error) { console.error('updateProduction:', error); return null; }
  return { id: data.id, userId: data.user_id, sectorId: data.sector_id, quantity: data.quantity, date: data.date, createdAt: data.created_at }
}

export async function deleteProduction(id) {
  const { error } = await supabase.from('production').delete().eq('id', id)
  if (error) console.error('deleteProduction:', error)
}

// ── CONFIG ──
export async function getConfig() {
  const { data, error } = await supabase.from('config').select('*').eq('id', 1).single()
  if (error) { console.error('getConfig:', error); return { pointValue: 0.5, minGoalPercent: 100, finalSectorId: 's1', workingDays: 0 }; }
  return { pointValue: Number(data.point_value), minGoalPercent: data.min_goal_percent, finalSectorId: data.final_sector_id || 's1', workingDays: data.working_days || 0 }
}

export async function saveConfig(config) {
  const row = { id: 1, point_value: config.pointValue, min_goal_percent: config.minGoalPercent, final_sector_id: config.finalSectorId, working_days: config.workingDays || 0 }
  const { error } = await supabase.from('config').upsert(row, { onConflict: 'id' })
  if (error) console.error('saveConfig:', error)
}

// ── HISTORY ──
export async function getHistory() {
  const { data, error } = await supabase.from('history').select('*').order('closed_at', { ascending: false })
  if (error) { console.error('getHistory:', error); return []; }
  return data.map(h => ({ id: h.id, monthKey: h.month_key, closedAt: h.closed_at, pointValue: Number(h.point_value), employees: h.employees || [] }))
}

export async function addHistory(entry) {
  const row = { id: entry.id, month_key: entry.monthKey, point_value: entry.pointValue, employees: entry.employees }
  const { error } = await supabase.from('history').insert(row)
  if (error) console.error('addHistory:', error)
}

// ── LOGS ──
export async function getLogs() {
  const { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) { console.error('getLogs:', error); return []; }
  return data.map(l => ({ id: l.id, userId: l.user_id, userName: l.user_name, action: l.action, details: l.details, timestamp: l.created_at }))
}

export async function addLog(entry) {
  const row = { id: entry.id, user_id: entry.userId, user_name: entry.userName, action: entry.action, details: entry.details }
  const { error } = await supabase.from('logs').insert(row)
  if (error) console.error('addLog:', error)
}

import type { User } from '@supabase/supabase-js'
import type { Profile } from './api'

/** Same rules as SideNav / Settings: API profile wins; no auth metadata once profile exists. */
export function accountDisplayName(
  profile: Profile | null | undefined,
  user: User | null | undefined
): string {
  const email = user?.email?.trim()
  const emailLocal = email ? (email.split('@')[0] ?? email) : null

  if (profile) {
    const fromProfile = profile.full_name?.trim()
    if (fromProfile) return fromProfile
    if (emailLocal) return emailLocal
    return 'Account'
  }

  const metaName = user?.user_metadata?.full_name
  if (typeof metaName === 'string' && metaName.trim()) return metaName.trim()
  if (emailLocal) return emailLocal
  return 'Account'
}

export function accountEmail(profile: Profile | null | undefined, user: User | null | undefined): string {
  const p = profile?.email?.trim()
  if (p) return p
  return user?.email?.trim() ?? ''
}

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/**
 * Short name for greetings: first token when multiple words, else full display token.
 * While profile is loading, falls back to email local-part (avoids flash to wrong name).
 */
export function greetingFirstName(
  profile: Profile | null | undefined,
  user: User | null | undefined,
  profileLoading: boolean
): string {
  if (profileLoading && !profile) {
    const email = user?.email?.trim()
    return email ? (email.split('@')[0] ?? email) : ''
  }
  const display = accountDisplayName(profile, user)
  const parts = display.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return parts[0]!
}

export function profileAvatarUrl(profile: Profile | null | undefined): string | null {
  const raw = profile?.avatar_url?.trim()
  if (raw && /^https?:\/\//i.test(raw)) return raw
  return null
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddFamilyMemberModal } from '../components/AddFamilyMemberModal'
import { FamilyCardSkeleton } from '../components/Skeleton'
import { TopBar } from '../components/TopBar'
import { useFamilyMembers } from '../hooks/useFamilyMembers'
import { useProfile } from '../hooks/useProfile'
import { api, ApiError } from '../lib/api'
import type { CreateFamilyMemberRequest, Document, FamilyMember, HealthValue } from '../lib/api'

const FAMILY_MAX_FREE = 1
const FAMILY_MAX_PRO = 5

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

type MemberStats = { reportCount: number; valueCount: number; lastUpload: string | null }

function buildMemberStats(
  members: FamilyMember[],
  documents: Document[],
  healthValues: HealthValue[]
): Map<string, MemberStats> {
  const map = new Map<string, MemberStats>()
  for (const m of members) {
    const mDocs = documents.filter((d) => d.family_member_id === m.id)
    let last: string | null = null
    if (mDocs.length) {
      let maxT = 0
      for (const d of mDocs) {
        const t = d.report_date
          ? new Date(d.report_date).getTime()
          : new Date(d.created_at).getTime()
        if (t > maxT) maxT = t
      }
      last = new Date(maxT).toLocaleDateString(undefined, { dateStyle: 'medium' })
    }
    const valueCount = healthValues.filter((h) => h.family_member_id === m.id).length
    map.set(m.id, { reportCount: mDocs.length, valueCount, lastUpload: last })
  }
  return map
}

function getAvatarForRelationship(rel: string | null) {
  const key = (rel ?? 'other').toLowerCase()
  switch (key) {
    case 'self':
      return {
        circle: 'bg-primary-fixed/20 outline outline-2 outline-primary-fixed/10',
        initial: 'text-primary',
      }
    case 'spouse':
      return {
        circle: 'bg-secondary-container/30 outline outline-2 outline-secondary-container/20',
        initial: 'text-secondary',
      }
    case 'parent':
      return {
        circle: 'bg-tertiary-fixed/30 outline outline-2 outline-tertiary-fixed/20',
        initial: 'text-tertiary',
      }
    default:
      return {
        circle: 'bg-surface-container outline outline-2 outline-outline-variant/20',
        initial: 'text-on-surface',
      }
  }
}

function getBadgeClasses(rel: string | null) {
  const key = (rel ?? 'other').toLowerCase()
  switch (key) {
    case 'self':
      return 'px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-[10px] font-bold tracking-widest uppercase'
    case 'spouse':
      return 'px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold tracking-widest uppercase'
    case 'parent':
      return 'px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-[10px] font-bold tracking-widest uppercase'
    default:
      return 'px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-[10px] font-bold tracking-widest uppercase'
  }
}

function MemberCard({
  member,
  stats,
}: {
  member: FamilyMember
  stats: MemberStats
}) {
  const relLabel = member.relationship?.replace(/^\w/, (c) => c.toUpperCase()) ?? 'Other'
  const avatarClasses = getAvatarForRelationship(member.relationship)
  const badgeClass = getBadgeClasses(member.relationship)
  const reportsPath = `/reports?family_member_id=${encodeURIComponent(member.id)}`

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-xl p-8 flex flex-col items-center text-center transition-all hover:-translate-y-1">
      <div
        className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border-4 border-surface-container-lowest ${avatarClasses.circle}`}
      >
        <span className={`text-3xl font-bold font-serif ${avatarClasses.initial}`}>
          {initialsFromName(member.name)}
        </span>
      </div>

      <span className={`${badgeClass} mb-2`}>{relLabel}</span>

      <h3 className="font-serif text-2xl text-on-surface mb-1">{member.name}</h3>

      <div className="flex items-center gap-4 text-on-surface-variant text-sm mb-6">
        <span>
          {stats.reportCount} report{stats.reportCount !== 1 ? 's' : ''}
        </span>
        <span className="w-1 h-1 rounded-full bg-outline-variant" />
        <span>
          {stats.valueCount} value{stats.valueCount !== 1 ? 's' : ''} tracked
        </span>
      </div>

      <div className="w-full h-px bg-surface-container-high mb-6" />

      <p className="text-xs text-on-surface-variant mb-8">
        {stats.lastUpload ? `Last activity ${stats.lastUpload}` : 'No reports yet for this profile'}
      </p>

      <Link
        to={reportsPath}
        className="w-full py-3 px-6 bg-surface-container-low text-on-surface font-semibold rounded-full hover:bg-surface-container-high transition-colors mb-3 text-center"
      >
        Switch to profile
      </Link>

      <Link
        to={reportsPath}
        className="text-secondary font-semibold text-sm flex items-center justify-center gap-2 hover:underline"
      >
        View records
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </Link>
    </div>
  )
}

export function FamilyPage() {
  const [showModal, setShowModal] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const { members, loading, error, refetch, create, creating } = useFamilyMembers()
  const { profile, loading: profileLoading } = useProfile()
  const [statsByMember, setStatsByMember] = useState<Map<string, MemberStats>>(new Map())
  const [statsLoading, setStatsLoading] = useState(true)

  const maxMembers = profile?.plan === 'pro' ? FAMILY_MAX_PRO : FAMILY_MAX_FREE
  const atLimit = members.length >= maxMembers
  const limitsReady = !profileLoading

  const loadStats = useCallback(async () => {
    if (members.length === 0) {
      setStatsByMember(new Map())
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    try {
      const [docsPage, hvs] = await Promise.all([api.documents.list({ limit: 1000 }), api.healthValues.list()])
      setStatsByMember(buildMemberStats(members, docsPage.items, hvs))
    } catch {
      setStatsByMember(new Map())
    } finally {
      setStatsLoading(false)
    }
  }, [members])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const handleAddMember = async (data: CreateFamilyMemberRequest) => {
    setModalError(null)
    try {
      await create(data)
      setShowModal(false)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not add family member'
      setModalError(message)
    }
  }

  const showPageLoading = loading
  const memberCardsReady = !statsLoading

  return (
    <div className="flex-1 h-screen overflow-y-auto scroll-smooth">
      <TopBar
        title="Family"
        subtitle={
          showPageLoading
            ? 'Loading…'
            : `${members.length} member${members.length !== 1 ? 's' : ''}${
                limitsReady
                  ? ` · ${atLimit ? 'Profile limit reached' : `Add up to ${maxMembers} on your plan`}`
                  : ''
              }`
        }
        ctaLabel="Add member"
        onCtaClick={() => {
          if (!atLimit) {
            setModalError(null)
            setShowModal(true)
          }
        }}
        showCta={!showPageLoading && limitsReady && !atLimit}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 lg:mb-16 gap-6">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface mb-4 leading-tight">
              Family profiles
            </h1>
            <p className="text-lg text-on-surface-variant">
              Manage health records for your family members in a single, curated space.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="mb-8 rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            role="alert"
          >
            <p className="text-sm text-on-surface">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {showPageLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <FamilyCardSkeleton />
            <FamilyCardSkeleton />
            <FamilyCardSkeleton />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-on-surface-variant">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl">family_restroom</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-on-surface mb-2">No family members yet</h2>
            <p className="text-on-surface-variant mb-6 max-w-md">
              Add a profile to keep reports and trends organized for each person.
            </p>
            {limitsReady && !atLimit && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null)
                  setShowModal(true)
                }}
                className="bg-primary text-on-primary px-8 py-3 rounded-full font-semibold"
              >
                Add family member
              </button>
            )}
            {limitsReady && atLimit && (
              <a
                href="/settings/subscription"
                className="text-primary font-semibold text-sm hover:underline"
              >
                Upgrade to add more profiles
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                stats={statsByMember.get(m.id) ?? { reportCount: 0, valueCount: 0, lastUpload: null }}
              />
            ))}

            {limitsReady && atLimit && (
              <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-surface-variant text-3xl">lock</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-on-surface mb-2">Family limit reached</h3>
                <p className="text-sm text-on-surface-variant mb-6 max-w-[220px]">
                  {profile?.plan === 'pro'
                    ? 'You have reached the maximum of 5 family profiles on your plan.'
                    : 'Free accounts can add 1 family member. Upgrade to Pro to add up to 5 profiles.'}
                </p>
                <a
                  href="/settings/subscription"
                  className="bg-primary text-on-primary px-6 py-3 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">workspace_premium</span>
                  Upgrade
                </a>
              </div>
            )}

            {limitsReady && !atLimit && memberCardsReady && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null)
                  setShowModal(true)
                }}
                className="bg-surface border-2 border-dashed border-outline-variant/40 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-surface-container-low min-h-[400px] group"
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center mb-4 group-hover:bg-primary/5 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">add</span>
                </div>
                <span className="text-secondary font-semibold font-serif text-xl">Add family member</span>
                <p className="text-sm text-on-surface-variant mt-2 max-w-[180px]">Expand your health circle</p>
              </button>
            )}
            {!memberCardsReady && !atLimit && <FamilyCardSkeleton />}
          </div>
        )}

        <div className="mt-16 lg:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 relative">
            <div className="aspect-square rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[72px]">family_restroom</span>
            </div>
            <div className="absolute -bottom-6 -right-6 bg-surface-container text-on-surface p-6 rounded-xl max-w-[200px] border border-outline-variant/20 shadow-md">
              <span className="material-symbols-outlined text-secondary mb-2">verified</span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Family profiles help you keep each person’s reports organized in one place.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7 lg:pl-4">
            <h4 className="font-serif text-3xl text-on-surface mb-6">Why manage family health here?</h4>
            <ul className="space-y-8">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                </div>
                <div>
                  <h5 className="font-semibold text-on-surface mb-1">Unified tracking</h5>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    See biomarkers and reports per person, linked from your uploads.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary text-[20px]">share</span>
                </div>
                <div>
                  <h5 className="font-semibold text-on-surface mb-1">Per-profile reports</h5>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Filter My Reports by family member to review only their documents.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <AddFamilyMemberModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setModalError(null)
        }}
        onSubmit={handleAddMember}
        creating={creating}
        errorMessage={modalError}
      />
    </div>
  )
}

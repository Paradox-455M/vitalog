import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useFamilyMembers } from '../hooks/useFamilyMembers'
import type { FamilyMember } from '../lib/api'

interface FamilyMemberContextValue {
  activeMemberId: string | null
  activeMemberName: string
  setActiveMemberId: (id: string | null) => void
  members: FamilyMember[]
}

const FamilyMemberContext = createContext<FamilyMemberContextValue | null>(null)

export function FamilyMemberProvider({ children }: { children: React.ReactNode }) {
  const { members } = useFamilyMembers()
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)

  // Safety: if active member is deleted (no longer in list), reset to null
  useEffect(() => {
    if (activeMemberId && members.length > 0) {
      const exists = members.some((m) => m.id === activeMemberId)
      if (!exists) {
        setActiveMemberId(null)
      }
    }
  }, [activeMemberId, members])

  const activeMemberName = useMemo(() => {
    if (!activeMemberId) return 'Self'
    const member = members.find((m) => m.id === activeMemberId)
    return member?.name ?? 'Self'
  }, [activeMemberId, members])

  const value = useMemo<FamilyMemberContextValue>(
    () => ({
      activeMemberId,
      activeMemberName,
      setActiveMemberId,
      members,
    }),
    [activeMemberId, activeMemberName, members],
  )

  return (
    <FamilyMemberContext.Provider value={value}>
      {children}
    </FamilyMemberContext.Provider>
  )
}

export function useFamilyMember(): FamilyMemberContextValue {
  const ctx = useContext(FamilyMemberContext)
  if (!ctx) {
    throw new Error('useFamilyMember must be used within FamilyMemberProvider')
  }
  return ctx
}

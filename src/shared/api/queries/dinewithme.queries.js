import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── Dine With Me Admin Stats ───────────────────────────────────────────────

export function useDineAdminStats() {
    return useQuery({
        queryKey: queryKeys.dine.adminStats,
        queryFn: async () => {
            const { getDineStats } = await import('../dinewithme-admin.api')
            return getDineStats()
        },
        staleTime: 15_000,
    })
}

// ─── Presences ──────────────────────────────────────────────────────────────

export function useDineAdminPresences(opts = {}) {
    return useQuery({
        queryKey: queryKeys.dine.adminPresences(opts),
        queryFn: async () => {
            const { getDinePresences } = await import('../dinewithme-admin.api')
            return getDinePresences(opts)
        },
        staleTime: 15_000,
    })
}

export function useDeleteDinePresenceMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (presenceId) => {
            const { deleteDinePresence } = await import('../dinewithme-admin.api')
            return deleteDinePresence(presenceId)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dine-admin-presences'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

// ─── Waves ──────────────────────────────────────────────────────────────────

export function useDineAdminWaves(limit = 50) {
    return useQuery({
        queryKey: queryKeys.dine.adminWaves(limit),
        queryFn: async () => {
            const { getDineWaves } = await import('../dinewithme-admin.api')
            return getDineWaves(limit)
        },
        staleTime: 15_000,
    })
}

export function useDeleteDineWaveMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (waveId) => {
            const { deleteDineWave } = await import('../dinewithme-admin.api')
            return deleteDineWave(waveId)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dine-admin-waves'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

// ─── Reports ────────────────────────────────────────────────────────────────

export function useDineAdminReports(opts = {}) {
    return useQuery({
        queryKey: queryKeys.dine.adminReports(opts),
        queryFn: async () => {
            const { getDinerReports } = await import('../dinewithme-admin.api')
            return getDinerReports(opts)
        },
        staleTime: 15_000,
    })
}

export function useUpdateReportStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ reportId, status }) => {
            const { updateReportStatus } = await import('../dinewithme-admin.api')
            return updateReportStatus(reportId, status)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dine-admin-reports'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

// ─── Waitlist ───────────────────────────────────────────────────────────────

export function useDineAdminWaitlist(opts = {}) {
    return useQuery({
        queryKey: queryKeys.dine.adminWaitlist(opts),
        queryFn: async () => {
            const { getDineWaitlist } = await import('../dinewithme-admin.api')
            return getDineWaitlist(opts)
        },
        staleTime: 15_000,
    })
}

export function useUpdateWaitlistStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ entryId, status }) => {
            const { updateWaitlistStatus } = await import('../dinewithme-admin.api')
            return updateWaitlistStatus(entryId, status)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dine-admin-waitlist'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

export function useDeleteWaitlistEntryMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (entryId) => {
            const { deleteWaitlistEntry } = await import('../dinewithme-admin.api')
            return deleteWaitlistEntry(entryId)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dine-admin-waitlist'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

// ─── User waitlist (for ProfilePage) ────────────────────────────────────────

export function useUserWaitlistStatus(userId) {
    return useQuery({
        queryKey: queryKeys.dine.userWaitlist(userId),
        queryFn: async () => {
            const { checkWaitlistStatus } = await import('../dinewithme-admin.api')
            return checkWaitlistStatus(userId)
        },
        enabled: !!userId,
        staleTime: 60_000,
    })
}

export function useJoinWaitlistMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, message }) => {
            const { joinDineWaitlist } = await import('../dinewithme-admin.api')
            return joinDineWaitlist(userId, message)
        },
        onSuccess: (_data, { userId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.dine.userWaitlist(userId) })
            qc.invalidateQueries({ queryKey: ['dine-admin-waitlist'] })
            qc.invalidateQueries({ queryKey: queryKeys.dine.adminStats })
        },
    })
}

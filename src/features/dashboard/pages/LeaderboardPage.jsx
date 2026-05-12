import React from 'react'
import { motion } from 'framer-motion'
import { Trophy, Star, TrendingUp, Medal, Crown, Loader2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { PageTransition } from '@/components/ui/PageTransition'
import { useLeaderboard, useUserRank } from '@/shared/api/queries'
import { useAuthStore } from '@/shared/store/useAuthStore'

export default function LeaderboardPage() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { user } = useAuthStore()
    const { data: leaderboard = [], isLoading } = useLeaderboard(50)
    const { data: userRank } = useUserRank(user?.id)

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-slate-200"

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <Crown size={20} className="text-yellow-500" />
            case 2: return <Medal size={20} className="text-slate-400" />
            case 3: return <Medal size={20} className="text-amber-600" />
            default: return <span className={`font-black text-lg ${subTextStyle}`}>#{rank}</span>
        }
    }

    const getInitials = (name) => {
        if (!name) return '?'
        return name.charAt(0).toUpperCase()
    }

    // Loading state
    if (isLoading) {
        return (
            <PageTransition className="w-full max-w-4xl mx-auto flex flex-col pt-24 pb-32 px-6">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <Loader2 size={40} className="text-amber-500 animate-spin mb-4" />
                    <p className={`text-lg ${subTextStyle}`}>Loading leaderboard...</p>
                </div>
            </PageTransition>
        )
    }

    // Empty state
    if (leaderboard.length === 0) {
        return (
            <PageTransition className="w-full max-w-4xl mx-auto flex flex-col pt-24 pb-32 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 mb-6 border border-amber-500/20">
                        <Trophy size={32} />
                    </div>
                    <h1 className={`text-4xl md:text-5xl font-black tracking-tight mb-4 ${textStyle}`}>
                        GastroMap <span className="text-amber-500">Top Contributors</span>
                    </h1>
                    <p className={`text-lg max-w-xl mx-auto ${subTextStyle}`}>
                        No contributors on the leaderboard yet. Be the first to climb the ranks!
                    </p>
                </motion.div>
            </PageTransition>
        )
    }

    const top3 = leaderboard.slice(0, 3)
    const restOfList = leaderboard.slice(3, 5)
    const isLoggedIn = !!user
    const userInTop = isLoggedIn && leaderboard.some(entry => entry.profile_id === user?.id)

    return (
        <PageTransition className="w-full max-w-4xl mx-auto flex flex-col pt-24 md:pt-10 pb-32 px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-10"
            >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 mb-6 border border-amber-500/20">
                    <Trophy size={32} />
                </div>
                <h1 className={`text-4xl md:text-5xl font-black tracking-tight mb-4 ${textStyle}`}>
                    GastroMap <span className="text-amber-500">Top Contributors</span>
                </h1>
                <p className={`text-lg max-w-xl mx-auto ${subTextStyle}`}>
                    Climb the ranks by adding incredible places and writing helpful reviews. Top contributors get exclusive rewards!
                </p>
            </motion.div>

            {/* User's current rank banner (if logged in) */}
            {isLoggedIn && userRank && userRank.rank > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-6 p-4 rounded-2xl border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}
                >
                    <div className="flex items-center justify-center gap-3">
                        <Trophy size={20} className="text-indigo-500" />
                        <span className={`font-bold ${textStyle}`}>Your Rank: #{userRank.rank}</span>
                        <span className="text-indigo-500 font-black">{userRank.points} pts</span>
                    </div>
                </motion.div>
            )}

            {/* Top 3 Podium (Visual Flare) */}
            <div className="flex items-end justify-center gap-2 md:gap-4 mb-12">
                {/* 2nd Place */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col items-center relative z-10"
                >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-xl border-[3px] z-10 mb-2 ${isDark ? 'bg-[hsl(220,20%,12%)] border-white/[0.08]' : 'bg-slate-200 border-slate-300'}`}>
                        {top3[1] ? getInitials(top3[1].full_name) : '?'}
                    </div>
                    <div className={`w-20 md:w-28 h-28 bg-gradient-to-t rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x ${isDark ? 'from-slate-800 to-slate-700 border-slate-600/50' : 'from-slate-200 to-slate-100 border-slate-300/50'}`}>
                        <span className="font-bold text-slate-500">#2</span>
                        <span className={`text-[10px] font-black ${textStyle}`}>{top3[1]?.total_points || 0} pts</span>
                    </div>
                </motion.div>

                {/* 1st Place */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center relative z-20"
                >
                    <div className="absolute -top-8 text-yellow-500 animate-bounce">
                        <Crown size={28} />
                    </div>
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-bold text-2xl border-[4px] border-yellow-400 z-10 mb-2 shadow-lg shadow-yellow-500/30 ${isDark ? 'bg-yellow-500/20 text-yellow-500' : 'bg-yellow-100 text-yellow-600'}`}>
                        {top3[0] ? getInitials(top3[0].full_name) : '?'}
                    </div>
                    <div className={`w-24 md:w-32 h-36 bg-gradient-to-t rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x shadow-2xl ${isDark ? 'from-yellow-900/30 to-amber-500/10 border-yellow-300/50' : 'from-yellow-100 to-amber-50 border-yellow-300/50'}`}>
                        <span className={`font-bold text-lg ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>#1</span>
                        <span className={`text-xs font-black ${textStyle}`}>{top3[0]?.total_points || 0} pts</span>
                    </div>
                </motion.div>

                {/* 3rd Place */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="flex flex-col items-center relative z-10"
                >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-xl border-[3px] z-10 mb-2 ${isDark ? 'bg-amber-900/30 text-amber-500 border-amber-600/50' : 'bg-amber-100 text-amber-700 border-amber-600/50'}`}>
                        {top3[2] ? getInitials(top3[2].full_name) : '?'}
                    </div>
                    <div className={`w-20 md:w-28 h-24 bg-gradient-to-t to-transparent rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x ${isDark ? 'from-amber-900/10 border-amber-600/30' : 'from-amber-50 border-amber-600/30'}`}>
                        <span className={`font-bold ${isDark ? 'text-amber-500/70' : 'text-amber-700/70'}`}>#3</span>
                        <span className={`text-[10px] font-black ${textStyle}`}>{top3[2]?.total_points || 0} pts</span>
                    </div>
                </motion.div>
            </div>

            {/* Leaderboard List */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`rounded-[32px] overflow-hidden border backdrop-blur-md shadow-xl ${cardBg}`}
            >
                {/* List Header */}
                <div className={`flex items-center px-6 py-4 border-b ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-gray-200'}`}>
                    <div className="w-12 text-center text-xs font-bold uppercase tracking-widest opacity-50">Rank</div>
                    <div className="flex-1 text-xs font-bold uppercase tracking-widest opacity-50 px-4">Contributor</div>
                    <div className="w-24 text-right text-xs font-bold uppercase tracking-widest opacity-50">Points</div>
                </div>

                {/* List Items */}
                <div className={`flex flex-col divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
                    {restOfList.map((entry, idx) => (
                        <div key={entry.profile_id} className={`flex items-center px-6 py-4 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                            <div className="w-12 flex justify-center">{getRankIcon(idx + 4)}</div>
                            <div className="flex-1 px-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {getInitials(entry.full_name)}
                                </div>
                                <div>
                                    <h4 className={`font-bold ${textStyle}`}>{entry.full_name}</h4>
                                    <p className="text-xs text-slate-400">{entry.visits_count || 0} visits · {entry.reviews_count || 0} reviews</p>
                                </div>
                            </div>
                            <div className="w-24 text-right font-black text-amber-500">{entry.total_points}</div>
                        </div>
                    ))}

                    {/* Show user row if logged in and not already in the displayed list */}
                    {isLoggedIn && !userInTop && userRank && userRank.rank > 0 && (
                        <>
                            {/* Divider indicating gap to current user */}
                            <div className={`h-12 flex items-center justify-center ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50/50'}`}>
                                <div className="flex gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[hsl(220,20%,12%)]' : 'bg-slate-300'}`} />
                                    <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[hsl(220,20%,12%)]' : 'bg-slate-300'}`} />
                                    <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[hsl(220,20%,12%)]' : 'bg-slate-300'}`} />
                                </div>
                            </div>

                            {/* Current User Row */}
                            <div className={`flex items-center px-6 py-4 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'} border-y border-indigo-500/20`}>
                                <div className="w-12 flex justify-center">{getRankIcon(userRank.rank)}</div>
                                <div className="flex-1 px-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                        {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${textStyle}`}>{user?.full_name || 'You'}</h4>
                                        <p className={`text-xs font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>Rank #{userRank.rank}</p>
                                    </div>
                                </div>
                                <div className="w-24 text-right font-black text-amber-500">{userRank.points}</div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </PageTransition>
    )
}

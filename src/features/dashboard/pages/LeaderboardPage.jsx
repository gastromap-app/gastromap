import React from 'react'
import { motion } from 'framer-motion'
import { Trophy, Star, TrendingUp, Medal, Crown } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { PageTransition } from '@/components/ui/PageTransition'

const mockLeaderboard = [
    { rank: 1, name: 'Elena R.', points: 1450, level: 'Local Legend', avatar: 'E' },
    { rank: 2, name: 'Alex J.', points: 1200, level: 'Foodie Guide', avatar: 'A' },
    { rank: 3, name: 'Sara K.', points: 950, level: 'Explorer', avatar: 'S' },
    { rank: 4, name: 'Mike T.', points: 820, level: 'Taster', avatar: 'M' },
    { rank: 5, name: 'Jane D.', points: 650, level: 'Novice', avatar: 'J' },
    // Simulate user somewhere in middle
    { rank: 24, name: 'You', points: 300, level: 'Beginner', avatar: 'Me', isUser: true }
]

export default function LeaderboardPage() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <Crown size={20} className="text-yellow-500" />
            case 2: return <Medal size={20} className="text-slate-400" />
            case 3: return <Medal size={20} className="text-amber-600" />
            default: return <span className={`font-black text-lg ${subTextStyle}`}>#{rank}</span>
        }
    }

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
                    GastroMap <span className="text-amber-500">Top Guides</span>
                </h1>
                <p className={`text-lg max-w-xl mx-auto ${subTextStyle}`}>
                    Climb the ranks by adding incredible places and writing helpful reviews. Top guides get exclusive rewards!
                </p>
            </motion.div>

            {/* Top 3 Podium (Visual Flare) */}
            <div className="flex items-end justify-center gap-2 md:gap-4 mb-12 h-48">
                {/* 2nd Place */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col items-center relative z-10"
                >
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xl border-[3px] border-slate-300 dark:border-slate-500 z-10 mb-2">
                        {mockLeaderboard[1].avatar}
                    </div>
                    <div className="w-20 md:w-28 h-28 bg-gradient-to-t from-slate-200 dark:from-slate-800 to-slate-100 dark:to-slate-700 rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x border-slate-300/50">
                        <span className="font-bold text-slate-500">#2</span>
                        <span className="text-[10px] font-black">{mockLeaderboard[1].points} pts</span>
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
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center font-bold text-2xl text-yellow-600 dark:text-yellow-500 border-[4px] border-yellow-400 z-10 mb-2 shadow-lg shadow-yellow-500/30">
                        {mockLeaderboard[0].avatar}
                    </div>
                    <div className="w-24 md:w-32 h-36 bg-gradient-to-t from-yellow-100 dark:from-yellow-900/30 to-amber-50 dark:to-amber-500/10 rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x border-yellow-300/50 shadow-2xl">
                        <span className="font-bold text-amber-600 dark:text-amber-500 text-lg">#1</span>
                        <span className="text-xs font-black">{mockLeaderboard[0].points} pts</span>
                    </div>
                </motion.div>

                {/* 3rd Place */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="flex flex-col items-center relative z-10"
                >
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-xl text-amber-700 dark:text-amber-500 border-[3px] border-amber-600/50 z-10 mb-2">
                        {mockLeaderboard[2].avatar}
                    </div>
                    <div className="w-20 md:w-28 h-24 bg-gradient-to-t from-amber-50 dark:from-amber-900/10 to-transparent rounded-t-xl flex flex-col items-center justify-start pt-4 border-t border-x border-amber-600/30">
                        <span className="font-bold text-amber-700/70 dark:text-amber-500/70">#3</span>
                        <span className="text-[10px] font-black">{mockLeaderboard[2].points} pts</span>
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
                <div className="flex items-center px-6 py-4 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
                    <div className="w-12 text-center text-xs font-bold uppercase tracking-widest opacity-50">Rank</div>
                    <div className="flex-1 text-xs font-bold uppercase tracking-widest opacity-50 px-4">Guide</div>
                    <div className="w-24 text-right text-xs font-bold uppercase tracking-widest opacity-50">Points</div>
                </div>

                {/* List Items */}
                <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                    {mockLeaderboard.slice(3, 5).map((user, idx) => (
                        <div key={user.rank} className="flex items-center px-6 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <div className="w-12 flex justify-center">{getRankIcon(user.rank)}</div>
                            <div className="flex-1 px-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                    {user.avatar}
                                </div>
                                <div>
                                    <h4 className={`font-bold ${textStyle}`}>{user.name}</h4>
                                    <p className="text-xs text-slate-400">{user.level}</p>
                                </div>
                            </div>
                            <div className="w-24 text-right font-black text-amber-500">{user.points}</div>
                        </div>
                    ))}

                    {/* Divider indicating gap to current user if user is far down */}
                    <div className="h-12 flex items-center justify-center bg-black/[0.02] dark:bg-white/[0.02]">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                        </div>
                    </div>

                    {/* Current User Row */}
                    <div className={`flex items-center px-6 py-4 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'} border-y border-indigo-500/20`}>
                        <div className="w-12 flex justify-center">{getRankIcon(mockLeaderboard[5].rank)}</div>
                        <div className="flex-1 px-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                {mockLeaderboard[5].avatar}
                            </div>
                            <div>
                                <h4 className={`font-bold ${textStyle}`}>{mockLeaderboard[5].name}</h4>
                                <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">{mockLeaderboard[5].level}</p>
                            </div>
                        </div>
                        <div className="w-24 text-right font-black text-amber-500">{mockLeaderboard[5].points}</div>
                    </div>
                </div>
            </motion.div>
        </PageTransition>
    )
}

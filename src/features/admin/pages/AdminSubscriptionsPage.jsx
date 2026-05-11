import React from 'react'
import {
    Heart, ArrowUpRight, TrendingUp,
    Users, Calendar, Download, Filter, Search,
    Coffee, Star, Gift
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AdminPageHeader, { adminBtnSecondary } from '../components/AdminPageHeader'
import { usePaymentStats } from '@/shared/api/queries'

const AdminSubscriptionsPage = () => {
    const [searchQuery, setSearchQuery] = React.useState('')
    const { data: payments = {}, isLoading: loadingPayments } = usePaymentStats()

    const allTransactions = payments?.recent_transactions || [
        { user: 'Alex Johnson', plan: 'Supporter Monthly', date: 'Today, 14:20', amount: '$5.00', status: 'Success' },
        { user: 'Maria Peters', plan: 'Coffee', date: 'Today, 11:05', amount: '$3.00', status: 'Success' },
        { user: 'Dmitri S.', plan: 'Champion', date: 'Yesterday, 19:45', amount: '$25.00', status: 'Pending' },
    ]

    const transactions = searchQuery.trim()
        ? allTransactions.filter(tx =>
            tx.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.plan.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : allTransactions

    if (loadingPayments) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-slate-500 dark:text-[hsl(220,10%,55%)] font-medium text-lg">Loading...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 lg:space-y-10 pb-12 font-sans">
            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title="Donations"
                subtitle="Monitor donations and community support."
                actions={
                    <button
                        onClick={() => {
                            const esc = (val) => String(val ?? '').replace(/"/g, '""')
                            const csv = ['User,Plan,Date,Amount,Status', ...allTransactions.map(t =>
                                `"${esc(t.user)}","${esc(t.plan)}","${esc(t.date)}","${esc(t.amount)}","${esc(t.status)}"`
                            )].join('\n')
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url; a.download = 'donations-report.csv'; a.click()
                            URL.revokeObjectURL(url)
                        }}
                        className={adminBtnSecondary}
                    >
                        <Download size={13} /> Export CSV
                    </button>
                }
            />

            {/* Donation History */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="p-4 lg:p-10 border-b border-slate-50 dark:border-white/[0.03] flex flex-col lg:flex-row justify-between items-center gap-6">
                    <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white pl-2 leading-none">Donation History</h2>
                    <div className="flex gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-72 leading-none group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search donations..."
                                aria-label="Search donations"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[hsl(220,20%,3%)]/30 border-none rounded-2xl text-[12px] font-medium outline-none focus:ring-2 ring-indigo-500/10 shadow-inner"
                            />
                        </div>
                        <button aria-label="Filter donations" className="p-2.5 dark:bg-[hsl(220,20%,9%)] rounded-2xl text-slate-400 hover:text-indigo-500 transition-all font-black leading-none"><Filter size={18} /></button>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar font-black leading-none">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-[hsl(220,20%,6%)]/50">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest pl-10 lg:pl-12">Donor</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Tier</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {transactions.map((tx, i) => (
                                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-[hsl(220,20%,12%)]/40 transition-all border-none leading-none">
                                    <td className="px-6 py-5 pl-10 lg:pl-12 font-bold text-[13px] text-slate-900 dark:text-white truncate leading-tight">{tx.user}</td>
                                    <td className="px-6 py-5">
                                        <Badge variant="outline" className="bg-transparent border border-slate-100 dark:border-white/[0.03] text-slate-400 font-bold text-[9px] px-2 py-0.5 rounded-lg uppercase tracking-wider">{tx.plan}</Badge>
                                    </td>
                                    <td className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate leading-none">{tx.date}</td>
                                    <td className="px-6 py-5 text-sm lg:text-lg font-bold text-slate-900 dark:text-white tracking-tighter leading-none">{tx.amount}</td>
                                    <td className="px-6 py-5">
                                        <div className={cn(
                                            "inline-flex items-center p-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                                            tx.status === 'Success' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 px-3' : 'bg-orange-50 text-orange-600 px-3'
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full mr-2", tx.status === 'Success' ? 'bg-green-500' : 'bg-orange-500')} />
                                            {tx.status}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default AdminSubscriptionsPage

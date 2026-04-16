import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, User, Mail, UserCircle, Save, Utensils, Sparkles, Heart } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '../../auth/hooks/useAuthStore'
import { useTranslation } from 'react-i18next'
import { useUserPreferences, useUpdatePreferencesMutation } from '@/shared/api/queries'

const ProfileEditPage = () => {
    const { t } = useTranslation()
    const { user: authUser, updateUserProfile } = useAuthStore()
    const { data: preferences = {}, isLoading: loadingPrefs } = useUserPreferences(authUser?.id)
    const updatePrefs = useUpdatePreferencesMutation()

    const user = authUser || {
        name: 'Alex Johnson',
        email: 'alex@gastromap.com',
        preferences: {
            longTerm: {
                favoriteCuisines: ['Israeli', 'Modern Polish', 'Coffee'],
                atmospherePreference: ['cozy', 'modern', 'quiet'],
                features: ['wifi', 'pet-friendly']
            }
        }
    }

    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: user.name,
        email: user.email,
        bio: user.bio || 'Food enthusiast traveling the world for the best flavors.',
        preferences: user.preferences || {
            longTerm: {
                atmospherePreference: '',
                features: '',
                foodieDNA: ''
            }
        }
    })

    // Initialize form from Supabase preferences when loaded
    useEffect(() => {
        if (!loadingPrefs && preferences && Object.keys(preferences).length > 0) {
            setFormData((prev) => ({
                ...prev,
                preferences: {
                    ...prev.preferences,
                    longTerm: {
                        ...prev.preferences?.longTerm,
                        ...preferences.longTerm
                    }
                }
            }))
        }
    }, [preferences, loadingPrefs])

    const textStyle = isDark ? "text-white" : "text-gray-900"
    const subTextStyle = isDark ? "text-gray-400" : "text-gray-500"
    const cardBg = isDark ? "bg-[#1f2128]/80 border-white/5" : "bg-white border-gray-100"
    const inputBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"

    const handleSave = async () => {
        // Existing local update
        await updateUserProfile({ name: formData.name, avatar: formData.avatar })
        // Sync to Supabase
        if (authUser?.id) {
            await updatePrefs.mutateAsync({ userId: authUser.id, preferences: formData.preferences })
        }
        navigate('/profile')
    }


    return (
        <div className="w-full min-h-screen relative z-10 pb-32">
            {/* Header */}
            <div className="pt-24 px-6 mb-8 flex items-center gap-4">
                <button
                    onClick={() => navigate('/profile')}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className={`text-2xl font-black ${textStyle}`}>{t('profile_edit.title')}</h1>
            </div>

            {loadingPrefs ? (
                <div className="flex items-center justify-center py-20">
                    <div className={`text-sm font-bold ${subTextStyle}`}>Loading preferences...</div>
                </div>
            ) : (
            <div className="px-5 space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                            {formData.name.charAt(0)}
                        </div>
                        <button className="absolute -bottom-1 -right-1 bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg border-[4px] border-[#0F1115] hover:scale-105 transition-transform">
                            <Camera size={18} />
                        </button>
                    </div>
                </div>

                {/* Basic Info */}
                <div className={`p-6 rounded-[32px] border ${cardBg} space-y-5`}>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest ml-2 mb-2 ${subTextStyle}`}>{t('profile_edit.basic_info')}</h3>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase tracking-tight ml-2 ${subTextStyle}`}>{t('profile_edit.full_name')}</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-bold outline-none border transition-all focus:border-blue-500 ${inputBg} ${textStyle}`}
                                placeholder={t('profile_edit.name_placeholder')}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase tracking-tight ml-2 ${subTextStyle}`}>{t('profile_edit.email')}</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-bold outline-none border transition-all focus:border-blue-500 ${inputBg} ${textStyle}`}
                                placeholder={t('profile_edit.email_placeholder')}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase tracking-tight ml-2 ${subTextStyle}`}>{t('profile_edit.bio')}</label>
                        <textarea
                            value={formData.bio}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            className={`w-full p-4 rounded-2xl text-sm font-bold outline-none border transition-all focus:border-blue-500 h-24 resize-none ${inputBg} ${textStyle}`}
                            placeholder={t('profile_edit.bio_placeholder')}
                        />
                    </div>
                </div>

                {/* Taste Profile Editor */}
                <div className={`p-6 rounded-[32px] border ${cardBg} space-y-6`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={16} className="text-yellow-500" />
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${subTextStyle}`}>{t('profile_edit.taste_dna')}</h3>
                    </div>

                    {/* Foodie DNA Input */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile_edit.dna_label')}</label>
                            <p className={`text-[10px] font-medium ml-1 opacity-50 ${textStyle}`}>{t('profile_edit.dna_hint')}</p>
                        </div>
                        <div className="relative group">
                            <div className="absolute top-4 left-4 text-blue-500 opacity-50 group-focus-within:opacity-100 transition-opacity">
                                <Sparkles size={18} />
                            </div>
                            <textarea
                                value={formData.preferences?.longTerm?.foodieDNA || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    preferences: {
                                        ...formData.preferences,
                                        longTerm: {
                                            ...formData.preferences.longTerm,
                                            foodieDNA: e.target.value
                                        }
                                    }
                                })}
                                className={`w-full pl-12 pr-4 py-4 rounded-[24px] text-sm font-bold outline-none border transition-all focus:border-blue-500 h-32 resize-none ${inputBg} ${textStyle}`}
                                placeholder={t('profile_edit.dna_placeholder')}
                            />
                        </div>
                    </div>

                    {/* Atmosphere Editor */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile_edit.atm_label')}</label>
                            <p className={`text-[10px] font-medium ml-1 opacity-50 ${textStyle}`}>{t('profile_edit.atm_hint')}</p>
                        </div>
                        <textarea
                            value={formData.preferences?.longTerm?.atmospherePreference || ''}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    longTerm: {
                                        ...formData.preferences.longTerm,
                                        atmospherePreference: e.target.value
                                    }
                                }
                            })}
                            className={`w-full p-4 rounded-[24px] text-sm font-bold outline-none border transition-all focus:border-blue-500 h-24 resize-none ${inputBg} ${textStyle}`}
                            placeholder={t('profile_edit.atm_placeholder')}
                        />
                    </div>

                    {/* Features Editor */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className={`text-[10px] font-black uppercase tracking-widest opacity-40 ml-1 ${textStyle}`}>{t('profile_edit.features_label')}</label>
                            <p className={`text-[10px] font-medium ml-1 opacity-50 ${textStyle}`}>{t('profile_edit.features_hint')}</p>
                        </div>
                        <textarea
                            value={formData.preferences?.longTerm?.features || ''}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    longTerm: {
                                        ...formData.preferences.longTerm,
                                        features: e.target.value
                                    }
                                }
                            })}
                            className={`w-full p-4 rounded-[24px] text-sm font-bold outline-none border transition-all focus:border-blue-500 h-24 resize-none ${inputBg} ${textStyle}`}
                            placeholder={t('profile_edit.features_placeholder')}
                        />
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full py-4 rounded-[24px] bg-blue-600 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                    <Save size={18} />
                    {t('profile_edit.save')}
                </button>
            </div>
            )}
        </div>
    )
}

export default ProfileEditPage

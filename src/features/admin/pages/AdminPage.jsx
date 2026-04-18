import React from 'react'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useLocations } from '@/shared/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { Edit, Trash } from 'lucide-react'

export default function AdminPage() {
    const { user, logout } = useAuthStore()
    const { data: locations = [] } = useLocations()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    if (!user || user.role !== 'admin') {
        return <div className="p-8 text-destructive">Access Denied. Admins only.</div>
    }

    return (
        <div className="container p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Admin Panel</h1>
                <div className="flex gap-2">
                    <Button onClick={() => alert('Feature coming soon')}>Add Location</Button>
                    <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Locations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="h-10 px-4 text-left font-medium">Title</th>
                                    <th className="h-10 px-4 text-left font-medium">Category</th>
                                    <th className="h-10 px-4 text-left font-medium">Rating</th>
                                    <th className="h-10 px-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((loc) => (
                                    <tr key={loc.id} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="p-4 font-medium">{loc.title}</td>
                                        <td className="p-4">{loc.category}</td>
                                        <td className="p-4">{loc.rating}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

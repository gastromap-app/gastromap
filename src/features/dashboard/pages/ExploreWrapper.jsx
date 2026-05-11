import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
// eslint-disable-next-line no-restricted-imports
import LocationsPage from '@/features/public/pages/LocationsPage'
import CitiesPage from './CitiesPage'
import CountriesPage from './CountriesPage'

const ExploreWrapper = () => {
    const { country, city } = useParams()
    const [searchParams] = useSearchParams()
    const sortParam = searchParams.get('sort')

    // If we have a sort parameter but no city, redirect to LocationsPage
    // (filters/sort should work on the full location list)
    if (sortParam && !city) {
        return <LocationsPage />
    }

    // If no country param, show list of countries
    if (!country) {
        return <CountriesPage />
    }

    // If we have a country but no specific city, show the list of cities
    if (country && !city) {
        return <CitiesPage />
    }

    // If we have a city, show locations (LocationsPage handles its own mobile/desktop view)
    return <LocationsPage />
}

export default ExploreWrapper

import React from 'react'
import { useParams } from 'react-router-dom'
import LocationsPage from '@/features/public/pages/LocationsPage'
import CitiesPage from './CitiesPage'
import CountriesPage from './CountriesPage'

const ExploreWrapper = () => {
    const { country, city } = useParams()

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

import { useEffect, useState } from 'react'
import PropertyCard from './components/PropertyCard'

const aemOrigin = (import.meta.env.VITE_AEM_ORIGIN || 'http://localhost:4502').replace(/\/$/, '')
const propertiesUrl = `${aemOrigin}/graphql/execute.json/propertyfinder/properties-list`

function App() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    fetch(propertiesUrl, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .catch((error) => {
        if (error.name === 'AbortError') throw error
        throw new Error(
          `Cannot connect to AEM at ${aemOrigin}. Check that AEM is running and this URL opens in your browser. If AEM is reachable, check its CORS policy for ${window.location.origin}.`,
        )
      })
      .then((response) => {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`AEM access denied. Sign in at ${aemOrigin} and reload this page. If access is still denied, check the user's query and content permissions.`)
        }

        if (response.status === 404) {
          throw new Error('AEM query not found. Check that the persisted query propertyfinder/properties-list exists on this AEM instance.')
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch properties (HTTP ${response.status})`)
        }

        if (!response.headers.get('content-type')?.includes('application/json')) {
          throw new Error(`AEM returned a non-JSON response. Sign in at ${aemOrigin} and check the persisted query URL: ${propertiesUrl}`)
        }

        return response.json()
      })
      .then((data) => {
        if (data.errors?.length) {
          throw new Error(`AEM GraphQL error: ${data.errors.map((error) => error.message).join('; ')}`)
        }

        const items = data.data?.propertyList?.items
        if (!Array.isArray(items)) {
          throw new Error('Unexpected AEM response: the query must return data.propertyList.items.')
        }

        if (!controller.signal.aborted) setProperties(items)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error(error)
        setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  if (loading) {
    return <p>Loading properties...</p>
  }

  if (error) {
    return <p role="alert">{error}</p>
  }

  return (
    <div>
      <h1>Property Finder</h1>

      {properties.length === 0 && <p>No properties found.</p>}

      {properties.map((property) => (
        <PropertyCard
          key={property._path}
          title={property.title}
          price={property.price}
          location={property.location}
          bedrooms={property.bedrooms}
          bathrooms={property.bathrooms}
          propertyType={property.propertyType}
          description={property.description?.plaintext}
          featured={property.featured}
        />
      ))}
    </div>
  )
}

export default App

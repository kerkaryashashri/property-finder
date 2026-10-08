function PropertyCard({ title, price, location, bedrooms, bathrooms, propertyType, description, featured }) {
  return (
    <div>
      <h2>{title}</h2>
      {featured === true && <p><strong>Featured Property</strong></p>}
      <p>£{price.toLocaleString()}</p>
      <p>{location}</p>
      {propertyType && <p>Property Type: {propertyType}</p>}
      {bedrooms != null && <p>Bedrooms: {bedrooms}</p>}
      {bathrooms != null && <p>Bathrooms: {bathrooms}</p>}
      {description && <p>{description}</p>}
    </div>
  )
}

export default PropertyCard

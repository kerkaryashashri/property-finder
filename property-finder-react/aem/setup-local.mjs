import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Local Author only. Credentials remain in Node, never in the React bundle.
const origin = 'http://localhost:4502'
const config = '/conf/propertyfinder'
const modelPath = `${config}/settings/dam/cfm/models/property`
const folderPath = '/content/dam/propertyfinder/properties'
const endpointPath = '/content/cq:graphql/propertyfinder/endpoint'
const queryPath = '/graphql/execute.json/propertyfinder/properties-list'
const apply = process.argv.includes('--apply')
const updateDetails = process.argv.includes('--update-details')
const pom = await readFile(new URL('../../property-finder-aem/pom.xml', import.meta.url), 'utf8')
const user = process.env.AEM_USERNAME || pom.match(/<vault.user>([^<]+)<\/vault.user>/)?.[1]
const password = process.env.AEM_PASSWORD || pom.match(/<vault.password>([^<]+)<\/vault.password>/)?.[1]
assert(user && password, 'Set AEM_USERNAME and AEM_PASSWORD for local Author.')
const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
let csrf

async function request(path, options = {}) {
  return fetch(origin + path, {
    ...options, redirect: 'error',
    headers: { Authorization: auth, ...(csrf ? { 'CSRF-Token': csrf } : {}), ...options.headers },
    signal: AbortSignal.timeout(30000),
  })
}

async function checked(path, options = {}) {
  const response = await request(path, options)
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`)
  return response
}

async function exists(path) {
  // Inspect the parent: endpoint.json executes GraphQL instead of reading a node.
  const split = path.lastIndexOf('/')
  const response = await request(`${path.slice(0, split)}.1.json`)
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`Cannot inspect ${path}: HTTP ${response.status}`)
  return Object.hasOwn(await response.json(), path.slice(split + 1))
}

async function createNode(path, content) {
  if (await exists(path)) { console.log(`Keep existing: ${path}`); return }
  console.log(`${apply ? 'Create' : 'Would create'}: ${path}`)
  if (!apply) return
  const split = path.lastIndexOf('/')
  await checked(path.slice(0, split), {
    method: 'POST', body: new URLSearchParams({
      ':operation': 'import', ':contentType': 'json', ':name': path.slice(split + 1),
      ':replace': 'false', ':replaceProperties': 'false', ':content': JSON.stringify(content),
    }),
  })
}

function field(name, label, order, numeric = false) {
  return {
    'jcr:primaryType': 'nt:unstructured',
    'sling:resourceType': `granite/ui/components/coral/foundation/form/${numeric ? 'numberfield' : 'textfield'}`,
    name, fieldLabel: label, listOrder: String(order), required: 'on',
    metaType: numeric ? 'number' : 'text-single', valueType: numeric ? 'double' : 'string',
    renderReadOnly: 'false', showEmptyInReadOnly: 'true',
    ...(numeric ? { typeHint: 'double', step: 'any', min: '0' } : { maxlength: '255' }),
    'granite:data': { 'jcr:primaryType': 'nt:unstructured' },
  }
}

// Optional fields keep existing fragments valid when extending the model.
const detailFields = {
  bedrooms: { ...field('bedrooms', 'Bedrooms', 4, true), required: 'false', valueType: 'long', typeHint: 'long', step: '1' },
  bathrooms: { ...field('bathrooms', 'Bathrooms', 5, true), required: 'false', valueType: 'long', typeHint: 'long', step: '1' },
  propertyType: { ...field('propertyType', 'Property Type', 6), required: 'false' },
  description: {
    'jcr:primaryType': 'nt:unstructured',
    'sling:resourceType': 'dam/cfm/admin/components/authoring/contenteditor/multieditor',
    name: 'description', 'cfm-element': 'Description', fieldLabel: 'Description',
    listOrder: '7', metaType: 'text-multi', valueType: 'string',
    'default-mime-type': 'text/plain', renderReadOnly: 'false', showEmptyInReadOnly: 'true',
  },
  featured: {
    'jcr:primaryType': 'nt:unstructured',
    'sling:resourceType': 'granite/ui/components/coral/foundation/form/checkbox',
    name: 'featured', fieldLabel: 'Featured Property', text: 'Featured Property',
    listOrder: '8', metaType: 'boolean', valueType: 'boolean', value: 'true', uncheckedValue: 'false',
  },
}

const model = {
  'jcr:primaryType': 'cq:Template', allowedPaths: ['/content/entities(/.*)?'], ranking: 100,
  'jcr:content': {
    'jcr:primaryType': 'cq:PageContent', 'jcr:title': 'Property',
    'jcr:description': 'Property Finder details. Prices are in GBP.',
    'cq:scaffolding': `${modelPath}/jcr:content/model`,
    'cq:templateType': '/libs/settings/dam/cfm/model-types/fragment',
    'sling:resourceSuperType': 'dam/cfm/models/console/components/data/entity',
    'sling:resourceType': 'dam/cfm/models/console/components/data/entity/default', status: 'enabled',
    model: {
      'jcr:primaryType': 'cq:PageContent', 'cq:targetPath': '/content/entities',
      'sling:resourceType': 'wcm/scaffolding/components/scaffolding',
      dataTypesConfig: '/mnt/overlay/settings/dam/cfm/models/formbuilderconfig/datatypes', maxGeneratedOrder: '8',
      'cq:dialog': {
        'jcr:primaryType': 'nt:unstructured', 'sling:resourceType': 'cq/gui/components/authoring/dialog',
        content: {
          'jcr:primaryType': 'nt:unstructured', 'sling:resourceType': 'granite/ui/components/coral/foundation/fixedcolumns',
          items: { 'jcr:primaryType': 'nt:unstructured', maxGeneratedOrder: '8',
            title: field('title', 'Property title', 1), price: field('price', 'Price (GBP)', 2, true), location: field('location', 'Location', 3),
            ...detailFields,
          },
        },
      },
    },
  },
}

if (apply) csrf = (await (await checked('/libs/granite/csrf/token.json')).json()).token
await createNode(modelPath, model)
if (updateDetails) {
  const fieldsPath = `${modelPath}/jcr:content/model/cq:dialog/content/items`
  for (const [name, definition] of Object.entries(detailFields)) {
    await createNode(`${fieldsPath}/${name}`, definition)
  }
  if (apply) {
    await checked(fieldsPath, { method: 'POST', body: new URLSearchParams({ maxGeneratedOrder: '8' }) })
    await checked(`${modelPath}/jcr:content/model`, { method: 'POST', body: new URLSearchParams({ maxGeneratedOrder: '8' }) })
  }
}
await createNode(`${config}/settings/graphql`, { 'jcr:primaryType': 'nt:unstructured' })
await createNode(`${config}/settings/graphql/persistentQueries`, { 'jcr:primaryType': 'nt:unstructured' })
await createNode('/content/cq:graphql/propertyfinder', { 'jcr:primaryType': 'sling:Folder' })
await createNode(endpointPath, {
  'jcr:primaryType': 'nt:unstructured', 'jcr:title': 'Property Finder',
  'sling:resourceType': 'graphql/sites/components/endpoint',
})
await createNode(folderPath, {
  'jcr:primaryType': 'sling:OrderedFolder',
  'jcr:content': { 'jcr:primaryType': 'nt:unstructured', 'jcr:title': 'Properties', 'cq:conf': config },
})

const samples = JSON.parse(await readFile(new URL('./sample-properties.json', import.meta.url), 'utf8'))
const properties = JSON.parse(await readFile(new URL('./properties.json', import.meta.url), 'utf8'))
for (const { name, ...details } of [...samples, ...properties]) {
  if (await exists(`${folderPath}/${name}`)) { console.log(`Keep existing fragment: ${name}`); continue }
  console.log(`${apply ? 'Create' : 'Would create'} fragment: ${name}`)
  if (apply) await checked(`/api/assets/propertyfinder/properties/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: {
      'cq:model': modelPath, title: details.title,
      description: details.description || 'Fictional sample listing for local development.',
      elements: Object.fromEntries(Object.entries(details).map(([key, value]) => [key, {
        value, ...(key === 'description' ? { contentType: 'text/plain' } : {}),
      }])),
    } }),
  })
}

const query = await readFile(new URL('./properties-list.graphql', import.meta.url), 'utf8')
const queryExists = await exists(`${config}/settings/graphql/persistentQueries/properties-list`)
if (!queryExists || updateDetails) {
  console.log(`${apply ? 'Persist' : 'Would persist'} query: propertyfinder/properties-list`)
  if (apply) await checked('/graphql/persist.json/propertyfinder/properties-list', {
    method: queryExists ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: query,
  })
}

if (apply) {
  const response = await checked(queryPath, { headers: { Origin: 'http://localhost:5173' } })
  const data = await response.json()
  assert(!data.errors?.length, JSON.stringify(data.errors))
  const items = data.data?.propertyList?.items
  assert(Array.isArray(items), 'Expected data.propertyList.items')
  for (const sample of samples) {
    const item = items.find(item => item._path === `${folderPath}/${sample.name}`)
    assert(item && typeof item.title === 'string' && typeof item.price === 'number' && typeof item.location === 'string', `Missing or invalid sample: ${sample.name}`)
  }
  for (const property of properties) {
    const item = items.find(item => item._path === `${folderPath}/${property.name}`)
    assert(item, `Missing property: ${property.name}`)
    for (const [key, value] of Object.entries(property)) {
      if (key === 'name') continue
      const actual = key === 'description' ? item.description?.plaintext : item[key]
      assert.equal(actual?.toString().trim(), value.toString().trim(), `Incorrect ${key}: ${property.name}`)
    }
    assert.equal(typeof item.bedrooms, 'number')
    assert.equal(typeof item.bathrooms, 'number')
    assert.equal(typeof item.featured, 'boolean')
  }
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  console.log(`Verified: ${items.length} properties; numeric prices; credentialed CORS for http://localhost:5173`)
  console.log(JSON.stringify(items, null, 2))
} else {
  console.log('Dry run only. Use node aem/setup-local.mjs --apply to create missing resources on local Author.')
}

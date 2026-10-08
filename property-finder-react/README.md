# Property Finder React

## Local AEM connection

1. Run AEM Author at `http://localhost:4502` and sign in there in the same browser.
2. Deploy the AEM project's `ui.config` package after changing its CORS policy.
3. Run `npm run dev` and open `http://localhost:5173` (use `localhost`, not `127.0.0.1`).

The app fetches `/graphql/execute.json/propertyfinder/properties-list` from AEM
with the browser's AEM session cookie. The Author CORS policy must allow the
exact React origin, the `/graphql/execute.json/propertyfinder/.*` path, and
credentialed requests (`supportscredentials: true`). Vite uses a fixed port so
it cannot silently switch to an origin outside that policy.

A `401` or `403` response requires checking the AEM login and user permissions.
The persisted query `propertyfinder/properties-list` must also exist in AEM.

If the app cannot connect, first open
`http://localhost:4502/graphql/execute.json/propertyfinder/properties-list`
directly in your browser. A connection-refused error means AEM must be started
or the host/port corrected before checking CORS or the GraphQL query.

For an AEM instance on another host or port, copy `.env.example` to `.env.local`,
set `VITE_AEM_ORIGIN`, and restart Vite. This is a public URL; do not put passwords
or tokens in `VITE_` variables. See the [Vite environment variable documentation](https://vite.dev/guide/env-and-mode).

## Create local Property content

With local AEM Author running at `http://localhost:4502`, preview the setup:

```sh
node aem/setup-local.mjs
```

Create missing resources and verify the query and credentialed CORS:

```sh
node aem/setup-local.mjs --apply
```

The script creates an enabled **Property** model with required `title` (text),
`price` (number, GBP), and `location` (text) fields, plus optional `bedrooms` and
`bathrooms` (integers), `propertyType` (text), `description` (multiline plain text),
and `featured` (boolean). It creates three fictional sample fragments and the
Bristol listing supplied in `aem/properties.json` under
`/content/dam/propertyfinder/properties`, a project GraphQL
endpoint, and the persisted query `propertyfinder/properties-list`.
Existing resources are kept, so rerunning does not overwrite authored content.
The script uses local development credentials from the sibling AEM project's
`pom.xml`; `AEM_USERNAME` and `AEM_PASSWORD` can override them in the Node process.
Credentials are never included in React.

For an existing three-field model, add the missing detail fields and update the
persisted query to return them:

```sh
node aem/setup-local.mjs --apply --update-details
```

This keeps existing field definitions and fragments. The query returns the
multiline description as `description.plaintext`; React displays the property
details and a Featured Property label when `featured` is true. Verification
checks the Bristol listing against the supplied details in `aem/properties.json`.

Edit property details in [AEM Assets](http://localhost:4502/assets.html/content/dam/propertyfinder/properties).
Edit the model in [Content Fragment Models](http://localhost:4502/libs/dam/cfm/models/console/content/models.html/conf/propertyfinder).
View the query in [GraphiQL](http://localhost:4502/aem/graphiql.html).
The sample input is in `aem/sample-properties.json` and the query is in
`aem/properties-list.graphql`. To edit existing fragments, use AEM Assets; editing
the sample file only affects fragments that have not been created yet.

The model structure follows [Adobe's WKND Shared reference model](https://github.com/adobe/aem-guides-wknd-shared/blob/main/ui.content/src/main/content/jcr_root/conf/wknd-shared/settings/dam/cfm/models/adventure/.content.xml).
See also [Adobe's persisted query documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries).

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

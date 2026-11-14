import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

/**
 * Página embebida con la referencia interactiva de API usando Scalar.
 */
function ApiDocs() {
  return (
    <ApiReferenceReact
      configuration={{
        url: '/openapi.yaml',
      }}
    />
  )
}

export default ApiDocs

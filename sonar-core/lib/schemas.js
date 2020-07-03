exports.RESOURCE_SCHEMA = {
  name: 'resource',
  namespace: 'sonar',
  title: 'Resource',
  fields: {
    label: {
      type: 'string',
      title: 'Label'
    },
    description: {
      type: 'string',
      title: 'Description'
    },
    contentUrl: {
      type: 'string',
      format: 'uri',
      title: 'URL to file'
    },
    contentSize: {
      type: 'number',
      title: 'File size'
    },
    contentHash: {
      type: 'string',
      title: 'Content hash',
      index: {
        basic: true
      }
    },
    encodingFormat: {
      type: 'string',
      title: 'Encoding format (MIME type)',
      index: {
        basic: true,
        search: { mode: 'facet' }
      }
    },
    duration: {
      type: 'number',
      title: 'Duration in seconds'
    },
    // TODO: Define mediatype allowed options as query
    mediaType: {
      type: 'string',
      title: 'Media type',
      enum: ['audio', 'video', 'image', 'document', 'other'],
      index: {
        basic: true,
        search: { mode: 'facet' }
      }
    }
  }
}

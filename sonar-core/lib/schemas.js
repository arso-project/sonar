exports.RESOURCE_SCHEMA = {
  name: 'sonar/resource',
  title: 'Resource',
  properties: {
    label: { type: 'string', title: 'Label' },
    description: { type: 'string', title: 'Description' },
    contentUrl: { type: 'string', format: 'uri', title: 'URL to file' },
    contentSize: { type: 'number', title: 'File size' },
    contentHash: { type: 'string', title: 'Content hash', index: true },
    encodingFormat: { type: 'string', title: 'Encoding format (MIME type)', index: true },
    duration: { type: 'number', title: 'Duration in seconds' },
    // TODO: Define mediatype allowed options as query
    mediaType: { type: 'string', title: 'Media type', enum: ['audio', 'video', 'image', 'document', 'other'], index: true }
  }
}

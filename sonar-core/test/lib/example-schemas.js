module.exports = function getExampleSchemas () {
  const types = [
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "dat://unwalled.garden/bookmark.json",
      "type": "object",
      "title": "Bookmark",
      "description": "A saved/shared link to some URL.",
      "required": ["type", "href", "title", "createdAt"],
      "properties": {
        "type": {
          "type": "string",
          "description": "The object's type",
          "const": "unwalled.garden/bookmark"
        },
        "href": {
          "type": "string",
          "format": "uri",
          "maxLength": 10000
        },
        "title": {
          "type": "string",
          "maxLength": 280
        },
        "description": {
          "type": "string",
          "maxLength": 560
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 100,
            "pattern": "^[A-Za-z][A-Za-z0-9-_?]*$"
          }
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time"
        }
      }
    },    
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "dat://unwalled.garden/comment.json",
      "type": "object",
      "title": "Comment",
      "description": "A text post about some resource.",
      "required": [
        "type",
        "topic",
        "body",
        "createdAt"
      ],
      "properties": {
        "type": {
          "type": "string",
          "description": "The object's type",
          "const": "unwalled.garden/comment"
        },
        "topic": {
          "type": "string",
          "description": "What this comment is about",
          "format": "uri"
        },
        "replyTo": {
          "type": "string",
          "description": "What this comment is replying to",
          "format": "uri"
        },
        "body": {
          "type": "string",
          "description": "The post's text content"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "The time of this post's creation"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "description": "The time of this post's last edit"
        }
      }
    }]

  return types
}

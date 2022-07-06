---
title: "Tutorial: Create a book sharing app"
id: peerbooks
---

# Peerbooks Tutorial

Hi you want to know [Sonar](https://arso.xyz/sonar) then let's build a small app.

In this tutorial we will build a small app to share and manage your EBooks using Sonar and [Remix](https://remix.run/). 

So let's get started.

## Installation and preparation

First, we create a new directory for our app:

```
mkdir my-peerBooks-app
cd my-peerBooks-app
```

We clone [Sonar](https://github.com/arso-project/sonar) with:

`git clone git@github.com:arso-project/sonar.git`

and change the directory:

`cd sonar`

We install Sonar as described [here](https://github.com/arso-project/sonar#development) and start Sonar for now with authentication disabled and in Developer Mode:
```
# install dependencies of all workspaces
yarn && yarn build

# start the sonar server in dev mode
./sonar start --dev --disable authentication
```

Hooray the first step is done. You can see the `root access code` in your terminal now. We will need it again in the next steps, so you can copy it now.

We open a new terminal and change to our project directory to install Remix:
```bash=
cd /PATHTODIRECTORY/my-peerBooks-app
npx create-remix@latest
```
We give the remix app the name `peerbooks`, select `just the basics` and use the `Remix App Server` with `typescript` (optionally javascript) and allow the script to run `npm install`.

Your folder structure should now look like this:

```
my-peerBooks-app
|
|-peerbooks
|-sonar
```

## Configuration

Now we have to do some configuration foo before we can really get started.

We add the Sonar-client to the dependencies in the `Package.json` which you can find in `my-peerbooks-app/peerbooks`: `"@arsonar/client": "^0.6.0-alpha.5",`

Since we have some other dependencies in the application like the `React/Icons` and we want to be sure that you are working with the versions of the tutorial, you can copy the `package.json` here:


```json
{
  "private": true,
  "sideEffects": false,
  "scripts": {
    "build": "remix build",
    "dev": "remix dev",
    "start": "remix-serve build"
  },
   "dependencies": {
    "@arsonar/client": "^0.6.0-alpha.6",
    "@arsonar/server": "^0.6.0-alpha.6",
    "@remix-run/node": "^1.5.1",
    "@remix-run/react": "^1.5.1",
    "@remix-run/serve": "^1.5.1",
    "autoprefixer": "^10.4.7",
    "concurrently": "^7.2.2",
    "dotenv": "^16.0.1",
    "find-free-port": "^2.0.0",
    "postcss": "^8.4.14",
    "react": "^17.0.2",
    "react-dom": "^17.0.2",
    "react-icons": "^4.4.0",
    "simple-isbn": "^1.1.5",
    "tailwindcss": "^3.1.4"
  },
  "devDependencies": {
    "@remix-run/dev": "^1.5.1",
    "@remix-run/eslint-config": "^1.5.1",
    "@types/react": "^17.0.45",
    "@types/react-dom": "^17.0.17",
    "eslint": "^8.15.0",
    "typescript": "^4.6.4"
  },
  "engines": {
    "node": ">=14"
  }
}
```
After updating the `package.json` you should execute the command `yarn` in the `my-peerbookss-app/peerbooks` directory.

In the same directory we now create a file named `.env`, here we store our needed enviroment variables to have later access from our app to the Sonar server.

```env=
NODE_ENV=development
SONAR_TOKEN=TOKEN
SONAR_COLLECTION=Books
```
Please replace the `TOKEN` with your `root-access-code` from Sonar.

If you want you can customize the Remix App a bit by changing the `app/root.tsx`, but this is optional.

```javascript
import type { MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react'

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: 'Sonar | PeerBooks',
  viewport: 'width=device-width,initial-scale=1',
})

export default function App() {
  return (
    <html lang='en'>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

```

## short excursion in REMIX [OPTIONAL].

Remix is a full-stack web framework that lets you focus on the user interface and work with web standards to create a fast, elegant and stable user experience. You can find more about it in their [documentation](https://remix.run/docs/en/v1).

There are some conventions that help you to handle things like data loading in Remix and that's what we want to introduce here to give you a feel for the framework which we will then work with. 

First we impose the needed functions and create the datatypes Publisher and Author which we want as an array because there can be more than one:

```javascript
import { json, LoaderFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

interface Publisher {
  url: string
  name: string
}

interface Author {
  url: string
  name: string
}
```
To load data into Remix we can use the `LoaderFunction`, at this point we create a fake dataset and let the LoaderFunction return a JSON object with the data, which we can render with another function.

```javascript
export const loader: LoaderFunction = async () => {
  const books = [
    {
      value: {
        title: 'My first Book',
        subtitle: 'PeerBooks fakedata',
        isbn_10: '12345678980',
        isbn_13: '1234567890123',
        number_of_pages: '1',
        publishers: ['arso.xyz'],
        inLanguage: 'EN',
        authors: ['you', 'me'],
        description: 'A beatuiful Book about p2p'
      }
    }
  ]

  return json(books)
}
```
Then we write a function which uses the data provided by the LoaderFunction:

```javascript
export default function Layout () {
  const books = useLoaderData()
  return (
    <div>
      <div>
        {books.map((record: any, i: number) => {
          if (!record.value) {
            return <div>no data</div>
          }

          const title =
            record.value.title || 'No Title - ISBN: ' + record.value.isbn
          return (
            <div key={i}>
              <div>
                <div>
                  <Link to={'/book/' + record.id}>
                    <h2>{title}</h2>
                  </Link>
                  {record.value.authors &&
                    record.value.authors.map((author: Author, i: number) => {
                      return <p key={i}>Author: {author}</p>
                    })}
                  {record.value.publishers &&
                    record.value.publishers.map((publisher: Publisher) => (
                      <p>Publisher: {publisher}</p>
                    ))}

                  {record.value.isbn && <p>ISBN: {record.value.isbn_10}</p>}
                  {record.value.isbn && <p>ISBN: {record.value.isbn_13}</p>}
                  {record.value.numberOfPages && (
                    <p> Number of Pages: {record.value.numberOfPages}</p>
                  )}
                  {record.value.description && (
                    <p>{record.value.description}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```
Now you can start your Remix app server with `yarn dev` and look at your result under `localhost:3000`. 

We will use some more features of Remix, hopefully this small example helped you to get an intuition of how Remix works. As this is not a Remix tutorial we will not go too deep into the features, in some places we will explain them briefly if necessary, but if you want to learn more have a look at the [documentation](https://remix.run/docs/en/v1).

## Create a scheme

After we had roughly thought about which metadata we want to capture for our ebooks, we are now getting serious.

To create a suitable [record](https://sonar.arso.xyz/apidocs-client/classes/Record.html) for our file in Sonar we need a schema. In this [Schema](https://sonar.arso.xyz/apidocs-client/classes/Schema.html) we first have the Sonar specific fields e.g. the used `namespace` followed by the metadata for the `record`.  In the course of the tutorial we will call the API of https://openlibrary.org/. The required fields here for we have already integrated into the following schema. So you can simply create a new file in `peerbooks/app` called `schema.tsx` and copy the following code into it.

```javascript
import { TypeSpecInput } from '@arsonar/client'

type Spec = {
  defaultNamespace: string
  types: Record<string, TypeSpecInput>
}

export const schema: Spec = {
  defaultNamespace: 'sonar-peerBooks',
  types: {
    ImportedMetadata: {
      title: 'Imported metadata',
      fields: {
        sourcePlatform: {
          type: 'string',
        },
        content: {
          type: 'object',
        },
      },
    },
    Book: {
      title: 'book',
      fields: {
        title: {
          type: 'string',
        },
        subtitle: {
          type: 'string',
        },
        isbn_10: {
          type: 'string',
        },
        isbn_13: {
          type: 'string',
        },
        number_of_pages: {
          type: 'string',
        },
        excerpt: {
          type: 'string',
        },
        openlibraryId: {
          type: 'array',
        },
        publishers: {
          type: 'array',
        },
        publish_date: {
          type: 'string',
        },
        openLibraryUrl: {
          type: 'string',
        },
        inLanguage: {
          type: 'string',
        },
        genre: {
          type: 'string',
        },
        authors: {
          type: 'array',
        },
        description: {
          type: 'string',
        },
        coverImageUrl: {
          type: 'string',
        },
      },
    },
  },
}

```

## Sonar Client
Yeah you have created your first schema for Sonar but what's next? 

In this step we define our Sonar client which will use the schema to create a corresponding [Collection](https://sonar.arso.xyz/apidocs-client/classes/Collection.html), furthermore it contains some functions which will make our life easier in the following. But now step by step.

We need a new file in `peerbooks/app` with the name `sonar.server.tsx`, don't get confused here the `.server` only tells Remix that this code will definitely only be executed server side and never client side.

First we import the [`workspace`](https://sonar.arso.xyz/apidocs-client/classes/Workspace.html) and the type `collection` from the `sonar client`, further we need our `schema` and the `dotenv` file :

```javascript
import { Workspace } from '@arsonar/client'
import type { Collection } from '@arsonar/client'
import Dotenv from 'dotenv'
import { schema } from './schema'
```
We call the .env file and create the following constants:
```javascript
Dotenv.config()

const url = process.env.SONAR_URL || 'http://localhost:9191/api/v1/default'
const token = process.env.SONAR_TOKEN

```
This is needed for the app to connect to the Sonar server.

After we can theoretically connect to Sonar, the next action would be to create a new `workspace` and a `collection` in the workspace. So let's do that:

```javascript
// Initializing a client
export const workspace = new Workspace({
  url,
  accessCode: token,
})

export default workspace

```
Next we get the `collectionName` from our environment variables:
```javascript
let collection: Collection | undefined
export const collectionName = process.env.SONAR_COLLECTION || 'default'
```
We write the code to open or create a collection. We check if a collection exists, if not we try to open the collection with our `collectionName`, if there is an error we create a new collection with our collectionName. Then we check if there is a schema with our schemaname in the now surely existing collection, if not we create it.
```javascript
async function ensureSchema(collection: Collection) {
  collection.schema!.setDefaultNamespace(schema.defaultNamespace)
  for (const [name, type] of Object.entries(schema.types)) {
    if (!collection.schema!.hasType(name)) {
      const spec = { name, ...type }
      await collection.putType(spec)
      console.log('created type', name)
    }
  }
}

export async function openCollection(): Promise<Collection> {
  if (!collection) {
    try {
      collection = await workspace.openCollection(collectionName)
    } catch (err: any) {
      collection = await workspace.createCollection(collectionName)
    }
    await ensureSchema(collection)
  }
  return collection
}
```
So that we can create a new record later without big trouble we define the following function here we use the data types defined in the schema:

```javascript
export async function createBookRecord(data: typeof schema.types.Book.fields) {
  const collection = await openCollection()
  const record = await collection.put({
    type: 'Book',
    value: data,
  })
  return record
}
```
As you can see we open the collection with `openCollection()` which should be created correctly and including the schema at this point and then we pass our data to the collection using `collection.put`.

Since we don't want to store only the information about our EBooks in Sonar we have to handle the upload of the file later:

```javascript
export async function uploadFileToSonar({
  contentType,
  data,
  filename,
}: uploadFileToSonarProps) {
  const collection = await openCollection()
  let fileRecord
  try {
    fileRecord = await collection.files.createFile(data, {
      filename,
      contentType,
    })
  } catch (err: any) {
    return { error: err }
  }
  return fileRecord.id
}

```
Again, we first open the collection. Sonar can also simply accept [files](https://sonar.arso.xyz/apidocs-client/classes/Files.html) and not only schemas with the call `collection.files.createFile()`. And don't forget the interfaces for the type decleration:

```javascript
interface uploadFileToSonarProps {
  contentType: string
  data: AsyncIterable<Uint8Array>
  filename: string | undefined
}
```
Overall, your sonar client should now look like this:
```javascript
import { Workspace } from '@arsonar/client'
import type { Collection } from '@arsonar/client'
import Dotenv from 'dotenv'
import { schema } from './schema'

Dotenv.config()

const url = process.env.SONAR_URL || 'http://localhost:9191/api/v1/default'
const token = process.env.SONAR_TOKEN

// Initializing a client
export const workspace = new Workspace({
  url,
  accessCode: token,
})

export default workspace

let collection: Collection | undefined

export const collectionName = process.env.SONAR_COLLECTION || 'default'

async function ensureSchema(collection: Collection) {
  collection.schema!.setDefaultNamespace(schema.defaultNamespace)
  for (const [name, type] of Object.entries(schema.types)) {
    if (!collection.schema!.hasType(name)) {
      const spec = { name, ...type }
      await collection.putType(spec)
      console.log('created type', name)
    }
  }
}

export async function openCollection(): Promise<Collection> {
  if (!collection) {
    try {
      collection = await workspace.openCollection(collectionName)
    } catch (err: any) {
      collection = await workspace.createCollection(collectionName)
    }
    await ensureSchema(collection)
  }
  return collection
}

export async function createBookRecord(data: typeof schema.types.Book.fields) {
  const collection = await openCollection()
  const record = await collection.put({
    type: 'Book',
    value: data,
  })
  return record
}

interface uploadFileToSonarProps {
  contentType: string
  data: AsyncIterable<Uint8Array>
  filename: string | undefined
}

export async function uploadFileToSonar({
  contentType,
  data,
  filename,
}: uploadFileToSonarProps) {
  const collection = await openCollection()
  let fileRecord
  try {
    fileRecord = await collection.files.createFile(data, {
      filename,
      contentType,
    })
  } catch (err: any) {
    return { error: err }
  }
  return fileRecord.id
}
```
## Styling

Before we continue with our app we want to include a CSS framework to not have to concentrate too much on the styling. 

For the styling we use [Tailwind](https://tailwindcss.com/) there are only a few steps necessary to use Tailwind with Remix, a detailed tutorial can be found at: https://tailwindcss.com/docs/guides/remix

In the `my-peerbooks-app/peerbooks` directory we install Tailwind
```bash=
yarn add tailwindcss postcss autoprefixer concurrently
npx tailwindcss init
```
We configure our template path in tailwind.config.js
```javascript
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

After that we update the `package.json`

```json=
  "scripts": {
    "build": "npm run build:css && remix build",
    "build:css": "tailwindcss -m -i ./styles/app.css -o app/styles/app.css",
    "dev": "concurrently \"npm run dev:css\" \"remix dev\"",
    "dev:css": "tailwindcss -w -i ./styles/app.css -o app/styles/app.css"
  }
```

We Create `./app/styles/app.css`

```css=
@tailwind base;
@tailwind components;
@tailwind utilities;
```

We import Tailwind into our `root.tsx`

```javascript
import styles from "./styles/app.css"

export function links() {
  return [{ rel: "stylesheet", href: styles }]
}
```
Finally, we start the build process and can make use of tailwind.

```bash=
yarn dev
```

## Projectstructure and file upload

Now that we are familiar with the basics, we will redesign our project structure. We want to be able to create our records with a form later on and include them as dynamic segments in our app.

### __layout

We create a directory `/app/routes/__layout` in which we move our `index.tsx` and a new file `/app/routes/__layout`. Don't forget the two underscores, this is a Remix feature, it ensures that our URL is not assigned an extra path segment, furthermore the route file is automatically assigned the appropriate folder.

So that our `index.tsx` can be rendered again we have to add it as `outlet` to our `layout.tsx`. The `<outlet/>` renders the childroutes into our `__layout` route.

```javascript
import { Outlet } from '@remix-run/react'

export default function Layout () {
  return (
    <div>
      <h1>PeerBooks</h1>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
```

## Add EBooks to the library

Ok so far so good but how do we get our EBooks into Sonar?

In the next steps we will make sure that we select a file, enrich it with metadata and store it in Sonar.

That's not so hard and since we are lazy we want to add a little feature that makes sure we don't have to add all the metadata by hand every time. But let's go through it step by step. In our childrout `./app/routes/__layout` we create the file `book.tsx` and a suitable directory `book`.

```javascript
import { Outlet } from '@remix-run/react'

export default function Book() {
  return (
    <div>
      <Outlet />
    </div>
  )
}
```
### Select file

In the directory `./app/routes/__layout/book` we now create a new file `selectFile.tsx`.
At this point we will select the ebook we want to upload and to be able to select it we need a small form.

Since we don't want to upload files twice we write a `LoaderFunction` to show us the files already present in Sonar.

```javascript
export const loader: LoaderFunction = async () => {
  const collection = await openCollection()
  const files = await collection.query('records', { type: 'sonar/file' })
  return json(files)
}
```
The `LoaderFunction` opens our collection with `openCollection` and fetches the corresponding `records` of type `sonar/file` via a [query](https://sonar.arso.xyz/apidocs-client/classes/Collection.html#query) request and returns them as a JSON object with which we can continue working.

```javascript
export default function SelectFile() {
  const actionData = useActionData()
  const files = useLoaderData()
  return (
    <div>
      <div className='bg-gray-200 text-white flex'>
        <div className='bg-pink-600 p-4 text-center w-full'>
          <h3>Step 1 - Select or import a PDF</h3>
        </div>
        <div className='p-4 text-center w-full'>
          <h3>Step 2 (optional) - Load Metadata</h3>
        </div>
        <div className=' p-4 text-center w-full'>
          <h3>Step 3 - Create Book Record</h3>
        </div>
      </div>
      <div className='p-4 my-4'>
        <label
          className='block mb-2 text-sm font-medium text-gray-900'
          htmlFor='formFile'
        >
          Select a file:
        </label>
        <div className='grid grid-cols-6 '>
          {files.map((file: any, i: number) => {
            if (file.value.contentType === 'application/pdf') {
              return (
                <div key={i} className='mx-4'>
                  <a
                    className='mr-2'
                    href={'/book/addmetadata?fileId=' + file.id}
                  >
                    <GrDocumentPdf className='text-7xl ' />

                    <span className='text-sm text-pink-600'>
                      {file.value.filename.length > 15
                        ? file.value.filename.substring(0, 10) +
                          '...' +
                          file.value.filename.substring(
                            file.value.filename.length - 6
                          )
                        : file.value.filename}
                    </span>
                  </a>
                </div>
              )
            }
          })}
        </div>
        <div className='my-4'>
          <Form method='post' encType='multipart/form-data'>
            <label
              className='block mb-2 text-sm font-medium text-gray-900'
              htmlFor='formFile'
            >
              Import new File:
            </label>
            <input
              type='file'
              id='formFile'
              name='file'
              accept='application/pdf'
            />
            {actionData?.formErrors?.file ? (
              <p style={{ color: 'red' }}>{actionData?.formErrors?.file}</p>
            ) : null}
            <button type='submit'>Submit</button>
          </Form>
        </div>
      </div>
    </div>
  )
}
```
If you look at the code you will see that we use the `actionData` with the function `useActionData()` to validate our input. The `useActionData()` gets the data from a so called `ActionFunction` which is one of the nice features of Remix and in our case makes sure that when we `submit` the form our data is stored in Sonar. 

Let's continue step by step. So we want to validate our form for this we create a new directory `my-peerBooks-app/peerbooks/app/lib` and create the file `utils.ts`.

To validate the ISBN we impose a simple [ISBN-Validator](https://github.com/sactor/simple-isbn) which we have already added to the dependencies in `package.json`. Since we will add some metadata to our files later on, we create the needed functions to validate the other fields here as well.

```javascript
import { isbn as checkISBN } from 'simple-isbn'

export function validateISBN(isbn: FormDataEntryValue | null) {
  if (typeof isbn !== 'string' || isbn.length == 0) {
    return 'isbn is required'
  } else if (!checkISBN.isValidIsbn(isbn)) {
    return 'invalid isbn'
  }
}

export function validateFileId(fileId: FormDataEntryValue | null) {
  if (typeof fileId !== 'string') {
    return 'Something is going wrong with your upload'
  }
}

export function validateStringField(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return 'field only accepts string inputs'
  }
}

export function parseArrayField(value: string) {
  return value.split(',')
}
```
We switch back to `selectFile.tsx` and impose the functions we need in the following:

```javascript
import { ActionFunction } from '@remix-run/node'
import {
  json,
  LoaderFunction,
  redirect,
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  writeAsyncIterableToWritable
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'

import { PassThrough } from 'stream'
import { validateFileId } from '~/lib/utils'
import { openCollection, uploadFileToSonar } from '../../../sonar.server'
```

Jetzt geht es an die `ActionFunction` welche unseren Datei Upload abhandeln wird.

```javascript
export const action: ActionFunction = async ({ request }) => {
  const uploadHandler = unstable_composeUploadHandlers(
    async ({ name, contentType, data, filename }) => {
      if (name !== 'file') return null
      const uploadStream = new PassThrough()
      const [fileId] = await Promise.all([
        uploadFileToSonar({ data: uploadStream, contentType, filename }),
        writeAsyncIterableToWritable(data, uploadStream),
      ])
      if (fileId.error || typeof fileId !== 'string') return null
      return fileId
    },
    unstable_createMemoryUploadHandler()
  )
  const formData = await unstable_parseMultipartFormData(request, uploadHandler)
  const formErrors = { fileId: validateFileId(formData.get('file')) }
  if (formErrors.fileId) return formErrors

  const fileId = formData.get('file') as string
  return redirect(`/book/addmetadata?fileId=${fileId}`)
}
```
To upload the file to Sonar we have already written a function in the `sonar.server.tsx` which can now be used by the Remix [uploadhandler](https://remix.run/docs/en/v1/api/remix#uploadhandler). We call it when we get the data from our input field which will be checked with our function to validate the input, if everything is ok the file will be created and we will be redirected to a form where we can enter the corresponding metadata to our ebook. So now we know what comes next the adding of the metadata. Your `selectFile.tsx` should now look like this:

```javascript
import type { ActionFunction } from '@remix-run/node'
import {
  json,
  LoaderFunction,
  redirect,
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  writeAsyncIterableToWritable,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData, Link } from '@remix-run/react'
import { GrDocumentPdf } from 'react-icons/gr'

import { PassThrough } from 'stream'
import { validateFileId } from '~/lib/utils'
import { openCollection, uploadFileToSonar } from '../../../sonar.server'

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler = unstable_composeUploadHandlers(
    async ({ name, contentType, data, filename }) => {
      if (name !== 'file') return null
      const uploadStream = new PassThrough()
      const [fileId] = await Promise.all([
        uploadFileToSonar({ data: uploadStream, contentType, filename }),
        writeAsyncIterableToWritable(data, uploadStream),
      ])
      if (fileId.error || typeof fileId !== 'string') return null
      return fileId
    },
    unstable_createMemoryUploadHandler()
  )
  const formData = await unstable_parseMultipartFormData(request, uploadHandler)
  const formErrors = { fileId: validateFileId(formData.get('file')) }
  if (formErrors.fileId) return formErrors

  const fileId = formData.get('file') as string
  return redirect(`/book/addmetadata?fileId=${fileId}`)
}

export const loader: LoaderFunction = async () => {
  const collection = await openCollection()
  const files = await collection.query('records', { type: 'sonar/file' })
  return json(files)
}

export default function SelectFile() {
  const actionData = useActionData()
  const files = useLoaderData()
  return (
    <div>
      <div className='bg-gray-200 text-white flex'>
        <div className='bg-pink-600 p-4 text-center w-full'>
          <h3>Step 1 - Select or import a PDF</h3>
        </div>
        <div className='p-4 text-center w-full'>
          <h3>Step 2 (optional) - Load Metadata</h3>
        </div>
        <div className=' p-4 text-center w-full'>
          <h3>Step 3 - Create Book Record</h3>
        </div>
      </div>
      <div className='p-4 my-4'>
        <label
          className='block mb-2 text-sm font-medium text-gray-900'
          htmlFor='formFile'
        >
          Select a file:
        </label>
        <div className='grid grid-cols-6 '>
          {files.map((file: any, i: number) => {
            if (file.value.contentType === 'application/pdf') {
              return (
                <div key={i} className='mx-4'>
                  <a
                    className='mr-2'
                    href={'/book/addmetadata?fileId=' + file.id}
                  >
                    <GrDocumentPdf className='text-7xl ' />

                    <span className='text-sm text-pink-600'>
                      {file.value.filename.length > 15
                        ? file.value.filename.substring(0, 10) +
                          '...' +
                          file.value.filename.substring(
                            file.value.filename.length - 6
                          )
                        : file.value.filename}
                    </span>
                  </a>
                </div>
              )
            }
          })}
        </div>
        <div className='my-4'>
          <Form method='post' encType='multipart/form-data'>
            <label
              className='block mb-2 text-sm font-medium text-gray-900'
              htmlFor='formFile'
            >
              Import new File:
            </label>
            <input
              type='file'
              id='formFile'
              name='file'
              accept='application/pdf'
            />
            {actionData?.formErrors?.file ? (
              <p style={{ color: 'red' }}>{actionData?.formErrors?.file}</p>
            ) : null}
            <button type='submit'>Submit</button>
          </Form>
        </div>
      </div>
    </div>
  )
}

```

### Adding the Openlibrary API [optional]

Since we are lazy and don't always want to add all metadata manually, we now use the API of https://openlibrary.org/, which is of course optional. In our `lib` directory we create a new file `openLibrary.ts` and create a function in it which fetches the data based on the ISBN we entered before and returns it as JSON.

```javascript
export default async function fetchOpenLibraryData(isbn: string) {
  const identifier = 'ISBN:' + isbn
  const url =
    'https://openlibrary.org/api/books?bibkeys=' +
    identifier +
    '&jscmd=data&format=json'
  const res = await fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error('ERROR' + res.status)
      }
      return res.json()
    })
    .then((data) => {
      return data[identifier]
    })
    .catch((error) => {
      return error
    })
  return res
}
```

In unserem `book` Verzeichniss legen wir die Datei `addMetadata.tsx` an. 

....

### Create record
#### $id
## Display the records
### book component
### book.tsx(route)
## search
## add feed


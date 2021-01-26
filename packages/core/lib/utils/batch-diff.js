const kDiff = Symbol('batch-diff')

module.exports = {
  batchToDiff, isLinked, loadAllLinks
}

async function batchToDiff (col, batch) {
  if (!batch[kDiff]) batch[kDiff] = createDiff(col, batch)
  return batch[kDiff]
}

async function createDiff (col, batch) {
  console.log('create diff', col, batch)
  const records = new Set()
  const links = new Set()
  const left = new Set()
  const right = new Set()

  // Find out which records are linked currently so that they can be ignored, and collect links from all records in here
  await Promise.all(batch.map(async record => {
    for (const link of record.links) {
      links.add(link)
    }
    const recordIsLinked = await isLinked(col, record)
    if (recordIsLinked) return
    records.add(record)
  }))

  // Check where this record goes
  for (const record of records) {
    if (links.has(record.address)) {
      links.delete(record.address)
      left.add(record)
    } else if (record.deleted) {
      // left.add(record)
    } else {
      right.add(record)
    }
  }

  // Load all linked records into left
  const linkedRecords = await loadAllLinks(col, links)
  linkedRecords.forEach(left.add, left)

  return {
    left: Array.from(left.values()),
    right: Array.from(right.values())
  }
}

async function loadAllLinks (col, links) {
  links = Array.from(links)
  const records = await Promise.all(links.map(link => {
    const [key, seq] = link.split('@')
    return col.loadRecord({ key, seq }).catch(() => {})
  }))
  return records.filter(r => r).flat()
}

async function isLinked (col, record) {
  return new Promise((resolve, reject) => {
    col.api.kv.isLinked(record, (err, isLinked) => {
      err ? reject(err) : resolve(isLinked)
    })
  })
}

// async function loadAllLinks (col, records) {
//   const nestedLinks = await Promise.all(
//     records.map(record => loadLinks(col, record))
//   )
//   return nestedLinks.flat()
// }

// async function loadLinks (col, record) {
//   const linkedRecords = await Promise.all(
//     record.links.map(async link => {
//       const [key, seq] = link.split('@')
//       try {
//         return col.loadRecord({ key, seq })
//       } catch (err) {
//         return null
//       }
//     })
//   )
//   return linkedRecords.filter(r => r)
// }
// async function collectLinks (col, record) {
//   if (!record.links || !record.links.length) return []
//   const right = []
//   const left = (await Promise.all(
//     record.links.map(async link => {
//       const [key, seq] = link.split('@')
//       try {
//         return col.loadRecord({ key, seq })
//       } catch (err) {
//         return null
//       }
//     })
//   )).filter(r => r)
//   if (record.deleted) left.push(record)
//   else right.push(record)
//   return { left, right }
// }

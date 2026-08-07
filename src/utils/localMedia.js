const DATABASE_NAME = 'ruta-logros-media'
const DATABASE_VERSION = 1
const IMAGE_STORE = 'action-images'

let databasePromise

const openDatabase = () => {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('Este navegador no permite guardar imágenes localmente.'))
        return
      }

      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(IMAGE_STORE)) {
          database.createObjectStore(IMAGE_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento de imágenes.'))
    })
  }
  return databasePromise
}

const runTransaction = async (mode, operation) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, mode)
    const store = transaction.objectStore(IMAGE_STORE)
    let result

    try {
      result = operation(store)
    } catch (error) {
      reject(error)
      return
    }

    transaction.oncomplete = () => resolve(result?.result)
    transaction.onerror = () => reject(transaction.error || result?.error || new Error('No se pudo guardar la imagen.'))
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló el guardado de la imagen.'))
  })
}

export const saveActionImage = (id, file) => runTransaction('readwrite', (store) => store.put({
  id,
  blob: file,
  name: file.name,
  type: file.type,
  size: file.size,
  savedAt: new Date().toISOString(),
}))

export const getActionImage = async (id) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, 'readonly')
    const request = transaction.objectStore(IMAGE_STORE).get(id)
    request.onsuccess = () => resolve(request.result?.blob || null)
    request.onerror = () => reject(request.error || new Error('No se pudo leer la imagen.'))
  })
}

export const deleteActionImage = (id) => runTransaction('readwrite', (store) => store.delete(id))

export const clearActionImages = () => runTransaction('readwrite', (store) => store.clear())

const DATABASE_NAME = 'ruta-logros-media'
const DATABASE_VERSION = 2
const IMAGE_STORE = 'action-images'
const APPEARANCE_STORE = 'appearance-images'

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
        if (!database.objectStoreNames.contains(APPEARANCE_STORE)) {
          database.createObjectStore(APPEARANCE_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento de imágenes.'))
    })
  }
  return databasePromise
}

const runTransaction = async (storeName, mode, operation) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
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

const saveImage = (storeName, id, file) => runTransaction(storeName, 'readwrite', (store) => store.put({
  id,
  blob: file,
  name: file.name,
  type: file.type,
  size: file.size,
  savedAt: new Date().toISOString(),
}))

const getImage = async (storeName, id) => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(id)
    request.onsuccess = () => resolve(request.result?.blob || null)
    request.onerror = () => reject(request.error || new Error('No se pudo leer la imagen.'))
  })
}

export const saveActionImage = (id, file) => saveImage(IMAGE_STORE, id, file)
export const getActionImage = (id) => getImage(IMAGE_STORE, id)
export const deleteActionImage = (id) => runTransaction(IMAGE_STORE, 'readwrite', (store) => store.delete(id))
export const clearActionImages = () => runTransaction(IMAGE_STORE, 'readwrite', (store) => store.clear())

export const saveAppearanceImage = (id, file) => saveImage(APPEARANCE_STORE, id, file)
export const getAppearanceImage = (id) => getImage(APPEARANCE_STORE, id)
export const deleteAppearanceImage = (id) => runTransaction(APPEARANCE_STORE, 'readwrite', (store) => store.delete(id))

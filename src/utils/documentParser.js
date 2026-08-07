import { Buffer } from 'buffer'

const clean = (value = '') =>
  value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .trim()

const cleanCategory = (value) =>
  clean(value)
    .replace(/\s*\(un solo logro[^)]*\)\s*/i, '')
    .replace(/[.:]+$/, '')

const extractOwnerName = (rawText) => {
  const lines = rawText
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 80)

  const patterns = [
    /^(?:nombre(?:\s+y\s+apellidos)?|participante|cliente|persona|titular)\s*(?::|-|\t)\s*(.+)$/i,
    /^plan\s+de\s+logros(?:\s+de|\s*[:-])\s*(.+)$/i,
    /^elaborado\s+por\s*[:-]\s*(.+)$/i,
  ]

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (!match) continue
      const candidate = clean(match[1]).replace(/[|_]+$/g, '').trim()
      const words = candidate.split(/\s+/)
      if (candidate.length >= 2 && candidate.length <= 60 && words.length <= 6 && /^[\p{L}][\p{L}\s'.-]+$/u.test(candidate)) {
        return candidate
      }
    }
  }

  return ''
}

const sectionRows = (rows, label, nextLabels) => {
  const start = rows.findIndex((cells) => clean(cells[0]).toLowerCase() === label)
  if (start < 0) return []

  let end = rows.length
  for (let index = start + 1; index < rows.length; index += 1) {
    if (nextLabels.includes(clean(rows[index][0]).toLowerCase())) {
      end = index
      break
    }
  }

  const sameRowContent = rows[start].slice(1)
  return (sameRowContent.length ? [sameRowContent] : []).concat(rows.slice(start + 1, end))
}

export function parsePlanText(rawText, sourceName = 'Documento importado') {
  const ownerName = extractOwnerName(rawText)
  const rows = rawText
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.split('\t').map(clean).filter(Boolean))
    .filter((cells) => cells.length)

  let category = null
  let currentGoal = null
  const goals = []

  const finishGoal = () => {
    if (!currentGoal) return

    const metaRows = sectionRows(currentGoal.rows, 'meta', ['ser', 'hacer', 'tener'])
    const identityRows = sectionRows(currentGoal.rows, 'ser', ['hacer', 'tener'])
    const actionRows = sectionRows(currentGoal.rows, 'hacer', ['tener'])
    const outcomeRows = sectionRows(currentGoal.rows, 'tener', [])

    let due = ''
    const metaParts = []
    metaRows.forEach((cells) => {
      if (cells.length > 1) {
        metaParts.push(...cells.slice(0, -1))
        due = cells.at(-1)
      } else {
        metaParts.push(...cells)
      }
    })

    const tasks = []
    let pendingTask = ''
    actionRows.forEach((cells) => {
      if (cells.length > 1) {
        tasks.push({
          text: clean([pendingTask, ...cells.slice(0, -1)].filter(Boolean).join(' ')),
          due: clean(cells.at(-1)),
        })
        pendingTask = ''
      } else {
        pendingTask = clean([pendingTask, ...cells].filter(Boolean).join(' '))
      }
    })
    if (pendingTask) tasks.push({ text: pendingTask, due: '' })

    const meta = clean(metaParts.join(' '))
    if (meta) {
      goals.push({
        category: cleanCategory(currentGoal.category),
        number: currentGoal.number,
        meta,
        due: clean(due),
        identity: clean(identityRows.flat().join(' ')),
        tasks,
        outcome: clean(outcomeRows.flat().join(' ')),
      })
    }
  }

  rows.forEach((cells) => {
    const joined = clean(cells.join(' '))
    const categoryMatch = joined.match(/^(\d+)\.\s*(.+?)[.:]?$/)

    if (categoryMatch && Number(categoryMatch[1]) <= 9) {
      finishGoal()
      currentGoal = null
      category = cleanCategory(categoryMatch[2])
      return
    }

    const goalMatch = joined.match(/\bLOGRO\s*(\d+)/i)
    if (goalMatch && category) {
      finishGoal()
      currentGoal = { category, number: Number(goalMatch[1]), rows: [] }
      return
    }

    if (currentGoal) currentGoal.rows.push(cells)
  })
  finishGoal()

  if (goals.length) return { title: sourceName.replace(/\.(docx?|pdf|txt)$/i, ''), ownerName, goals }

  const paragraphs = rawText
    .split(/\r?\n+/)
    .map(clean)
    .filter((line) => line.length > 25)
    .slice(0, 50)

  return {
    title: sourceName.replace(/\.(docx?|pdf|txt)$/i, ''),
    ownerName,
    goals: paragraphs.map((meta, index) => ({
      category: 'Importado',
      number: index + 1,
      meta,
      due: '',
      identity: '',
      tasks: [],
      outcome: '',
    })),
  }
}

async function extractPdfText(arrayBuffer) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])

  GlobalWorkerOptions.workerSrc = workerModule.default
  const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdf = await loadingTask.promise
  const pages = []
  let ownerName = ''
  let activeSection = ''

  const sectionLabels = new Set(['meta', 'ser', 'hacer', 'tener'])
  const isCategory = (value) => /^\d+\.\s*.+[.:]?$/i.test(value)
  const isGoal = (value) => /^LOGRO\s*\d+/i.test(value)
  const joinParts = (parts) => clean(parts.join(' ')).replace(/\s+([.,;:!?])/g, '$1')
  const columnFor = (x) => {
    if (x < 90) return 'label'
    if (x < 435) return 'content'
    if (x < 515) return 'date'
    return 'check'
  }

  const mergePdfFragments = (sourceItems) => {
    const merged = []

    sourceItems.forEach((item) => {
      const value = clean(item.str)
      if (!value || !item.transform) return

      const next = {
        value,
        x: item.transform[4],
        y: item.transform[5],
        width: Math.abs(item.width || 0),
      }
      const previous = merged.at(-1)

      if (
        previous
        && Math.abs(previous.y - next.y) <= 2
        && columnFor(previous.x) === columnFor(next.x)
        && next.x >= previous.x - 1
      ) {
        const previousRight = previous.x + previous.width
        const gap = next.x - previousRight
        const separator = gap <= 2 ? '' : ' '
        previous.value = clean(`${previous.value}${separator}${next.value}`)
        previous.width = Math.max(previousRight, next.x + next.width) - previous.x
        return
      }

      merged.push(next)
    })

    return merged
  }

  const sectionRowsFromItems = (label, labelItem, block, dateThreshold, checkThreshold) => {
    const contentThreshold = labelItem.x + 20

    if (label !== 'hacer') {
      const contentParts = []
      const dueParts = []
      block.forEach((item) => {
        if (!item.value || item.x >= checkThreshold || item.x < contentThreshold) return
        if (item.x >= dateThreshold) dueParts.push(item.value)
        else contentParts.push(item.value)
      })
      const content = joinParts(contentParts)
      const due = joinParts(dueParts)
      return content ? [`${labelItem.value}\t${content}${due ? `\t${due}` : ''}`] : []
    }

    const tasks = []
    let taskParts = []
    let dueParts = []
    const finishTask = () => {
      const text = joinParts(taskParts)
      const due = joinParts(dueParts)
      if (text) tasks.push({ text, due })
      taskParts = []
      dueParts = []
    }

    block.forEach((item) => {
      if (!item.value || item.x >= checkThreshold || item.x < contentThreshold) return
      if (item.x >= dateThreshold) {
        dueParts.push(item.value)
        return
      }
      if ((dueParts.length && taskParts.length) || (/^acci[oó]n\s*\d+/i.test(item.value) && taskParts.length)) {
        finishTask()
      }
      taskParts.push(item.value)
    })
    finishTask()

    return tasks.map((task, index) => `${index === 0 ? labelItem.value : ''}\t${task.text}${task.due ? `\t${task.due}` : ''}`)
  }

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = mergePdfFragments(content.items)

      if (!ownerName) {
        const nameIndex = items.findIndex((item) => item.value.toLocaleLowerCase('es') === 'nombre')
        if (nameIndex >= 0) {
          const label = items[nameIndex]
          const candidate = items.slice(nameIndex + 1).find((item) => (
            item.value
            && item.x > label.x + 20
            && Math.abs(item.y - label.y) <= 20
          ))
          if (candidate) ownerName = candidate.value
        }
      }

      const fechaItem = items.find((item) => item.value.toLocaleLowerCase('es') === 'fecha')
      const checkItem = items.find((item) => item.value.toLocaleLowerCase('es') === 'check')
      const dateThreshold = fechaItem ? fechaItem.x - 25 : 435
      const checkThreshold = checkItem ? checkItem.x - 10 : 515
      const semanticRows = []

      const firstMarker = items.findIndex((item) => {
        const normalized = item.value.toLocaleLowerCase('es')
        return sectionLabels.has(normalized) || isCategory(item.value) || isGoal(item.value)
      })

      if (activeSection && firstMarker !== 0) {
        const continuationEnd = firstMarker > 0 ? firstMarker : items.length
        semanticRows.push(...sectionRowsFromItems(
          activeSection,
          { value: '', x: 55 },
          items.slice(0, continuationEnd),
          dateThreshold,
          checkThreshold,
        ))
      }

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const normalized = item.value.toLocaleLowerCase('es')

        if (isCategory(item.value)) {
          semanticRows.push(item.value)
          activeSection = ''
          continue
        }

        if (isGoal(item.value)) {
          semanticRows.push(item.value)
          activeSection = ''
          continue
        }

        if (!sectionLabels.has(normalized)) continue
        activeSection = normalized

        let end = index + 1
        while (end < items.length) {
          const nextValue = items[end].value
          const nextNormalized = nextValue.toLocaleLowerCase('es')
          if (sectionLabels.has(nextNormalized) || isCategory(nextValue) || isGoal(nextValue)) break
          end += 1
        }

        semanticRows.push(...sectionRowsFromItems(normalized, item, items.slice(index + 1, end), dateThreshold, checkThreshold))
        index = end - 1
      }

      pages.push(semanticRows.join('\n'))
    }
  } finally {
    await loadingTask.destroy()
  }

  return `${ownerName ? `Nombre: ${ownerName}\n` : ''}${pages.join('\n')}`
}

async function extractLegacyDoc(arrayBuffer) {
  globalThis.Buffer = Buffer
  const [{ default: WordOleExtractor }, { default: BufferReader }] = await Promise.all([
    import('word-extractor/lib/word-ole-extractor.js'),
    import('word-extractor/lib/buffer-reader.js'),
  ])
  const reader = new BufferReader(Buffer.from(arrayBuffer))
  try {
    const document = await new WordOleExtractor().extract(reader)
    return document.getBody()
  } finally {
    await reader.close()
  }
}

export async function readPlanDocument(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const arrayBuffer = await file.arrayBuffer()
  let text = ''

  if (extension === 'docx') {
    const { default: mammoth } = await import('mammoth/mammoth.browser')
    const result = await mammoth.extractRawText({ arrayBuffer })
    text = result.value
  } else if (extension === 'doc') {
    text = await extractLegacyDoc(arrayBuffer)
  } else if (extension === 'pdf') {
    text = await extractPdfText(arrayBuffer)
    if (!text.trim()) {
      throw new Error('Este PDF no contiene texto seleccionable. Si fue escaneado, conviértelo con OCR antes de importarlo.')
    }
  } else if (extension === 'txt') {
    text = new TextDecoder('utf-8').decode(arrayBuffer)
  } else {
    throw new Error('Formato no compatible. Usa un archivo Word .doc, .docx o PDF .pdf.')
  }

  const parsed = parsePlanText(text, file.name)
  if (!parsed.goals.length) {
    throw new Error('No pudimos encontrar logros legibles en este documento.')
  }
  return parsed
}

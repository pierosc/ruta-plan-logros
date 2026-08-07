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

  if (goals.length) return { title: sourceName.replace(/\.(docx?|txt)$/i, ''), goals }

  const paragraphs = rawText
    .split(/\r?\n+/)
    .map(clean)
    .filter((line) => line.length > 25)
    .slice(0, 50)

  return {
    title: sourceName.replace(/\.(docx?|txt)$/i, ''),
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
  } else if (extension === 'txt') {
    text = new TextDecoder('utf-8').decode(arrayBuffer)
  } else {
    throw new Error('Formato no compatible. Usa un archivo .doc, .docx o .txt.')
  }

  const parsed = parsePlanText(text, file.name)
  if (!parsed.goals.length) {
    throw new Error('No pudimos encontrar logros legibles en este documento.')
  }
  return parsed
}

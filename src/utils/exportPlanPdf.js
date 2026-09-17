import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { getActionImage } from './localMedia.js'
import { mediaToPdfImage } from './attachmentMedia.js'

pdfMake.addVirtualFileSystem(pdfFonts)

const COLORS = { ink: '#29243f', muted: '#746e87', purple: '#7156ce', paper: '#f8f6fc', green: '#287759' }
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - 84
const displayCategory = (category) => (category || 'Otra área').replace(/\s*\(un solo logro[^)]*\)\s*/i, '').trim()
const AREA_COLORS = [
  ['familia', '#b8496d', '#fbeef2'], ['dinero', '#9b6b19', '#fbf3e2'],
  ['trabajo', '#4166b5', '#edf2fc'], ['salud', '#287759', '#eaf6ef'],
  ['relaciones', '#8b55ab', '#f5eefb'], ['servicio', '#b75b32', '#fff0e8'],
  ['recreacion', '#7156ce', '#f0ebfc'], ['medio ambiente', '#4e7c36', '#eef5e8'],
]
const areaPalette = (category = '') => {
  const normalized = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const match = AREA_COLORS.find(([name]) => normalized.includes(name))
  return match ? { accent: match[1], tint: match[2] } : { accent: COLORS.purple, tint: '#f0ebfc' }
}

const card = (stack, { fill = '#ffffff', accent, padding = 16 } = {}) => ({
  table: { widths: ['*'], body: [[{ stack }]] },
  layout: {
    hLineWidth: () => 0, vLineWidth: (index) => accent && index === 0 ? 3 : 0,
    vLineColor: () => accent || fill, fillColor: () => fill,
    paddingLeft: () => padding, paddingRight: () => padding,
    paddingTop: () => padding, paddingBottom: () => padding,
  },
})
const heading = (text) => ({ text, style: 'section', headlineLevel: 1 })
const detailCard = (label, text, palette) => text?.trim() ? [{
  ...card([
    { text: label, bold: true, color: palette.accent, fontSize: 10, margin: [0, 0, 0, 5] },
    { text: text.trim() },
  ], { fill: palette.tint, accent: palette.accent, padding: 10 }),
  margin: [0, 8, 0, 0],
}] : []

const fileNameFor = (ownerName, date) => {
  const name = (ownerName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  return `mis-logros${name ? `-${name}` : ''}-${day}.pdf`
}

export const downloadPlanPdf = async (plan) => {
  if (!plan.goals?.length) throw new Error('Agrega al menos un logro antes de descargar el PDF.')

  const generatedAt = new Date()
  const dateLabel = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(generatedAt)
  // Imported document filenames are not personal report titles.
  const title = 'Mis logros'
  const owner = plan.ownerName?.trim() || ''
  const tasks = plan.goals.flatMap((goal) => goal.tasks || [])
  const completedTasks = tasks.filter((task) => task.completed).length
  const completedGoals = plan.goals.filter((goal) => goal.completed).length
  const progress = Math.round(tasks.length ? completedTasks / tasks.length * 100 : completedGoals / plan.goals.length * 100)
  const areas = new Map()
  for (const goal of plan.goals) {
    const name = displayCategory(goal.category)
    const current = areas.get(name) || { name, completed: 0, total: 0 }
    current.total += 1
    current.completed += goal.completed ? 1 : 0
    areas.set(name, current)
  }
  const images = {}
  let includedImages = 0
  let missingImages = 0
  const content = [
    {
      ...card([
        { text: 'MI PLAN PERSONAL', color: '#cfc3f8', fontSize: 9, characterSpacing: 2, margin: [0, 0, 0, 8] },
        { text: title, fontSize: 36, bold: true, color: '#ffffff', margin: [0, 0, 0, 6] },
        ...(owner ? [{ text: owner, fontSize: 17, color: '#ede7ff', margin: [0, 0, 0, 7] }] : []),
        { text: dateLabel, color: '#cfc3f8', fontSize: 10 },
      ], { fill: '#302546', padding: 18 }),
      margin: [0, 6, 0, 12],
    },
    {
      columns: [
        [`${progress}%`, 'de avance', COLORS.purple, '#eee8fc'],
        [`${completedGoals} / ${plan.goals.length}`, 'logros completados', COLORS.green, '#e7f4eb'],
        [`${completedTasks} / ${tasks.length}`, 'acciones completadas', '#a26924', '#fcf0db'],
      ].map(([value, label, color, fill]) => ({
        ...card([
          { text: value, fontSize: 24, bold: true, color, margin: [0, 0, 0, 4] },
          { text: label, fontSize: 9, color: COLORS.muted },
        ], { fill, padding: 10 }), width: '*',
      })),
      columnGap: 10, margin: [0, 0, 0, 10],
    },
    {
      canvas: [
        { type: 'rect', x: 0, y: 0, w: CONTENT_WIDTH, h: 6, color: '#e5def2' },
        ...(progress ? [{ type: 'rect', x: 0, y: 0, w: CONTENT_WIDTH * progress / 100, h: 6, color: COLORS.purple }] : []),
      ], margin: [0, 0, 0, 8],
    },
    ...detailCard('Mi contrato', plan.contract, { accent: COLORS.purple, tint: '#eee8fc' }),
    heading('Mi progreso por área'),
  ]
  const areaList = [...areas.values()]
  for (let offset = 0; offset < areaList.length; offset += 2) {
    const columns = areaList.slice(offset, offset + 2).map((area) => {
      const palette = areaPalette(area.name)
      return {
        ...card([
          { text: area.name, bold: true, color: palette.accent, margin: [0, 0, 0, 5] },
          { text: `${area.completed} de ${area.total} logros completados`, fontSize: 9, color: COLORS.muted },
        ], { fill: palette.tint, accent: palette.accent, padding: 8 }), width: '*',
      }
    })
    if (columns.length === 1) columns.push({ text: '', width: '*' })
    content.push({ columns, columnGap: 10, unbreakable: true, margin: [0, 0, 0, 8] })
  }

  for (const [goalIndex, goal] of plan.goals.entries()) {
    const goalNumber = goal.number || goalIndex + 1
    const goalTasks = goal.tasks || []
    const done = goalTasks.filter((task) => task.completed).length
    const palette = areaPalette(goal.category)
    content.push({
      ...card([
        { text: displayCategory(goal.category), color: '#ffffff', fontSize: 10, margin: [0, 0, 0, 4] },
        {
          columns: [
            { text: `Logro ${String(goalNumber).padStart(2, '0')}`, fontSize: 22, bold: true, color: '#ffffff' },
            { text: goal.completed ? 'COMPLETADO' : 'EN CAMINO', color: '#ffffff', fontSize: 9, bold: true, alignment: 'right', margin: [0, 9, 0, 0] },
          ],
        },
        { text: `${done} de ${goalTasks.length} acciones completadas`, color: '#ffffff', fontSize: 9, margin: [0, 5, 0, 0] },
      ], { fill: palette.accent, padding: 12 }),
      headlineLevel: 3,
      pageBreak: goalIndex === 0 ? 'before' : undefined,
      margin: [0, goalIndex === 0 ? 0 : 16, 0, 8],
    }, {
      ...card([
        { text: goal.meta || 'Sin descripción', fontSize: 11, lineHeight: 1.15 },
        ...(goal.due ? [{ text: `Fecha del logro: ${goal.due}`, color: palette.accent, bold: true, fontSize: 9, margin: [0, 8, 0, 0] }] : []),
      ], { fill: palette.tint, padding: 10 }),
      margin: [0, 0, 0, 4],
    }, heading('Mis acciones'))
    if (!goalTasks.length) content.push({ text: 'Este logro todavía no tiene acciones.', color: COLORS.muted })

    for (const [taskIndex, task] of goalTasks.entries()) {
      // Repeating the action header preserves context when long text spans pages.
      content.push({
        headlineLevel: 2,
        table: {
          widths: ['*'], headerRows: 1,
          body: [
            [{ columns: [
              { text: `ACCIÓN ${String(taskIndex + 1).padStart(2, '0')}`, bold: true, color: palette.accent, fontSize: 10 },
              { text: task.completed ? 'Completada' : 'Pendiente', color: task.completed ? COLORS.green : COLORS.muted, alignment: 'right', fontSize: 9 },
            ] }],
            [{ stack: [
              { text: task.text || 'Sin descripción' },
              ...(task.due ? [{ text: task.due, color: COLORS.muted, fontSize: 9, margin: [0, 5, 0, 0] }] : []),
            ] }],
          ],
        },
        layout: {
          hLineWidth: () => 0, vLineWidth: (index) => index === 0 ? 3 : 0,
          vLineColor: () => palette.accent, fillColor: (row) => row === 0 ? palette.tint : '#ffffff',
          paddingLeft: () => 11, paddingRight: () => 11, paddingTop: () => 6, paddingBottom: () => 6,
        },
        margin: [0, 3, 0, 6],
      })

      const attachments = task.attachments || []
      for (let offset = 0; offset < attachments.length; offset += 2) {
        const batch = attachments.slice(offset, offset + 2)
        const columns = []
        for (const attachment of batch) {
          let imageKey
          try {
            const blob = await getActionImage(attachment.id)
            if (blob) {
              const { dataUrl } = await mediaToPdfImage(blob, attachment)
              imageKey = `evidence-${includedImages++}`
              images[imageKey] = dataUrl
            }
          } catch {
            // A corrupt or unsupported attachment must not discard the rest of the report.
          }
          if (!imageKey) missingImages += 1
          columns.push({
            ...card([imageKey
              ? { image: imageKey, fit: [batch.length === 1 ? CONTENT_WIDTH - 12 : (CONTENT_WIDTH - 10) / 2 - 12, 290], alignment: 'center' }
              : { text: 'Evidencia no disponible', color: COLORS.muted, alignment: 'center', margin: [0, 25, 0, 25] },
            ], { padding: 6 }), width: '*',
          })
        }
        content.push({ columns, columnGap: 10, unbreakable: true, margin: [0, 0, 0, 8] })
      }
    }
    content.push(...detailCard('Mis notas', goal.note, { accent: '#936320', tint: '#fcf2de' }))
  }

  const definition = {
    info: { title, author: owner, subject: 'Mis logros y evidencias' },
    pageSize: 'A4', pageMargins: [42, 48, 42, 46],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.1, color: COLORS.ink },
    styles: { section: { fontSize: 13, bold: true, color: COLORS.ink, margin: [0, 10, 0, 6] } },
    background: (_page, size) => ({ absolutePosition: { x: 0, y: 0 }, canvas: [
      { type: 'rect', x: 0, y: 0, w: size.width, h: size.height, color: COLORS.paper },
      { type: 'rect', x: 0, y: 0, w: 7, h: size.height, color: '#d5c8f1' },
      { type: 'ellipse', x: size.width - 20, y: 0, r1: 130, r2: 110, color: '#eee8f8' },
      { type: 'ellipse', x: size.width, y: size.height, r1: 140, r2: 90, color: '#f0e7ef' },
    ] }),
    header: {
      columns: [
        { text: 'MI RUTA DE LOGROS', bold: true, characterSpacing: 1.3, color: COLORS.purple },
        { text: String(generatedAt.getFullYear()), alignment: 'right', color: COLORS.muted },
      ], fontSize: 8, margin: [42, 23, 42, 0],
    },
    footer: (page, total) => ({
      columns: [
        { text: 'MIS LOGROS', bold: true, characterSpacing: 1, color: COLORS.purple },
        { text: `${page} / ${total}`, alignment: 'right', color: COLORS.muted },
      ], fontSize: 8, margin: [42, 18, 42, 0],
    }),
    pageBreakBefore: (node, container) => (
      (node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0)
      // Leave room for the action heading and its first lines on the same page.
      || (node.headlineLevel === 2 && node.startPosition.top > 720)
      // Flow successive goals together, keeping space for a new goal's description.
      || (node.headlineLevel === 3 && node.startPosition.top > 535)
    ),
    content, images,
  }
  await pdfMake.createPdf(definition).download(fileNameFor(owner, generatedAt))
  return { includedImages, missingImages }
}

import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { getActionImage } from './localMedia.js'

pdfMake.addVirtualFileSystem(pdfFonts)

const COLORS = { ink: '#292840', muted: '#686777', purple: '#6758d9', green: '#26795a', soft: '#f1edff' }

// Decode one image at a time to keep large phone photos from exhausting memory.
// Canvas also normalizes browser-supported formats (including WebP) for the PDF.
const imageToDataUrl = async (blob) => {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  const canvas = document.createElement('canvas')
  try {
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('La imagen tardó demasiado en cargar.')), 15000)
      image.onload = () => { window.clearTimeout(timer); resolve() }
      image.onerror = () => { window.clearTimeout(timer); reject(new Error('No se pudo leer la imagen.')) }
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('La imagen está vacía.')
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.88)
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(url)
    canvas.width = 0
    canvas.height = 0
  }
}

const heading = (text) => ({ text, style: 'section', headlineLevel: 1 })
const paragraph = (text) => ({ text: String(text), margin: [0, 0, 0, 10] })
const optionalSection = (title, text) => text?.trim() ? [heading(title), paragraph(text)] : []

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
  const title = plan.title?.trim() || 'Mi Plan de Logros'
  const owner = plan.ownerName?.trim() || ''
  const tasks = plan.goals.flatMap((goal) => goal.tasks || [])
  const completedTasks = tasks.filter((task) => task.completed).length
  const completedGoals = plan.goals.filter((goal) => goal.completed).length
  const attachmentCount = tasks.reduce((count, task) => count + (task.attachments?.length || 0), 0)
  const progress = Math.round(tasks.length ? completedTasks / tasks.length * 100 : completedGoals / plan.goals.length * 100)
  const images = {}
  let includedImages = 0
  let missingImages = 0
  const content = [
    { text: 'MI RUTA DE LOGROS', style: 'eyebrow', margin: [0, 28, 0, 14] },
    { text: title, style: 'title' },
    ...(owner ? [{ text: owner, fontSize: 17, margin: [0, 0, 0, 8] }] : []),
    { text: `Exportado el ${dateLabel}`, style: 'muted', margin: [0, 0, 0, 26] },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          { stack: [{ text: `${progress}%`, style: 'stat' }, { text: 'de avance', style: 'muted' }] },
          { stack: [{ text: `${completedGoals} / ${plan.goals.length}`, style: 'stat' }, { text: 'logros completados', style: 'muted' }] },
          { stack: [{ text: `${completedTasks} / ${tasks.length}`, style: 'stat' }, { text: 'acciones completadas', style: 'muted' }] },
        ]],
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0,
        fillColor: () => COLORS.soft,
        paddingLeft: () => 14, paddingRight: () => 14, paddingTop: () => 18, paddingBottom: () => 18,
      },
      margin: [0, 0, 0, 24],
    },
    ...optionalSection('Mi contrato', plan.contract),
    heading('Acerca de este documento'),
    paragraph(`Incluye los ${plan.goals.length} logros del plan completo, sus acciones, fechas, estados y notas personales, junto con ${attachmentCount} imágenes adjuntas. El avance corresponde al momento de la descarga.`),
  ]

  for (const [goalIndex, goal] of plan.goals.entries()) {
    const goalNumber = goal.number || goalIndex + 1
    const goalTasks = goal.tasks || []
    const done = goalTasks.filter((task) => task.completed).length
    content.push(
      { text: goal.category || 'Otra área', style: 'eyebrow', pageBreak: 'before' },
      { text: `Logro ${goalNumber}`, style: 'goalTitle' },
      {
        text: `${goal.completed ? 'Completado' : 'Pendiente'}  ·  ${done} de ${goalTasks.length} acciones completadas`,
        color: goal.completed ? COLORS.green : COLORS.muted,
        margin: [0, 0, 0, 12],
      },
      paragraph(goal.meta || 'Sin descripción'),
      ...(goal.due ? [{ text: `Fecha del logro: ${goal.due}`, bold: true, margin: [0, 0, 0, 14] }] : []),
      ...optionalSection('Quién quiero ser', goal.identity),
      heading('Mis acciones'),
    )
    if (!goalTasks.length) content.push(paragraph('Este logro todavía no tiene acciones.'))

    for (const [taskIndex, task] of goalTasks.entries()) {
      content.push(
        {
          text: `Acción ${taskIndex + 1}  ·  ${task.completed ? 'Completada' : 'Pendiente'}`,
          style: 'actionTitle', headlineLevel: 1,
          color: task.completed ? COLORS.green : COLORS.purple,
        },
        paragraph(task.text || 'Sin descripción'),
        ...(task.due ? [{ text: `Fecha: ${task.due}`, style: 'muted', margin: [0, 0, 0, 10] }] : []),
      )

      const attachments = task.attachments || []
      for (let offset = 0; offset < attachments.length; offset += 2) {
        const columns = []
        for (const [columnIndex, attachment] of attachments.slice(offset, offset + 2).entries()) {
          let imageKey
          try {
            const blob = await getActionImage(attachment.id)
            if (blob) {
              const dataUrl = await imageToDataUrl(blob)
              imageKey = `evidence-${includedImages++}`
              images[imageKey] = dataUrl
            }
          } catch {
            // Keep the rest of the plan exportable and explicitly label unavailable evidence.
          }
          if (!imageKey) missingImages += 1
          const caption = `Logro ${goalNumber} · Acción ${taskIndex + 1} · Imagen ${offset + columnIndex + 1}`
          columns.push({
            width: '*',
            stack: [
              imageKey
                ? { image: imageKey, fit: [235, 190], alignment: 'center' }
                : { text: 'Imagen no disponible en este dispositivo o formato no compatible.', color: '#946023', margin: [8, 20, 8, 20] },
              { text: caption, style: 'caption', margin: [0, 6, 0, 2] },
              { text: String(attachment.name || 'Imagen adjunta').slice(0, 120), style: 'caption' },
            ],
          })
        }
        if (columns.length === 1) columns.push({ width: '*', text: '' })
        content.push({ columns, columnGap: 20, unbreakable: true, margin: [0, 2, 0, 16] })
      }
    }
    content.push(...optionalSection('Resultado esperado', goal.outcome), ...optionalSection('Mis notas', goal.note))
  }

  if (missingImages) {
    content.splice(5, 0, {
      text: `Se incluyeron ${includedImages} de ${attachmentCount} imágenes. ${missingImages} no se pudieron cargar; encontrarás un aviso en su lugar.`,
      color: '#946023', margin: [0, 0, 0, 16],
    })
  }

  const definition = {
    info: { title, author: owner, subject: 'Plan de logros con avances e imágenes' },
    pageSize: 'A4', pageMargins: [48, 54, 48, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25, color: COLORS.ink },
    styles: {
      title: { fontSize: 30, bold: true, lineHeight: 1.1, margin: [0, 0, 0, 16] },
      goalTitle: { fontSize: 25, bold: true, margin: [0, 8, 0, 10] },
      eyebrow: { fontSize: 10, bold: true, color: COLORS.purple, characterSpacing: 1.1 },
      section: { fontSize: 12, bold: true, margin: [0, 14, 0, 8] },
      actionTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 6] },
      stat: { fontSize: 24, bold: true, color: COLORS.purple, margin: [0, 0, 0, 5] },
      muted: { fontSize: 9, color: COLORS.muted },
      caption: { fontSize: 8, color: COLORS.muted, lineHeight: 1.1 },
    },
    header: { text: 'PLAN DE LOGROS', fontSize: 8, color: COLORS.muted, margin: [48, 25, 48, 0] },
    footer: (page, total) => ({
      columns: [
        { text: dateLabel },
        { text: `${page} / ${total}`, alignment: 'right' },
      ], fontSize: 8, color: COLORS.muted, margin: [48, 20, 48, 0],
    }),
    pageBreakBefore: (node, container) => node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0,
    content,
    images,
  }

  await pdfMake.createPdf(definition).download(fileNameFor(owner, generatedAt))
  return { includedImages, missingImages }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  FileText,
  HandHeart,
  HardDrive,
  HeartPulse,
  Home,
  Instagram,
  Leaf,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Target,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { DEFAULT_PLAN, DEFAULT_PLAN_TITLE } from './data/defaultPlan.js'
import { DOCUMENT_PARSER_VERSION, readPlanDocument } from './utils/documentParser.js'

const STORAGE_KEY = 'ruta-logros-state-v1'
const EMPTY_PLAN_TITLE = 'Mi Plan de Logros'

const CATEGORY_STYLES = [
  { match: 'familia', label: 'Familia', color: '#e46f87', soft: '#fff0f3', Icon: Users },
  { match: 'dinero', label: 'Dinero y finanzas', color: '#c68b26', soft: '#fff8e8', Icon: WalletCards },
  { match: 'trabajo', label: 'Trabajo y carrera', color: '#5a7cd8', soft: '#eef3ff', Icon: BriefcaseBusiness },
  { match: 'salud', label: 'Salud y cuerpo', color: '#2f9b79', soft: '#eaf9f3', Icon: HeartPulse },
  { match: 'relaciones', label: 'Relaciones', color: '#9a67c7', soft: '#f7efff', Icon: HandHeart },
  { match: 'servicio', label: 'Servicio comunitario', color: '#ca6a3d', soft: '#fff1ea', Icon: HandHeart },
  { match: 'recreación', label: 'Recreación', color: '#7658d8', soft: '#f1edff', Icon: Sparkles },
  { match: 'medio ambiente', label: 'Medio ambiente', color: '#4a9661', soft: '#ecf8ef', Icon: Leaf },
  { match: 'importado', label: 'Importado', color: '#687386', soft: '#eff2f6', Icon: FileText },
]

const fallbackCategory = { label: 'Otra área', color: '#687386', soft: '#eff2f6', Icon: Target }

const getCategoryStyle = (category) =>
  CATEGORY_STYLES.find((item) => category.toLocaleLowerCase('es').includes(item.match)) || fallbackCategory

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const prepareGoals = (goals, prefix = '') =>
  goals.map((goal, goalIndex) => {
    const baseId = goal.id || `${prefix}${slugify(goal.category)}-${goal.number || goalIndex + 1}`
    return {
      ...goal,
      id: baseId,
      completed: Boolean(goal.completed),
      note: goal.note || '',
      tasks: (goal.tasks || []).map((task, taskIndex) => ({
        ...task,
        id: task.id || `${baseId}-accion-${taskIndex + 1}`,
        completed: Boolean(task.completed),
      })),
    }
  })

const createDefaultState = () => ({
  title: EMPTY_PLAN_TITLE,
  ownerName: '',
  contract: '',
  sourceName: '',
  parserVersion: DOCUMENT_PARSER_VERSION,
  goals: [],
  updatedAt: new Date().toISOString(),
})

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const isUntouchedExamplePlan = (
      saved?.sourceName === 'Plan de Logros original'
      && saved?.title === DEFAULT_PLAN_TITLE
      && saved?.goals?.length === DEFAULT_PLAN.length
      && saved.goals.every((goal, index) => (
        goal.meta === DEFAULT_PLAN[index]?.meta
        && !goal.completed
        && !goal.note
        && (goal.tasks || []).every((task) => !task.completed)
      ))
    )

    if (isUntouchedExamplePlan) return createDefaultState()
    if (Array.isArray(saved?.goals)) return { ...saved, goals: prepareGoals(saved.goals) }
  } catch {
    // If a previous local backup is corrupt, start with a clean workspace.
  }
  return createDefaultState()
}

const getGoalProgress = (goal) => {
  if (!goal.tasks.length) return goal.completed ? 100 : 0
  return Math.round((goal.tasks.filter((task) => task.completed).length / goal.tasks.length) * 100)
}

const parseCalendarDate = (value) => {
  const match = value?.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (!match) return null
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59)
}

const isOverdue = (goal) => {
  const date = parseCalendarDate(goal.due)
  return Boolean(date && date < new Date() && !goal.completed)
}

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1)

function Sidebar({ personName, categories, selectedCategory, onSelectCategory, onEditName, onImport, onBackup, onReset, stats, hasPlan }) {
  return (
    <aside className="sidebar">
      <button className="brand brand-button" onClick={onEditName} aria-label={`Editar nombre: ${personName}`}>
        <span className="brand-mark"><Check size={20} strokeWidth={3} /></span>
        <span title={personName}>{personName}</span>
        <Pencil className="brand-edit-icon" size={14} />
      </button>

      <nav className="side-nav" aria-label="Navegación principal">
        <p className="nav-label">Mi espacio</p>
        <button
          className={`nav-item ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          <Home size={18} />
          <span>Vista general</span>
        </button>
        <button className="nav-item" onClick={() => document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' })}>
          <ListChecks size={18} />
          <span>Todos los logros</span>
          <span className="nav-count">{stats.total}</span>
        </button>

        <p className="nav-label categories-label">Áreas de vida</p>
        <div className="category-nav">
          {categories.map((category) => {
            const style = getCategoryStyle(category.name)
            const Icon = style.Icon
            return (
              <button
                className={`nav-item category-item ${selectedCategory === category.name ? 'active' : ''}`}
                key={category.name}
                onClick={() => onSelectCategory(category.name)}
              >
                <span className="category-icon" style={{ '--category-color': style.color, '--category-soft': style.soft }}>
                  <Icon size={16} />
                </span>
                <span>{style.label}</span>
                <span className="nav-count">{category.completed}/{category.total}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="side-actions">
        <button className="import-card" onClick={onImport}>
          <span className="import-card-icon"><Upload size={19} /></span>
          <span>
            <strong>{hasPlan ? 'Importar otro plan' : 'Importar mi plan'}</strong>
            <small>Word o PDF</small>
          </span>
          <ArrowRight size={17} />
        </button>
        {hasPlan && (
          <div className="utility-actions">
            <button onClick={onBackup}><Download size={15} /> Respaldo</button>
            <button onClick={onReset}><RotateCcw size={15} /> Vaciar</button>
          </div>
        )}
        <div className="local-note">
          <ShieldCheck size={16} />
          <span>Tus datos permanecen en este dispositivo.</span>
        </div>
      </div>
    </aside>
  )
}

function ProgressRing({ value }) {
  return (
    <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` }} aria-label={`${value}% completado`}>
      <div className="progress-ring-inner">
        <strong>{value}%</strong>
        <span>completado</span>
      </div>
    </div>
  )
}

function GoalCard({ goal, onToggleGoal, onToggleTask, onNoteChange, onEditGoal, onAddTask, onEditTask, open, onToggleOpen }) {
  const categoryStyle = getCategoryStyle(goal.category)
  const CategoryIcon = categoryStyle.Icon
  const progress = getGoalProgress(goal)
  const overdue = isOverdue(goal)
  const completedTasks = goal.tasks.filter((task) => task.completed).length

  return (
    <article className={`goal-card ${goal.completed ? 'goal-completed' : ''}`} style={{ '--category-color': categoryStyle.color }}>
      <div className="goal-card-main">
        <button
          className={`goal-check ${goal.completed ? 'checked' : ''}`}
          onClick={() => onToggleGoal(goal.id)}
          aria-label={goal.completed ? 'Marcar logro como pendiente' : 'Marcar logro como completado'}
        >
          {goal.completed ? <Check size={18} strokeWidth={3} /> : <Circle size={18} />}
        </button>

        <div className="goal-copy">
          <div className="goal-eyebrow">
            <span className="category-mini" style={{ '--category-soft': categoryStyle.soft, '--category-color': categoryStyle.color }}>
              <CategoryIcon size={13} /> {categoryStyle.label}
            </span>
            <span>Logro {goal.number}</span>
          </div>
          <h3>{goal.meta}</h3>

          <div className="goal-meta-row">
            {goal.due && (
              <span className={overdue ? 'due overdue' : 'due'}>
                <CalendarDays size={14} /> {overdue ? 'Venció: ' : ''}{goal.due}
              </span>
            )}
            <span className="steps-count"><ListChecks size={14} /> {completedTasks} de {goal.tasks.length} acciones</span>
          </div>

          <div className="goal-progress-row">
            <div className="goal-progress-track"><span style={{ width: `${progress}%` }} /></div>
            <strong>{progress}%</strong>
          </div>
        </div>

        <div className="goal-card-actions">
          <button className="goal-edit-button" onClick={() => onEditGoal(goal)} aria-label={`Editar logro ${goal.number}`}>
            <Pencil size={15} />
          </button>
          <button className={`expand-button ${open ? 'open' : ''}`} onClick={() => onToggleOpen(goal.id)} aria-expanded={open}>
            <ChevronDown size={19} />
            <span>{open ? 'Cerrar' : 'Ver plan'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="goal-details">
          {goal.identity && (
            <div className="identity-note">
              <span className="detail-label">Quién elijo ser</span>
              <p>{goal.identity}</p>
            </div>
          )}

          <div className="actions-section">
            <div className="detail-heading">
              <span>Acciones</span>
              <div className="detail-heading-actions">
                <small>{completedTasks}/{goal.tasks.length} listas</small>
                <button onClick={() => onAddTask(goal)}><Plus size={14} /> Agregar acción</button>
              </div>
            </div>
            {goal.tasks.length ? (
              <div className="task-list">
                {goal.tasks.map((task) => (
                  <div className={`task-row ${task.completed ? 'task-completed' : ''}`} key={task.id}>
                    <label className="task-toggle">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask(goal.id, task.id)}
                      />
                      <span className="task-checkbox"><Check size={14} strokeWidth={3} /></span>
                      <span className="task-copy">
                        <span>{task.text}</span>
                        {task.due && <small><Clock3 size={12} /> {task.due}</small>}
                      </span>
                    </label>
                    <button className="task-edit-button" onClick={() => onEditTask(goal, task)} aria-label="Editar acción">
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button className="empty-action" onClick={() => onAddTask(goal)}>
                <Plus size={16} /> Agregar la primera acción
              </button>
            )}
          </div>

          <div className="detail-grid">
            {goal.outcome && (
              <div className="outcome-note">
                <span className="detail-label">Lo que voy a tener</span>
                <p>{goal.outcome}</p>
              </div>
            )}
            <label className="notes-field">
              <span className="detail-label"><StickyNote size={14} /> Mi nota</span>
              <textarea
                value={goal.note}
                onChange={(event) => onNoteChange(goal.id, event.target.value)}
                placeholder="Escribe un avance, aprendizaje o recordatorio…"
                rows={3}
              />
            </label>
          </div>
        </div>
      )}
    </article>
  )
}

function ImportModal({ onClose, onImport }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const chooseFile = (selected) => {
    if (!selected) return
    if (!/\.(docx?|pdf|txt)$/i.test(selected.name)) {
      setError('Selecciona un documento Word .doc, .docx o PDF .pdf.')
      return
    }
    setFile(selected)
    setError('')
  }

  const submit = async () => {
    if (!file) {
      setError('Primero selecciona un documento.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const parsed = await readPlanDocument(file)
      const ownerName = parsed.ownerName?.trim() || ''
      onImport({ ...parsed, ownerName })
      onClose()
    } catch (importError) {
      setError(importError.message || 'No se pudo leer el documento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Documento local</span>
            <h2 id="import-title">Importar un Plan de Logros</h2>
            <p>Leeremos metas, acciones, fechas y áreas automáticamente.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="name-detection-note"><UserRound size={17} /> El nombre y el contrato se leerán directamente del documento.</div>

        <div
          className={`drop-zone ${file ? 'has-file' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            chooseFile(event.dataTransfer.files[0])
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".doc,.docx,.pdf,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            onChange={(event) => chooseFile(event.target.files[0])}
            hidden
          />
          {file ? <FileText size={30} /> : <Upload size={30} />}
          <strong>{file ? file.name : 'Arrastra tu documento aquí'}</strong>
          <span>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · listo para leer` : 'o toca para buscarlo en tu dispositivo'}</span>
          <small>Compatible con Word .doc, .docx y PDF .pdf</small>
        </div>

        <div className="replace-plan-note">
          <RotateCcw size={18} />
          <span>
            <strong>Un plan a la vez</strong>
            <small>Al importar este documento, reemplazará el plan que tienes actualmente.</small>
          </span>
        </div>

        {error && <div className="modal-error"><AlertCircle size={16} /> {error}</div>}

        <div className="privacy-line"><HardDrive size={15} /> El archivo se procesa en tu navegador; no se sube a internet.</div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" onClick={submit} disabled={loading || !file}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
            {loading ? 'Leyendo documento…' : 'Importar plan'}
          </button>
        </div>
      </section>
    </div>
  )
}

function EditNameModal({ currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName === 'Tu nombre' ? '' : currentName)
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('Escribe un nombre para continuar.')
      return
    }
    onSave(nextName)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="import-modal name-modal" role="dialog" aria-modal="true" aria-labelledby="edit-name-title" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Perfil del plan</span>
            <h2 id="edit-name-title">Editar nombre</h2>
            <p>Este nombre aparecerá en el menú y en la pestaña.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <label className="person-field">
          <span>Nombre de la persona</span>
          <div>
            <UserRound size={17} />
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="Ej. Jackielyn"
              maxLength={60}
              autoComplete="name"
              autoFocus
            />
          </div>
        </label>
        {error && <div className="modal-error"><AlertCircle size={16} /> {error}</div>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit"><Check size={18} /> Guardar nombre</button>
        </div>
      </form>
    </div>
  )
}

function GoalEditorModal({ initialGoal, categories, getNextNumber, onClose, onSave }) {
  const isEditing = Boolean(initialGoal.id)
  const [category, setCategory] = useState(initialGoal.category || '')
  const [number, setNumber] = useState(String(initialGoal.number || 1))
  const [meta, setMeta] = useState(initialGoal.meta || '')
  const [due, setDue] = useState(initialGoal.due || '')
  const [identity, setIdentity] = useState(initialGoal.identity || '')
  const [outcome, setOutcome] = useState(initialGoal.outcome || '')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!category.trim() || !meta.trim()) {
      setError('Completa el área y la meta del logro.')
      return
    }
    onSave({
      ...initialGoal,
      category: category.trim(),
      number: Math.max(1, Number(number) || 1),
      meta: meta.trim(),
      due: due.trim(),
      identity: identity.trim(),
      outcome: outcome.trim(),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="import-modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="goal-editor-title" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Plan editable</span>
            <h2 id="goal-editor-title">{isEditing ? 'Editar logro' : 'Nuevo logro'}</h2>
            <p>Actualiza la meta y los elementos principales del logro.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="editor-grid editor-grid-compact">
          <label className="editor-field">
            <span>Área de vida</span>
            <input value={category} onChange={(event) => {
              const nextCategory = event.target.value
              setCategory(nextCategory)
              if (!isEditing) setNumber(String(getNextNumber(nextCategory)))
              setError('')
            }} list="goal-category-options" placeholder="Ej. Dinero y Finanzas" autoFocus />
            <datalist id="goal-category-options">{categories.map((item) => <option value={item} key={item} />)}</datalist>
          </label>
          <label className="editor-field number-field">
            <span>Número</span>
            <input type="number" min="1" max="99" value={number} onChange={(event) => setNumber(event.target.value)} />
          </label>
        </div>

        <label className="editor-field">
          <span>Meta</span>
          <textarea value={meta} onChange={(event) => { setMeta(event.target.value); setError('') }} rows={3} placeholder="¿Qué quieres lograr?" />
        </label>
        <label className="editor-field">
          <span>Fecha</span>
          <input value={due} onChange={(event) => setDue(event.target.value)} placeholder="Ej. 30 de septiembre" />
        </label>
        <label className="editor-field">
          <span>Quién elijo ser</span>
          <textarea value={identity} onChange={(event) => setIdentity(event.target.value)} rows={2} placeholder="Ej. Responsable, constante y comprometida" />
        </label>
        <label className="editor-field">
          <span>Lo que voy a tener</span>
          <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={3} placeholder="Describe el resultado que quieres experimentar" />
        </label>

        {error && <div className="modal-error"><AlertCircle size={16} /> {error}</div>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit"><Check size={18} /> {isEditing ? 'Guardar cambios' : 'Crear logro'}</button>
        </div>
      </form>
    </div>
  )
}

function ActionEditorModal({ goal, task, onClose, onSave }) {
  const isEditing = Boolean(task)
  const [text, setText] = useState(task?.text || '')
  const [due, setDue] = useState(task?.due || '')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!text.trim()) {
      setError('Escribe la acción para continuar.')
      return
    }
    onSave(goal.id, { ...task, text: text.trim(), due: due.trim() })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="import-modal action-modal" role="dialog" aria-modal="true" aria-labelledby="action-editor-title" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Logro {goal.number}</span>
            <h2 id="action-editor-title">{isEditing ? 'Editar acción' : 'Nueva acción'}</h2>
            <p>{goal.meta}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <label className="editor-field">
          <span>Acción</span>
          <textarea value={text} onChange={(event) => { setText(event.target.value); setError('') }} rows={4} placeholder="Describe el siguiente paso" autoFocus />
        </label>
        <label className="editor-field">
          <span>Fecha</span>
          <input value={due} onChange={(event) => setDue(event.target.value)} placeholder="Ej. Desde el 04 de julio" />
        </label>
        {error && <div className="modal-error"><AlertCircle size={16} /> {error}</div>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit"><Check size={18} /> {isEditing ? 'Guardar acción' : 'Agregar acción'}</button>
        </div>
      </form>
    </div>
  )
}

function CreatorCredit({ open, onToggle }) {
  return (
    <div className="creator-credit">
      <button className="creator-trigger" onClick={onToggle} aria-label="Créditos del sistema" aria-expanded={open} title="Hay una historia detrás de esta app">
        <Sparkles size={17} />
      </button>
      {open && (
        <div className="creator-popover" role="status">
          <div className="creator-portrait">
            <img src={`${import.meta.env.BASE_URL}val-avatar.jpeg`} alt="Ilustración de Val" />
            <span className="creator-spark"><Sparkles size={15} /></span>
          </div>
          <div className="creator-copy">
            <span className="creator-kicker">Un pequeño secreto ✦</span>
            <strong>Hecho con cariño por Val</strong>
            <p>Para convertir sueños grandes en pasos que sí se pueden celebrar.</p>
            <a href="https://www.instagram.com/vale_null/" target="_blank" rel="noreferrer">
              <Instagram size={15} /> @vale_null
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyPlanWelcome({ onImport, onNewGoal }) {
  return (
    <section className="empty-plan-welcome" id="goals" aria-labelledby="empty-plan-title">
      <div className="empty-plan-visual" aria-hidden="true">
        <span className="empty-plan-glow" />
        <div className="floating-document floating-document-back">
          <span /><span /><span />
        </div>
        <div className="floating-document floating-document-front">
          <span className="document-icon"><FileText size={30} /></span>
          <span className="document-line document-line-long" />
          <span className="document-line" />
          <span className="document-line document-line-short" />
          <span className="document-check"><Check size={15} strokeWidth={3} /></span>
        </div>
        <span className="empty-spark empty-spark-one"><Sparkles size={22} /></span>
        <span className="empty-spark empty-spark-two"><Sparkles size={15} /></span>
      </div>

      <div className="empty-plan-copy">
        <span className="empty-plan-kicker"><Sparkles size={15} /> Tu espacio está listo</span>
        <h2 id="empty-plan-title">Tu ruta empieza<br />con tu documento.</h2>
        <p>Sube tu Plan de Logros y organizaremos automáticamente cada área, meta, acción y fecha en un checklist personal.</p>
        <div className="empty-plan-actions">
          <button className="primary-button empty-import-button" onClick={onImport}><Upload size={18} /> Importar mi plan</button>
          <button className="secondary-button" onClick={onNewGoal}><Plus size={18} /> Crear manualmente</button>
        </div>
        <div className="empty-plan-trust">
          <span><FileText size={15} /> Word o PDF</span>
          <span><ShieldCheck size={15} /> Solo en este dispositivo</span>
        </div>
        <ol className="empty-plan-steps">
          <li><strong>1</strong><span>Sube tu archivo</span></li>
          <li><strong>2</strong><span>Revisa tus logros</span></li>
          <li><strong>3</strong><span>Avanza a tu ritmo</span></li>
        </ol>
      </div>
    </section>
  )
}

export default function App() {
  const [plan, setPlan] = useState(loadState)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openGoals, setOpenGoals] = useState(() => new Set())
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [nameEditOpen, setNameEditOpen] = useState(false)
  const [goalEditor, setGoalEditor] = useState(null)
  const [actionEditor, setActionEditor] = useState(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const hasPlan = plan.goals.length > 0
  const personName = plan.ownerName?.trim() || 'Tu nombre'
  const contractTitle = plan.contract?.trim() || (hasPlan ? 'Mi Plan de Logros' : 'Empieza con tu Plan de Logros')
  const needsReimport = hasPlan && plan.sourceName !== 'Plan de Logros original' && plan.parserVersion !== DOCUMENT_PARSER_VERSION

  useEffect(() => {
    document.title = `${personName} · Plan de Logros`
  }, [personName])

  useEffect(() => {
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      const nextPlan = { ...plan, updatedAt: new Date().toISOString() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlan))
      setSaveStatus('saved')
    }, 250)
    return () => window.clearTimeout(timer)
  }, [plan])

  const stats = useMemo(() => {
    const totalTasks = plan.goals.reduce((sum, goal) => sum + goal.tasks.length, 0)
    const completedTasks = plan.goals.reduce((sum, goal) => sum + goal.tasks.filter((task) => task.completed).length, 0)
    const completedGoals = plan.goals.filter((goal) => goal.completed).length
    const percent = totalTasks
      ? Math.round((completedTasks / totalTasks) * 100)
      : Math.round((completedGoals / Math.max(plan.goals.length, 1)) * 100)
    return { total: plan.goals.length, completedGoals, totalTasks, completedTasks, percent }
  }, [plan.goals])

  const categories = useMemo(() => {
    const groups = new Map()
    plan.goals.forEach((goal) => {
      const current = groups.get(goal.category) || { name: goal.category, total: 0, completed: 0 }
      current.total += 1
      current.completed += goal.completed ? 1 : 0
      groups.set(goal.category, current)
    })
    return Array.from(groups.values())
  }, [plan.goals])

  const filteredGoals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    return plan.goals.filter((goal) => {
      const categoryMatch = selectedCategory === 'all' || goal.category === selectedCategory
      const statusMatch = statusFilter === 'all' || (statusFilter === 'completed' ? goal.completed : !goal.completed)
      const searchMatch = !normalizedQuery || [goal.meta, goal.category, goal.identity, goal.outcome, ...goal.tasks.map((task) => task.text)]
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(normalizedQuery)
      return categoryMatch && statusMatch && searchMatch
    })
  }, [plan.goals, query, selectedCategory, statusFilter])

  const groupedGoals = useMemo(() => {
    const grouped = new Map()
    filteredGoals.forEach((goal) => {
      if (!grouped.has(goal.category)) grouped.set(goal.category, [])
      grouped.get(goal.category).push(goal)
    })
    return Array.from(grouped.entries())
  }, [filteredGoals])

  const nextAction = useMemo(() => {
    for (const goal of plan.goals) {
      if (goal.completed) continue
      const task = goal.tasks.find((item) => !item.completed)
      if (task) return { goal, task }
    }
    return null
  }, [plan.goals])

  const toggleGoal = (goalId) => {
    setPlan((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) return goal
        const completed = !goal.completed
        return { ...goal, completed, tasks: goal.tasks.map((task) => ({ ...task, completed })) }
      }),
    }))
  }

  const toggleTask = (goalId, taskId) => {
    setPlan((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) return goal
        const tasks = goal.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task)
        return { ...goal, tasks, completed: tasks.length > 0 && tasks.every((task) => task.completed) }
      }),
    }))
  }

  const updateNote = (goalId, note) => {
    setPlan((current) => ({
      ...current,
      goals: current.goals.map((goal) => goal.id === goalId ? { ...goal, note } : goal),
    }))
  }

  const toggleOpen = (goalId) => {
    setOpenGoals((current) => {
      const next = new Set(current)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  const toggleCategory = (category) => {
    setCollapsedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const importPlan = (parsed) => {
    const importedGoals = prepareGoals(parsed.goals)
    setPlan({
      title: parsed.title,
      ownerName: parsed.ownerName,
      contract: parsed.contract,
      sourceName: parsed.title,
      parserVersion: parsed.parserVersion,
      goals: importedGoals,
      updatedAt: new Date().toISOString(),
    })
    setSelectedCategory('all')
    setStatusFilter('all')
    setQuery('')
    setOpenGoals(new Set())
    setCollapsedCategories(new Set())
  }

  const updateOwnerName = (ownerName) => {
    setPlan((current) => ({ ...current, ownerName }))
  }

  const sameCategory = (first, second) => (
    first.trim().localeCompare(second.trim(), 'es', { sensitivity: 'base' }) === 0
  )

  const getNextGoalNumber = (category) => (
    Math.max(0, ...plan.goals.filter((goal) => sameCategory(goal.category, category)).map((goal) => Number(goal.number) || 0)) + 1
  )

  const openNewGoal = () => {
    const category = selectedCategory !== 'all' ? selectedCategory : (categories[0]?.name || 'Importado')
    const number = getNextGoalNumber(category)
    setGoalEditor({ category, number, meta: '', due: '', identity: '', outcome: '', tasks: [] })
  }

  const saveGoal = (draft) => {
    const category = categories.find((item) => sameCategory(item.name, draft.category))?.name || draft.category
    const normalizedDraft = { ...draft, category }

    if (draft.id) {
      setPlan((current) => ({
        ...current,
        goals: current.goals.map((goal) => goal.id === draft.id ? { ...goal, ...normalizedDraft } : goal),
      }))
      return
    }

    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const goal = prepareGoals([{ ...normalizedDraft, id, completed: false, note: '', tasks: [] }])[0]
    setPlan((current) => ({ ...current, goals: [...current.goals, goal] }))
    setOpenGoals((current) => new Set(current).add(id))
  }

  const saveAction = (goalId, draft) => {
    setPlan((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) return goal
        if (draft.id) {
          return { ...goal, tasks: goal.tasks.map((task) => task.id === draft.id ? { ...task, ...draft } : task) }
        }
        const task = {
          ...draft,
          id: `${goalId}-accion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          completed: false,
        }
        return { ...goal, completed: false, tasks: [...goal.tasks, task] }
      }),
    }))
  }

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `respaldo-plan-logros-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const resetPlan = () => {
    if (!window.confirm('¿Vaciar este plan? Se eliminarán sus logros, checks y notas guardados en este navegador.')) return
    setPlan(createDefaultState())
    setSelectedCategory('all')
    setStatusFilter('all')
    setQuery('')
    setOpenGoals(new Set())
  }

  const dateLabel = capitalize(new Intl.DateTimeFormat('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()))

  return (
    <div className="app-shell">
      <Sidebar
        personName={personName}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onEditName={() => setNameEditOpen(true)}
        onImport={() => setImportOpen(true)}
        onBackup={downloadBackup}
        onReset={resetPlan}
        stats={stats}
        hasPlan={hasPlan}
      />

      <main className="main-content">
        <div className="content-wrap">
          <header className="page-header">
            <div className="appbar-contract">
              <p className="today-label"><span>{hasPlan ? 'Mi contrato' : 'Bienvenida'}</span> · {dateLabel}</p>
              <h1 title={contractTitle}>{contractTitle}</h1>
            </div>
            <div className="header-actions">
              <div className="save-state" aria-live="polite">
                {saveStatus === 'saving' ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}
                {saveStatus === 'saving' ? 'Guardando…' : 'Guardado localmente'}
              </div>
              <button className="secondary-button appbar-action" onClick={openNewGoal}><Plus size={17} /> <span>Nuevo logro</span></button>
              <button className="primary-button appbar-action" onClick={() => setImportOpen(true)}><Upload size={17} /> <span>Importar</span></button>
              <button className="icon-button appbar-icon" onClick={() => setNameEditOpen(true)} aria-label={`Editar nombre: ${personName}`} title={personName}><UserRound size={17} /></button>
              <CreatorCredit open={creatorOpen} onToggle={() => setCreatorOpen((current) => !current)} />
            </div>
          </header>

          {needsReimport && (
            <section className="parser-warning" aria-live="polite">
              <AlertCircle size={19} />
              <div>
                <strong>Este plan sigue usando el lector anterior</strong>
                <span>Vuelve a importar el archivo para reconstruir todos los logros y acciones correctamente.</span>
              </div>
              <button className="secondary-button" onClick={() => setImportOpen(true)}>Reimportar ahora</button>
            </section>
          )}

          {hasPlan ? <>
          <section className="hero-card" aria-label="Resumen de progreso">
            <div className="hero-copy">
              <span className="hero-kicker"><Sparkles size={15} /> Tu progreso</span>
              <h2>Construyendo la vida<br />que se siente tuya.</h2>
              <p>Ya completaste <strong>{stats.completedTasks} de {stats.totalTasks} acciones</strong>. El foco no está en hacerlo perfecto, sino en seguir avanzando.</p>
              {nextAction ? (
                <button
                  className="next-action-button"
                  onClick={() => {
                    setOpenGoals((current) => new Set(current).add(nextAction.goal.id))
                    window.setTimeout(() => document.getElementById(nextAction.goal.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
                  }}
                >
                  Ver mi próximo paso <ArrowRight size={17} />
                </button>
              ) : (
                <span className="all-done"><CheckCircle2 size={17} /> ¡Plan completado!</span>
              )}
            </div>
            <div className="hero-progress">
              <ProgressRing value={stats.percent} />
              <div className="hero-mini-stats">
                <div><strong>{stats.completedGoals}</strong><span>logros listos</span></div>
                <div><strong>{stats.total - stats.completedGoals}</strong><span>por conquistar</span></div>
              </div>
            </div>
            <span className="hero-orb hero-orb-one" />
            <span className="hero-orb hero-orb-two" />
          </section>

          {nextAction && (
            <section className="focus-strip">
              <span className="focus-icon"><Target size={19} /></span>
              <div>
                <span className="detail-label">Próximo paso sugerido</span>
                <p>{nextAction.task.text}</p>
              </div>
              {nextAction.task.due && <span className="focus-date"><CalendarDays size={14} /> {nextAction.task.due}</span>}
            </section>
          )}

          <section className="goals-section" id="goals">
            <div className="section-heading-row">
              <div>
                <span className="section-kicker">Checklist</span>
                <h2>Mis logros</h2>
              </div>
              <span className="result-count">{filteredGoals.length} {filteredGoals.length === 1 ? 'logro' : 'logros'}</span>
            </div>

            <div className="toolbar">
              <div className="status-tabs" role="tablist" aria-label="Filtrar por estado">
                <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>Todos</button>
                <button className={statusFilter === 'pending' ? 'active' : ''} onClick={() => setStatusFilter('pending')}>Pendientes</button>
                <button className={statusFilter === 'completed' ? 'active' : ''} onClick={() => setStatusFilter('completed')}>Completados</button>
              </div>
              <label className="search-field">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un logro…" />
                {query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
              </label>
            </div>

            <div className="mobile-category-scroll" aria-label="Filtrar por área">
              <button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => setSelectedCategory('all')}>Todas</button>
              {categories.map((category) => {
                const style = getCategoryStyle(category.name)
                return <button key={category.name} className={selectedCategory === category.name ? 'active' : ''} onClick={() => setSelectedCategory(category.name)}>{style.label}</button>
              })}
            </div>

            {groupedGoals.length ? groupedGoals.map(([category, goals]) => {
              const style = getCategoryStyle(category)
              const Icon = style.Icon
              const collapsed = collapsedCategories.has(category)
              return (
                <section className={`category-section ${collapsed ? 'collapsed' : ''}`} key={category}>
                  <button
                    className="category-heading"
                    style={{ '--category-color': style.color, '--category-soft': style.soft }}
                    onClick={() => toggleCategory(category)}
                    aria-expanded={!collapsed}
                    aria-controls={`category-${slugify(category)}`}
                  >
                    <span className="category-heading-icon"><Icon size={18} /></span>
                    <h3>{style.label}</h3>
                    <div className="category-line" />
                    <small>{goals.filter((goal) => goal.completed).length}/{goals.length} completos</small>
                    <ChevronDown className="category-chevron" size={18} />
                  </button>
                  <div className="goal-list" id={`category-${slugify(category)}`} hidden={collapsed}>
                    {goals.map((goal) => (
                      <div id={goal.id} key={goal.id}>
                        <GoalCard
                          goal={goal}
                          onToggleGoal={toggleGoal}
                          onToggleTask={toggleTask}
                          onNoteChange={updateNote}
                          onEditGoal={setGoalEditor}
                          onAddTask={(selectedGoal) => setActionEditor({ goal: selectedGoal, task: null })}
                          onEditTask={(selectedGoal, task) => setActionEditor({ goal: selectedGoal, task })}
                          open={openGoals.has(goal.id)}
                          onToggleOpen={toggleOpen}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            }) : (
              <div className="empty-state">
                <span><Search size={24} /></span>
                <h3>No encontramos logros</h3>
                <p>Prueba con otra búsqueda o cambia los filtros.</p>
                <button className="secondary-button" onClick={() => { setQuery(''); setStatusFilter('all'); setSelectedCategory('all') }}>Limpiar filtros</button>
              </div>
            )}
          </section>
          </> : (
            <EmptyPlanWelcome onImport={() => setImportOpen(true)} onNewGoal={openNewGoal} />
          )}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Home size={20} /><span>Inicio</span></button>
        <button onClick={() => document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' })}><ListChecks size={20} /><span>Logros</span></button>
        <button className="bottom-import" onClick={() => setImportOpen(true)}><Upload size={21} /><span>Importar</span></button>
        <button onClick={() => setNameEditOpen(true)}><UserRound size={20} /><span>Perfil</span></button>
      </nav>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={importPlan} />}
      {nameEditOpen && <EditNameModal currentName={personName} onClose={() => setNameEditOpen(false)} onSave={updateOwnerName} />}
      {goalEditor && <GoalEditorModal initialGoal={goalEditor} categories={categories.map((category) => category.name)} getNextNumber={getNextGoalNumber} onClose={() => setGoalEditor(null)} onSave={saveGoal} />}
      {actionEditor && <ActionEditorModal goal={actionEditor.goal} task={actionEditor.task} onClose={() => setActionEditor(null)} onSave={saveAction} />}
    </div>
  )
}

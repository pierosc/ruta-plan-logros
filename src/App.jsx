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
  Leaf,
  ListChecks,
  LoaderCircle,
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
import { readPlanDocument } from './utils/documentParser.js'

const STORAGE_KEY = 'ruta-logros-state-v1'

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
  title: DEFAULT_PLAN_TITLE,
  ownerName: '',
  sourceName: 'Plan de Logros original',
  goals: prepareGoals(DEFAULT_PLAN),
  updatedAt: new Date().toISOString(),
})

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.goals?.length) return { ...saved, goals: prepareGoals(saved.goals) }
  } catch {
    // If a previous local backup is corrupt, the original plan is restored safely.
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

function Sidebar({ personName, categories, selectedCategory, onSelectCategory, onImport, onBackup, onReset, stats }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Check size={20} strokeWidth={3} /></span>
        <span title={personName}>{personName}</span>
      </div>

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
            <strong>Importar otro plan</strong>
            <small>Word o PDF</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <div className="utility-actions">
          <button onClick={onBackup}><Download size={15} /> Respaldo</button>
          <button onClick={onReset}><RotateCcw size={15} /> Restaurar</button>
        </div>
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

function GoalCard({ goal, onToggleGoal, onToggleTask, onNoteChange, open, onToggleOpen }) {
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

        <button className={`expand-button ${open ? 'open' : ''}`} onClick={() => onToggleOpen(goal.id)} aria-expanded={open}>
          <ChevronDown size={19} />
          <span>{open ? 'Cerrar' : 'Ver plan'}</span>
        </button>
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
              <small>{completedTasks}/{goal.tasks.length} listas</small>
            </div>
            {goal.tasks.length ? (
              <div className="task-list">
                {goal.tasks.map((task) => (
                  <label className={`task-row ${task.completed ? 'task-completed' : ''}`} key={task.id}>
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
                ))}
              </div>
            ) : (
              <button className="empty-action" onClick={() => onToggleGoal(goal.id)}>
                <Plus size={16} /> Usa el check principal para completar este logro
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

function ImportModal({ currentOwnerName, onClose, onImport }) {
  const [file, setFile] = useState(null)
  const [personName, setPersonName] = useState(currentOwnerName || '')
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
      const ownerName = personName.trim() || parsed.ownerName?.trim()
      if (!ownerName) {
        setError('Escribe el nombre de la persona a quien pertenece este plan.')
        return
      }
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

        <label className="person-field">
          <span>Nombre de la persona</span>
          <div>
            <UserRound size={17} />
            <input
              type="text"
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="Ej. Andrea"
              maxLength={60}
              autoComplete="name"
            />
          </div>
          <small>Se mostrará en el menú y en la pestaña. Si el documento lo incluye, podemos detectarlo.</small>
        </label>

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

export default function App() {
  const [plan, setPlan] = useState(loadState)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openGoals, setOpenGoals] = useState(() => new Set())
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const personName = plan.ownerName?.trim() || 'Tu nombre'

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
      const searchMatch = !normalizedQuery || [goal.meta, goal.category, goal.identity, goal.outcome]
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
      sourceName: parsed.title,
      goals: importedGoals,
      updatedAt: new Date().toISOString(),
    })
    setSelectedCategory('all')
    setStatusFilter('all')
    setQuery('')
    setOpenGoals(new Set())
    setCollapsedCategories(new Set())
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
    if (!window.confirm('¿Restaurar el plan original? Se reemplazarán los checks y notas guardados en este navegador.')) return
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
        onImport={() => setImportOpen(true)}
        onBackup={downloadBackup}
        onReset={resetPlan}
        stats={stats}
      />

      <header className="mobile-header">
        <div className="brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span title={personName}>{personName}</span></div>
        <button className="icon-button" onClick={() => setImportOpen(true)} aria-label="Importar documento"><Upload size={19} /></button>
      </header>

      <main className="main-content">
        <div className="content-wrap">
          <header className="page-header">
            <div>
              <p className="today-label">{dateLabel}</p>
              <h1>{plan.title}</h1>
              <p className="page-subtitle">Avanza con calma. Cada acción cuenta.</p>
            </div>
            <div className="header-actions">
              <div className="save-state" aria-live="polite">
                {saveStatus === 'saving' ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}
                {saveStatus === 'saving' ? 'Guardando…' : 'Guardado localmente'}
              </div>
              <button className="primary-button desktop-import" onClick={() => setImportOpen(true)}><Upload size={17} /> Importar documento</button>
            </div>
          </header>

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
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Home size={20} /><span>Inicio</span></button>
        <button onClick={() => document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' })}><ListChecks size={20} /><span>Logros</span></button>
        <button className="bottom-import" onClick={() => setImportOpen(true)}><Upload size={21} /><span>Importar</span></button>
      </nav>

      {importOpen && <ImportModal currentOwnerName={plan.ownerName} onClose={() => setImportOpen(false)} onImport={importPlan} />}
    </div>
  )
}

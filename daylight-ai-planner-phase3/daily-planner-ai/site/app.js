import {
  DAYS,
  DEFAULT_PLANNER_CONFIG,
  dayMetrics,
  detectConflicts,
  planWeek,
  replanDayFromNow,
  toMinutes,
  weekDiagnostics,
} from './planner-engine.js'
import {
  INTAKE_TYPES,
  normalizeIntakeAnalysis,
  applyIntakeAnalysis,
  localIntakeFallback,
  createIntakeCapture,
  finishIntakeCapture,
} from './intake.js'
import { normalizeGoalBreakdown, starterGoalBreakdown } from './goal-breakdown.js'
import { captureQuestions, resolveQuestion, describeOperation } from './planning-memory.js'
import { DAY_MODES, MODE_LABELS, MODE_HINTS, modeForDay, configForDayModes } from './day-modes.js'
import { finishWork, reopenWork, skipWork, resumeWork, setActualTime } from './work-signals.js'
import { durationSuggestion } from './duration-learning.js'
import { workPattern } from './work-patterns.js'
import { sameCloudPayload } from './cloud-compare.js'
import { getUser, login, logout, handleAuthCallback, acceptInvite } from '@netlify/identity'

const STORAGE_KEY = 'daylight-planner-v03-static'
const LEGACY_STORAGE_KEY = 'daylight-planner-v02-static'
const HISTORY_STORAGE_KEY = 'daylight-history-v1'
const CONVERSATION_STORAGE_KEY = 'daylight-conversation-v1'
const HISTORY_LIMIT = 20

const morningSteps = () => [
  'Get up when the alarm goes off',
  'Make bed',
  'Make breakfast for me and Mom',
  'Go say hi to Mom',
  'Brush teeth',
  'Wash face + cream',
  'Apply minoxidil',
  'Hair + beard check',
].map((title, index) => ({ id: `morning-${index}`, title, completed: false }))

const initialState = {
  version: 3,
  plannerConfig: clone(DEFAULT_PLANNER_CONFIG),
  dayModes: {},
  items: [
    fixed('mon-matt','Matt','Monday','08:30','10:00',{ bufferBefore:15, locationType:'school' }),
    fixed('mon-motion','Motion 3D','Monday','19:15','21:45',{ bufferBefore:15, locationType:'school', note:'7:15 interpreted as PM — confirm if needed.' }),
    fixed('tue-music','Music class','Tuesday','08:30','10:00',{ bufferBefore:15, locationType:'school' }),
    fixed('tue-chad','Chad','Tuesday','12:45','15:30',{ bufferBefore:15, locationType:'school' }),
    fixed('wed-matt','Matt','Wednesday','08:30','10:00',{ bufferBefore:15, locationType:'school' }),
    fixed('wed-motion','Motion 3D','Wednesday','19:15','21:45',{ bufferBefore:15, locationType:'school', note:'7:15 interpreted as PM — confirm if needed.' }),
    fixed('thu-chad','Chad','Thursday','12:45','15:30',{ bufferBefore:15, locationType:'school' }),
    ...DAYS.map((day, index) => ({
      id:`morning-${index}`,
      title:'Morning reset',
      day,
      start:'07:00',
      end:'08:00',
      durationMinutes:60,
      kind:'routine',
      completed:false,
      flexible:false,
      locked:true,
      subtasks: morningSteps().map(s => ({...s,id:`${day}-${s.id}`})),
    })),
    task('mon-homework','Homework','Monday','16:00','18:00',120,{ deadlineDay:'Monday', priority:3, splittable:true, minBlockMinutes:30, preferredWindow:{start:'10:15',end:'21:00'} }),
    task('tue-homework','Homework','Tuesday','16:00','18:00',120,{ deadlineDay:'Tuesday', priority:3, splittable:true, minBlockMinutes:30, preferredWindow:{start:'10:15',end:'21:00'} }),
    task('wed-homework','Homework','Wednesday','16:00','18:00',120,{ deadlineDay:'Wednesday', priority:3, splittable:true, minBlockMinutes:30, preferredWindow:{start:'10:15',end:'18:45'} }),
    task('thu-homework','Homework','Thursday','16:30','18:30',120,{ deadlineDay:'Thursday', priority:3, splittable:true, minBlockMinutes:30, preferredWindow:{start:'08:15',end:'21:00'} }),
    task('fri-homework','Homework','Friday','10:30','12:30',120,{ deadlineDay:'Friday', priority:2, splittable:true, minBlockMinutes:30, preferredWindow:{start:'08:00',end:'20:00'} }),
    task('wed-reflect','Positive reset + write thoughts','Wednesday','18:15','18:35',20,{ priority:1, splittable:false, preferredWindow:{start:'10:00',end:'19:00'}, kind:'reflection' }),
  ],
  goals: [
    { id:'gym', title:'Gym', cadence:'This week', progress:0, target:3, unit:'sessions', minimumDurationMinutes:45 },
    { id:'homework', title:'Homework', cadence:'Daily', progress:0, target:2, unit:'hours today' },
    { id:'points', title:'School points', cadence:'Before leaving', progress:0, target:4000, unit:'points' },
  ],
  metrics: [],
  openLoops: [
    { id:'career-loop', title:'Figure out next concrete step toward design internship', status:'open', details:'Keep as an open loop until it has a concrete next action.' },
  ],
  inbox: [],
  questions: [],
  operationLog: [],
  workLog: [],
  learningChoices: [],
  rules: [
    { id:'wake', text:'Wake up at 7:00 AM.' },
    { id:'sleep', text:'If waking at 7:00 AM, aim to be in bed between 10:30 and 11:00 PM.' },
    { id:'school-arrival', text:'Arrive at school at least 15 minutes early.' },
    { id:'gym-rule', text:'Go to the gym at least 3 times per week, for at least 45 minutes.' },
    { id:'homework-rule', text:'Plan about 2 hours of homework each day.' },
    { id:'open-time', text:'Do not automatically fill all available time. Preserve intentional free time.' },
  ],
  lastPlan: null,
}

function fixed(id,title,day,start,end,extra={}) { return { id,title,day,start,end,kind:'event',completed:false,flexible:false,locked:true,...extra } }
function task(id,title,day,start,end,durationMinutes,extra={}) { return { id,title,day,start,end,durationMinutes,kind:'task',completed:false,flexible:true,priority:2,splittable:false,minBlockMinutes:30,...extra } }
function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

function migrate(saved) {
  if (!saved || typeof saved !== 'object') return clone(initialState)
  const next = clone(saved)
  next.version = 3
  next.plannerConfig ||= clone(DEFAULT_PLANNER_CONFIG)
  next.dayModes ||= {}
  next.items ||= []
  next.goals ||= []
  next.rules ||= []
  next.metrics ||= []
  next.openLoops ||= []
  next.inbox ||= []
  next.questions ||= []
  next.operationLog ||= []
  next.workLog ||= []
  next.learningChoices ||= []
  return next
}
function load() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (current) return migrate(current)
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY))
    if (legacy) return migrate(legacy)
    return clone(initialState)
  } catch { return clone(initialState) }
}
let pendingOperation = null
function save() {
  if(pendingOperation){
    const prior=Array.isArray(state.operationLog)&&state.operationLog.length?state.operationLog:pendingOperation.before.operationLog||[]
    state.operationLog=[...prior,{id:pendingOperation.id,label:pendingOperation.label,at:pendingOperation.at,summary:describeOperation(pendingOperation.before,state)}].slice(-100)
    pendingOperation=null
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); queueCloudSave()
}
function loadHistory() {
  try {
    const saved=JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))
    return Array.isArray(saved)?saved.filter(entry=>entry&&typeof entry.label==='string'&&entry.state&&typeof entry.state==='object').slice(-HISTORY_LIMIT):[]
  } catch { return [] }
}
function saveHistory() {
  while(undoStack.length){
    try { localStorage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(undoStack));queueCloudSave();return }
    catch { undoStack.shift() }
  }
  try { localStorage.removeItem(HISTORY_STORAGE_KEY) } catch { /* Storage may be unavailable. */ }
}
function loadConversation() {
  try {
    const saved=JSON.parse(localStorage.getItem(CONVERSATION_STORAGE_KEY))
    return Array.isArray(saved)?saved.filter(turn=>['user','assistant'].includes(turn?.role)&&typeof turn.text==='string').slice(-30):[]
  } catch { return [] }
}
function saveConversation() {
  try { localStorage.setItem(CONVERSATION_STORAGE_KEY,JSON.stringify(messages.slice(-30).map(({id,role,text,error})=>({id,role,text,error:!!error}))));queueCloudSave() }
  catch { /* The planner remains usable if browser storage is full. */ }
}
function exportBackup() {
  const backup={format:'daylight-backup-v2',exportedAt:new Date().toISOString(),state,history:undoStack,conversation:cloudPayload().conversation}
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}))
  const link=document.createElement('a')
  link.href=url
  link.download=`daylight-backup-${new Date().toISOString().slice(0,10)}.json`
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function importBackup(event) {
  const file=event.target.files?.[0]
  if(!file)return
  try {
    if(file.size>5_000_000)throw new Error('Backup is too large.')
    const backup=JSON.parse(await file.text())
    if(!['daylight-backup-v1','daylight-backup-v2'].includes(backup?.format)||!backup.state||!Array.isArray(backup.state.items)||!Array.isArray(backup.state.rules))throw new Error('This is not a Daylight backup.')
    const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)
    const safeTime=value=>!value||typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    if(backup.state.items.length>5000||backup.state.items.some(item=>!safeId(item?.id)||!['event','task','routine','reflection','buffer'].includes(item.kind)||!DAYS.includes(item.day)||!safeTime(item.start)||!safeTime(item.end)||item.subtasks?.some(step=>!safeId(step?.id))))throw new Error('Backup has invalid planner items.')
    for(const collection of [backup.state.goals||[],backup.state.metrics||[]])if(!Array.isArray(collection)||collection.some(item=>!item||!Number.isFinite(Number(item.progress||0))||!Number.isFinite(Number(item.target||0))))throw new Error('Backup has invalid goals or metrics.')
    if(backup.format==='daylight-backup-v2'&&(!Array.isArray(backup.history)||backup.history.length>HISTORY_LIMIT||!Array.isArray(backup.conversation)||backup.conversation.length>30))throw new Error('Backup history is invalid.')
    if(!confirm(`Replace this device’s planner with the backup from ${new Date(backup.exportedAt).toLocaleString()}? You can undo this import from History.`))return
    const previousState=clone(state)
    pushUndo('Before backup import')
    state=migrate(backup.state)
    if(backup.format==='daylight-backup-v2'){
      undoStack=backup.history.filter(entry=>entry&&typeof entry.label==='string'&&entry.state&&typeof entry.state==='object')
      undoStack.push({label:'Before backup import',at:new Date().toISOString(),state:previousState})
      undoStack=undoStack.slice(-HISTORY_LIMIT)
      messages=backup.conversation.filter(turn=>['user','assistant'].includes(turn?.role)&&typeof turn.text==='string')
      saveHistory()
    }
    save()
    messages.push({id:uid(),role:'assistant',text:'Backup imported. Your previous planner is available through Undo.'})
    render()
  } catch(error) {
    messages.push({id:uid(),role:'assistant',text:error.message||'The backup could not be imported.',error:true})
    render()
  }
}
function detroitDay() {
  const d = new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'America/Detroit'}).format(new Date())
  return DAYS.includes(d) ? d : 'Monday'
}
function detroitMinutes() {
  const parts = new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Detroit'}).formatToParts(new Date())
  const h = Number(parts.find(p=>p.type==='hour')?.value || 0)
  const m = Number(parts.find(p=>p.type==='minute')?.value || 0)
  return h*60+m
}

let state = load()
let undoStack = loadHistory()
let selectedDay = detroitDay()
let view = 'today'
let chatOpen = true
let sending = false
let intakeSending = false
let voiceSession = null
let voiceTarget = ''
let readRepliesAloud = false
try { readRepliesAloud = localStorage.getItem('daylight-read-replies') === 'true' } catch { /* Browser storage may be unavailable. */ }
let brainDumpText = ''
let intakeDraft = null
let intakeCaptureId = null
let goalDraft = null
let activeQuestionId = null
let messages = loadConversation()
if(!messages.length)messages=[{ id:'hello', role:'assistant', text:"Tell me what changed, what you need to get done, or how you're feeling about the day. I’ll interpret it, then the planning engine will find feasible time." }]
let accountUser = null
let accountStatus = 'Checking sign-in…'
let accountError = ''
let inviteToken = ''
let cloudCopy = null
let cloudRevision = 0
let cloudReady = false
let cloudSaveTimer = 0
let cloudSaving = false
let cloudSaveQueued = false
let lastSyncedPayload = ''
let cloudSnapshots = null
let snapshotBusy = false
let snapshotNotice = ''
let accountPanelOpen = !window.matchMedia('(max-width: 900px)').matches

const app = document.querySelector('#app')

function render() {
  saveConversation()
  const main = view === 'today' ? todayView() : view === 'week' ? weekView() : view === 'goals' ? goalsView() : view === 'history' ? historyView() : inboxView()
  app.innerHTML = `<div class="app-shell">
    ${sidebar()}
    <main class="main-panel">${main}</main>
    ${assistantPanel()}
  </div>`
  bindEvents()
  requestAnimationFrame(() => document.querySelector('.chat-thread')?.scrollTo(0, 1e9))
}

function sidebar() {
  const inboxPending = state.inbox.filter(i => i.review?.items?.length).length
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-dot"></span>Daylight <span class="phase-pill">M4</span></div>
    <nav>
      ${navButton('today','☀','Today')}
      ${navButton('week','▦','Week')}
      ${navButton('goals','◎','Goals')}
      ${navButton('inbox','⌁',`Inbox${inboxPending?` · ${inboxPending}`:''}`)}
      ${navButton('history','↶','History')}
    </nav>
    <div class="sidebar-spacer"></div>
    <details class="account-details" ${accountPanelOpen||inviteToken||cloudCopy?'open':''}><summary>${inviteToken?'Accept invitation':accountUser?'Account':'Cloud sync'}</summary>${accountControls()}</details>
    <div class="mini-label">Planning memory</div>
    <div class="rule-preview">${state.rules.length} rules · ${state.openLoops.length} open loops</div>
    <button class="ghost-button" data-action="undo" ${undoStack.length?'':'disabled'}><span class="icon">↶</span> Undo planner change</button>
    <button class="ghost-button" data-action="reset"><span class="icon">↺</span> Reset prototype</button>
  </aside>`
}
function accountControls() {
  if(inviteToken)return `<form class="account-box" id="invite-form"><strong>Accept invitation</strong><p>Choose a password to create your private Daylight account.</p><label for="invite-password">Password</label><input id="invite-password" type="password" autocomplete="new-password" required minlength="8"><button type="submit">Create account</button>${accountError?`<small role="alert">${esc(accountError)}</small>`:''}</form>`
  if(!accountUser)return `<form class="account-box" id="login-form"><strong>Cloud sync</strong><p>${esc(accountStatus)}</p><label for="login-email">Email</label><input id="login-email" type="email" autocomplete="username" required><label for="login-password">Password</label><input id="login-password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button>${accountError?`<small role="alert">${esc(accountError)}</small>`:''}</form>`
  return `<div class="account-box"><strong>${esc(accountUser.email||'Signed in')}</strong><p>${esc(accountStatus)}</p>${cloudCopy?`<div class="account-choice">${cloudCopy.exists?'<button data-action="use-cloud">Use cloud plan</button>':''}<button data-action="use-local">Move this device’s plan to cloud</button></div>`:''}<button class="account-quiet" data-action="sign-out">Sign out</button><button class="account-quiet danger" data-action="delete-cloud">Delete cloud copy</button>${accountError?`<small role="alert">${esc(accountError)}</small>`:''}</div>`
}

function cloudPayload() {
  return {state,history:undoStack,conversation:messages.slice(-30).map(({id,role,text,error})=>({id,role,text,error:!!error}))}
}
function queueCloudSave() {
  if(!cloudReady || !accountUser)return
  if(JSON.stringify(cloudPayload())===lastSyncedPayload)return
  clearTimeout(cloudSaveTimer)
  cloudSaveTimer=setTimeout(saveToCloud,1200)
}
async function saveToCloud(force=false) {
  if(!accountUser || (!cloudReady && !force))return
  if(cloudSaving){cloudSaveQueued=true;return}
  const snapshot=cloudPayload()
  const snapshotText=JSON.stringify(snapshot)
  if(!force&&snapshotText===lastSyncedPayload)return
  cloudSaving=true
  const payload={...snapshot,expectedRevision:cloudRevision,force,label:undoStack.at(-1)?.label||'Saved planner'}
  try {
    const response=await fetch('/api/planner-state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
    const result=await response.json()
    if(response.status===409){cloudReady=false;accountStatus='Another device changed your plan. Choose which copy to keep.';accountError='Automatic sync paused to protect your changes.';await loadCloudCopy()}
    else if(!response.ok)throw new Error(result.error||'Cloud save failed. Your changes are still saved on this device.')
    else {cloudRevision=result.revision;lastSyncedPayload=snapshotText;cloudCopy=null;cloudReady=true;accountStatus='Synced across your devices';accountError='';renderAccountStatus();if(JSON.stringify(cloudPayload())!==snapshotText)cloudSaveQueued=true}
  } catch(error){accountStatus='Saved on this device. Cloud sync will retry.';accountError=error.message;renderAccountStatus()}
  finally {cloudSaving=false;if(cloudSaveQueued){cloudSaveQueued=false;queueCloudSave()}}
}
function renderAccountStatus(){const box=document.querySelector('.account-box');if(box&&accountUser){box.querySelector('p').textContent=accountStatus;let alert=box.querySelector('[role="alert"]');if(accountError&&!alert){alert=document.createElement('small');alert.setAttribute('role','alert');box.append(alert)}if(alert)alert.textContent=accountError}}
async function loadCloudCopy() {
  accountStatus='Checking your cloud plan…';accountError='';render()
  try {
    const response=await fetch('/api/planner-state',{cache:'no-store'})
    if(!response.ok)throw new Error(response.status===401?'Please sign in again.':'Cloud storage is temporarily unavailable.')
    const remote=await response.json()
    if(!remote.exists){cloudCopy={exists:false};cloudRevision=0;accountStatus='Your plan is saved on this device. Move it to cloud to sync.'}
    else {
      cloudRevision=remote.revision
      const localExists=!!localStorage.getItem(STORAGE_KEY)
      if(!localExists || sameCloudPayload(cloudPayload(),{state:remote.state,history:remote.history,conversation:remote.conversation}))applyCloudCopy(remote)
      else {cloudCopy=remote;accountStatus='A cloud plan and a different plan on this device were found. Choose which to keep.'}
    }
  } catch(error){accountStatus='Your plan remains saved on this device.';accountError=error.message}
  render()
}
function applyCloudCopy(remote) {
  cloudReady=false
  state=migrate(remote.state)
  undoStack=Array.isArray(remote.history)?remote.history.slice(-HISTORY_LIMIT):[]
  messages=Array.isArray(remote.conversation)&&remote.conversation.length?remote.conversation.slice(-30):messages
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state))
  localStorage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(undoStack))
  saveConversation()
  cloudRevision=remote.revision
  lastSyncedPayload=JSON.stringify(cloudPayload())
  cloudCopy=null;cloudReady=true;accountStatus='Synced across your devices';accountError=''
}
async function initializeAccount() {
  try {
    const callback=await handleAuthCallback()
    if(callback?.type==='invite'&&callback.token){inviteToken=callback.token;accountStatus='Complete your invitation';render();return}
    accountUser=await getUser()
    if(accountUser)await loadCloudCopy()
    else accountStatus='Sign in with your invitation to sync across devices.'
  } catch(error){accountStatus='Cloud sign-in is available on the deployed Netlify site.';accountError=error.message||''}
  render()
}
async function signIn(event) {
  event.preventDefault();accountError='';accountStatus='Signing in…';renderAccountStatus()
  try {accountUser=await login(event.target.querySelector('#login-email').value,event.target.querySelector('#login-password').value);await loadCloudCopy()}
  catch(error){accountStatus='Sign in failed.';accountError=error.message||'Check your email and password.';render()}
}
async function acceptAccountInvite(event) {
  event.preventDefault()
  try {
    const password=event.target.querySelector('#invite-password').value
    const invitedUser=await acceptInvite(inviteToken,password)
    inviteToken=''
    // Invite acceptance creates a session, but the Identity SDK does not set
    // the auth cookie required by our server functions until a normal login.
    accountUser=await login(invitedUser.email,password)
    await loadCloudCopy()
  }
  catch(error){accountError=error.message||'Invitation could not be accepted.';render()}
}
async function signOut() {
  clearTimeout(cloudSaveTimer);cloudReady=false
  try {await logout()} catch(error){accountError=error.message||'Sign out failed.';render();return}
  accountUser=null;cloudCopy=null;cloudRevision=0;lastSyncedPayload='';cloudSnapshots=null;snapshotNotice='';accountStatus='Sign in with your invitation to sync across devices.';accountError='';render()
}
async function deleteCloudCopy() {
  if(!confirm('Delete your cloud plan and saved history? The plan on this device will remain. This cannot be undone.'))return
  try {
    const response=await fetch('/api/planner-state',{method:'DELETE'})
    if(!response.ok)throw new Error('Cloud copy could not be deleted. Please try again.')
    cloudReady=false;cloudCopy={exists:false};cloudRevision=0;lastSyncedPayload='';accountStatus='Cloud copy deleted. Your plan is still on this device.';accountError='';render()
  } catch(error){accountError=error.message;renderAccountStatus()}
}
async function loadCloudSnapshots() {
  if(!accountUser||!cloudReady||snapshotBusy)return
  snapshotBusy=true;snapshotNotice='';render()
  try {
    const response=await fetch('/api/planner-snapshots',{cache:'no-store'})
    if(!response.ok)throw new Error('Earlier cloud versions are unavailable right now.')
    cloudSnapshots=(await response.json()).snapshots||[]
    snapshotNotice=cloudSnapshots.length?'Choose a version to restore. Your current plan will remain available through Undo.':'No earlier cloud versions yet.'
  } catch(error){snapshotNotice=error.message}
  finally {snapshotBusy=false;render()}
}
async function restoreCloudSnapshot(revision) {
  if(!accountUser||!cloudReady||cloudSaving||snapshotBusy)return
  const chosen=cloudSnapshots?.find(entry=>entry.revision===revision)
  if(!chosen||revision===cloudRevision)return
  if(!confirm(`Restore cloud version ${revision} from ${new Date(chosen.createdAt).toLocaleString()}? Your current planner will be saved in Undo.`))return
  const nextHistory=[...undoStack,{label:`Before restoring cloud version ${revision}`,at:new Date().toISOString(),state:clone(state)}].slice(-HISTORY_LIMIT)
  clearTimeout(cloudSaveTimer);cloudReady=false;snapshotBusy=true;snapshotNotice='Restoring your plan…';render()
  try {
    const response=await fetch('/api/planner-snapshots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision,expectedRevision:cloudRevision,history:nextHistory})})
    const result=await response.json()
    if(response.status===409){snapshotNotice='Another device changed your plan. Choose which copy to keep before restoring.';await loadCloudCopy();return}
    if(!response.ok)throw new Error('This version could not be restored. Your current plan is unchanged.')
    state=migrate(result.state);undoStack=nextHistory;goalDraft=null;intakeDraft=null;intakeCaptureId=null
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state))
    localStorage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(undoStack))
    cloudRevision=result.revision;lastSyncedPayload=JSON.stringify(cloudPayload());cloudReady=true
    accountStatus='Synced across your devices';accountError='';cloudSnapshots=null
    snapshotNotice=`Version ${revision} restored. Use Undo to return to the plan you had before.`
  } catch(error){cloudReady=true;snapshotNotice=error.message||'This version could not be restored.'}
  finally {snapshotBusy=false;render()}
}
function navButton(id, icon, label) { return `<button class="nav-item ${view===id?'active':''}" data-view="${id}"><span class="icon">${icon}</span>${label}</button>` }
function planningConfig() { return configForDayModes(state.plannerConfig,state.dayModes) }

function todayView() {
  const items = dayItems(selectedDay)
  const metrics = dayMetrics(state.items, selectedDay, planningConfig())
  const conflicts = detectConflicts(state.items, selectedDay)
  const done = items.filter(i => i.completed).length
  const unscheduled = state.items.filter(i => i.day===selectedDay && i.unscheduled && !i.completed)
  return `<header class="topbar">
      <div><div class="eyebrow">YOUR DAY</div><h1>${selectedDay}</h1><p class="date-line">Fixed commitments stay anchored. Flexible work can move when reality changes.</p></div>
      <div class="top-actions"><button class="secondary-button" data-action="plan-day"><span class="icon">↳</span> Replan</button><button class="reality-button" data-action="reality"><span class="icon">✦</span> Reality mode</button></div>
    </header>
    <div class="day-tabs">${DAYS.map(d=>`<button class="day-tab ${d===selectedDay?'active':''}" data-day="${d}">${d.slice(0,3)}</button>`).join('')}</div>
    <div class="day-mode"><div><strong>How much should today hold?</strong><span>${esc(MODE_HINTS[modeForDay(state.dayModes,selectedDay)])}</span></div><div class="day-mode-options">${DAY_MODES.map(mode=>`<button type="button" data-day-mode="${mode}" aria-pressed="${modeForDay(state.dayModes,selectedDay)===mode}">${MODE_LABELS[mode]}</button>`).join('')}</div></div>
    <section class="day-summary">
      ${summary(`${done}/${items.length}`,'blocks done')}
      ${summary(formatMinutes(metrics.fixedMinutes),'fixed + buffers')}
      ${summary(formatMinutes(metrics.openMinutes),'open in day')}
      ${summary(formatMinutes(metrics.protectedFreeMinutes),'protected free')}
    </section>
    ${plannerNotice(metrics, conflicts, unscheduled)}
    <form class="quick-add" id="quick-add-form"><label for="quick-add-title">Quick add a task</label><input id="quick-add-title" name="title" placeholder="What needs doing?" required maxlength="120"><label class="sr-only" for="quick-add-duration">Minutes</label><select id="quick-add-duration" name="duration"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">1 hour</option><option value="120">2 hours</option></select><button type="submit">Add to ${esc(selectedDay)}</button></form>
    <section class="timeline">${items.length ? items.map(timelineItem).join('') : '<div class="empty-state">Nothing scheduled yet. Tell the planner what you want to do.</div>'}</section>`
}
function summary(value,label) { return `<div class="summary-stat"><strong>${value}</strong><span>${label}</span></div>` }
function plannerNotice(metrics, conflicts, unscheduled) {
  const notes=[]
  if(conflicts.length) notes.push(`${conflicts.length} conflict${conflicts.length===1?'':'s'} need attention`)
  if(metrics.openMinutes < metrics.protectedFreeMinutes) notes.push(`free-time target is short by ${formatMinutes(metrics.protectedFreeMinutes-metrics.openMinutes)}`)
  if(unscheduled.length) notes.push(`${unscheduled.length} flexible item${unscheduled.length===1?' is':'s are'} not currently placeable`)
  if(!notes.length) notes.push(`${formatMinutes(Math.max(0,metrics.openMinutes-metrics.protectedFreeMinutes))} can still be used without consuming your protected free time`)
  return `<div class="planner-notice ${conflicts.length||unscheduled.length?'warning':''}"><span class="planner-spark">✦</span><div><strong>${conflicts.length||unscheduled.length?'Planner check':'Schedule is feasible'}</strong><span>${esc(notes.join(' · '))}</span></div></div>`
}
function timelineItem(it) {
  const subtasks = it.subtasks?.length ? `<div class="subtasks">${it.subtasks.map(s=>`<label class="subtask ${s.completed?'completed':''}"><input type="checkbox" data-subtask="${s.id}" data-item="${it.id}" ${s.completed?'checked':''}><span>${esc(s.title)}</span></label>`).join('')}</div>` : ''
  const meta = [
    isFixed(it) ? 'Fixed' : 'Flexible',
    it.durationMinutes ? formatMinutes(it.durationMinutes) : '',
    it.bufferBefore ? `${it.bufferBefore}m early buffer` : '',
    it.deadlineDay ? `due ${it.deadlineDay}` : '',
    it.generatedFromIntake ? 'from inbox' : '',
    it.unscheduled ? 'needs a slot' : '',
    it.skipped ? 'skipped' : '',
  ].filter(Boolean)
  const actualChoices=[5,10,15,20,30,45,60,90,120,180,240,480]
  const actual=it.actualMinutes||it.durationMinutes||30
  const actualOptions=[...new Set([actual,...actualChoices])].sort((a,b)=>a-b).map(minutes=>`<option value="${minutes}" ${minutes===actual?'selected':''}>${formatMinutes(minutes)}</option>`).join('')
  const feedback=!isFixed(it)?it.skipped?`<div class="work-feedback"><button data-resume-work="${attr(it.id)}">Bring back</button><span>Skipped for now. Replan when you’re ready.</span></div>`:it.completed?`<div class="work-feedback"><label>Actually took <select data-actual-time="${attr(it.id)}">${actualOptions}</select></label><span>Estimated ${formatMinutes(it.durationMinutes||30)}</span></div>`:`<div class="work-feedback"><button data-skip-work="${attr(it.id)}">Skip this block</button></div>`:''
  const suggestion=!isFixed(it)&&!it.completed&&!it.skipped?durationSuggestion(state.workLog,it.title,it.durationMinutes,state.learningChoices):null
  const suggestionUI=suggestion?`<div class="duration-suggestion"><span>Usually ${formatMinutes(suggestion.suggestedMinutes)} after ${suggestion.sampleCount} finishes. Estimated ${formatMinutes(it.durationMinutes)} now.</span><button data-use-duration="${attr(it.id)}">Use ${formatMinutes(suggestion.suggestedMinutes)}</button><button data-ignore-duration="${attr(it.id)}">Ignore this suggestion</button></div>`:''
  const pattern=!isFixed(it)&&!it.completed&&!it.skipped?workPattern(state.workLog,it.title,state.learningChoices,it.preferredWindow):null
  const patternUI=pattern?`<div class="work-pattern"><span>Finished ${pattern.completed} of ${pattern.attempts} recent ${esc(it.title)} attempts${pattern.skipped?` · skipped ${pattern.skipped}`:''}.</span>${pattern.preferred?`<span>${pattern.preferred.sampleCount} completed blocks were scheduled in the ${pattern.preferred.band}.</span><button data-use-window="${attr(it.id)}">Prefer ${pattern.preferred.band}</button><button data-ignore-window="${attr(it.id)}">Ignore this suggestion</button>`:''}</div>`:''
  return `<article class="timeline-item ${it.kind} ${it.completed?'done':''} ${it.skipped?'skipped':''} ${it.unscheduled?'unscheduled':''}">
    <div class="time-col"><span>${it.skipped?'Skipped':it.start?displayTime(it.start):'Unscheduled'}</span>${it.end?`<small>${displayTime(it.end)}</small>`:''}</div>
    <button class="check ${it.completed?'checked':''}" data-toggle="${attr(it.id)}" ${it.skipped?'disabled':''}>${it.completed?'✓':'○'}</button>
    <div class="item-body"><div class="item-topline"><div><h3>${esc(it.title)}</h3><div class="item-meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}${it.note?`<span class="needs-attention">${esc(it.note)}</span>`:''}</div></div></div>${subtasks}${feedback}${suggestionUI}${patternUI}</div>
  </article>`
}

function weekView() {
  const diagnostics=weekDiagnostics(state.items,planningConfig())
  return `<div class="view-pad"><div class="page-head"><div><div class="eyebrow">WEEK AT A GLANCE</div><h1>This week</h1><p class="page-intro">The engine protects fixed commitments and keeps a minimum amount of the day intentionally open.</p></div><button class="reality-button" data-action="plan-week"><span class="icon">✦</span> Plan week</button></div>
    <div class="week-grid">${DAYS.map(day => {
      const items=dayItems(day); const m=diagnostics.byDay[day]
      return `<button class="week-card ${day===selectedDay?'selected':''} ${m.conflicts||m.openMinutes<m.protectedFreeMinutes?'has-warning':''}" data-open-day="${day}"><div class="week-card-head"><strong>${day}</strong><span>${formatMinutes(m.fixedMinutes)} fixed · ${formatMinutes(m.openMinutes)} open</span></div>${items.slice(0,5).map(i=>`<div class="week-line"><span>${i.start?displayTime(i.start):'—'}</span>${esc(i.title)}</div>`).join('')}${items.length>5?`<div class="more-line">+ ${items.length-5} more</div>`:''}<div class="capacity-line"><span>Protected</span><strong>${formatMinutes(m.protectedFreeMinutes)}</strong></div></button>`
    }).join('')}</div>
    ${state.lastPlan ? planReport(state.lastPlan) : ''}
    <section class="rules-section"><h2>Rules the planner knows</h2><div class="rules-grid">${state.rules.map(r=>`<div class="rule-card">${esc(r.text)}</div>`).join('')}</div></section>
  </div>`
}

function planReport(report) {
  const changes = report.changes || []
  const unscheduled = report.unscheduled || []
  return `<section class="plan-report"><div class="report-head"><div><div class="mini-label">LAST PLANNER PASS</div><h2>${esc(report.label || 'Schedule updated')}</h2></div><span>${esc(report.at || '')}</span></div>
    ${changes.length ? `<div class="report-grid">${changes.slice(0,8).map(c=>`<div class="report-row"><strong>${esc(c.title)}</strong><span>${esc(c.from || '')}${c.to?` → ${esc(c.to)}`:''}${c.type==='split'?`split into ${c.parts} blocks`:''}</span></div>`).join('')}</div>` : '<p class="report-empty">Everything already fit, so nothing had to move.</p>'}
    ${unscheduled.length ? `<div class="unscheduled-report"><strong>Couldn’t fit yet</strong>${unscheduled.map(u=>`<span>${esc(u.title)} — ${esc(u.reason)}</span>`).join('')}</div>`:''}
  </section>`
}

function goalsView() {
  return `<div class="view-pad"><div class="eyebrow">GOALS, METRICS & OPEN LOOPS</div><h1>What the week is for</h1><p class="page-intro">Goals stay separate from the calendar until they produce a concrete next action. Open loops keep important intentions visible without pretending they already have a schedule.</p>
  ${goalDraft?goalBreakdownReview():''}
  <div class="goal-grid">${state.goals.map(goalCard).join('')}${state.metrics.map(metricCard).join('')}${state.openLoops.map(openLoopCard).join('')}</div></div>`
}
function historyView() {
  return `<div class="view-pad"><div class="eyebrow">PLANNER HISTORY</div><h1>Recent changes</h1><p class="page-intro">Your last ${HISTORY_LIMIT} planner checkpoints survive a refresh and sync after you sign in.</p>
    <div class="backup-tools"><button class="secondary-button" data-action="export-backup">Download backup</button><label class="secondary-button" for="import-backup">Import backup</label><input id="import-backup" type="file" accept=".json,application/json" hidden><span>Backups include your personal planner notes. Keep the file private.</span></div>
    <section class="operation-history"><div class="mini-label">WHAT CHANGED</div>${state.operationLog?.length?`<div class="history-list">${state.operationLog.slice(-50).reverse().map(entry=>`<div class="history-entry"><div><strong>${esc(entry.label)}</strong><span>${esc(entry.summary||'Planner details updated')}</span><time>${esc(new Date(entry.at).toLocaleString())}</time></div></div>`).join('')}</div>`:'<div class="empty-state">No recorded changes yet.</div>'}</section>
    <section class="work-history"><div class="mini-label">WORK PATTERNS</div>${state.workLog?.length?`<div class="history-list">${state.workLog.slice(-20).reverse().map(entry=>`<div class="history-entry"><div><strong>${esc(entry.title)}</strong><span>${entry.outcome==='completed'?`Estimated ${formatMinutes(entry.estimatedMinutes)} · actually ${formatMinutes(entry.actualMinutes)}`:'Skipped'}</span><time>${esc(new Date(entry.at).toLocaleString())}</time></div></div>`).join('')}</div>`:'<div class="empty-state">Finish or skip flexible work to see patterns here.</div>'}</section>
    ${state.learningChoices?.some(choice=>choice.status==='ignored')?`<section class="learning-history"><div class="mini-label">IGNORED SUGGESTIONS</div><div class="history-list">${state.learningChoices.map((choice,index)=>choice.status==='ignored'?`<div class="history-entry"><div><strong>${esc(choice.titleKey)}</strong><span>${choice.band?`${esc(choice.band)} time suggestion`:`${formatMinutes(choice.suggestedMinutes)} duration suggestion`}</span></div><button class="secondary-button" data-reset-learning="${index}">Show again</button></div>`:'').join('')}</div></section>`:''}
    <section class="undo-history"><div class="mini-label">UNDO POINTS</div>
    ${undoStack.length?`<div class="history-list">${undoStack.slice().reverse().map((entry,index)=>`<div class="history-entry"><div><strong>${esc(entry.label)}</strong><time>${esc(entry.at?new Date(entry.at).toLocaleString():'Earlier')}</time></div>${index===0?'<button class="secondary-button" data-action="undo-history">Undo this change</button>':''}</div>`).join('')}</div>`:'<div class="empty-state">No planner changes yet.</div>'}
    </section>
    ${accountUser?`<section class="cloud-history"><div class="section-head"><div><div class="mini-label">CLOUD RECOVERY</div><h2>Earlier cloud versions</h2></div><button class="secondary-button" data-action="load-snapshots" ${!cloudReady||snapshotBusy?'disabled':''}>${snapshotBusy?'Please wait…':cloudSnapshots?'Refresh versions':'Show versions'}</button></div><p>Restore a saved planner version from this account. Your current plan remains available through Undo.</p>${snapshotNotice?`<p class="snapshot-notice" role="status">${esc(snapshotNotice)}</p>`:''}${cloudSnapshots?.length?`<div class="history-list">${cloudSnapshots.map(entry=>`<div class="history-entry"><div><strong>${esc(entry.label||'Saved planner')}</strong><time>${esc(new Date(entry.createdAt).toLocaleString())} · version ${entry.revision}</time></div><button class="secondary-button" data-restore-snapshot="${entry.revision}" ${!cloudReady||snapshotBusy||entry.revision===cloudRevision?'disabled':''}>${entry.revision===cloudRevision?'Current':'Restore'}</button></div>`).join('')}</div>`:''}</section>`:''}
  </div>`
}
function goalCard(g){
  const pct=g.target?Math.min(100,Math.round((g.progress/g.target)*100)):0
  return `<article class="goal-card"><div class="goal-top"><span>${esc(g.cadence||'Ongoing')}</span><strong>${g.target?`${g.progress}/${g.target}`:''}</strong></div><h2>${esc(g.title)}</h2><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><p>${esc(g.unit||'')}${g.minimumDurationMinutes?` · minimum ${g.minimumDurationMinutes}m each`:''}${g.note?` · ${esc(g.note)}`:''}</p>${g.id==='points'?`<div class="score-input"><input data-goal-progress="points" type="range" min="0" max="4000" step="100" value="${g.progress}"></div>`:''}${roadmapContent(g.roadmap)}<button class="secondary-button goal-next-button" data-goal-breakdown="goal:${attr(g.id)}">${g.roadmap?'Revise next step':'Find next step'}</button></article>`
}
function metricCard(m){
  const pct=m.target?Math.min(100,Math.round((m.progress/m.target)*100)):0
  return `<article class="goal-card metric-card"><div class="goal-top"><span>Metric · ${esc(m.cadence||'Daily')}</span><strong>${m.progress}/${m.target}</strong></div><h2>${esc(m.title)}</h2><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><p>${esc(m.unit||'units')}${m.details?` · ${esc(m.details)}`:''}</p></article>`
}
function openLoopCard(loop){
  return `<article class="goal-card open-loop"><div class="goal-top"><span>Open loop</span><strong>${esc(loop.status||'open')}</strong></div><h2>${esc(loop.title)}</h2><p>${esc(loop.details||loop.sourceText||'Still needs a concrete next action.')}</p>${roadmapContent(loop.roadmap)}<button class="secondary-button goal-next-button" data-goal-breakdown="open_loop:${attr(loop.id)}">${loop.roadmap?'Revise next step':'Find next step'}</button></article>`
}

function roadmapContent(roadmap){
  if(!roadmap)return ''
  const planned=roadmap.scheduledTaskId&&state.items.find(item=>item.id===roadmap.scheduledTaskId)
  return `<div class="roadmap-summary"><strong>Path forward</strong><ol>${(roadmap.milestones||[]).map(title=>`<li>${esc(title)}</li>`).join('')}</ol><p>Next: ${esc(roadmap.nextAction?.title||'Choose a next action')}</p>${planned?`<span class="roadmap-status">${planned.unscheduled?'Next step needs a slot':'Next step is in your plan'}</span>`:''}</div>`
}

function goalBreakdownReview(){
  const data=goalDraft.data
  const days=['',...DAYS].map(day=>`<option value="${day}" ${data.nextAction.day===day?'selected':''}>${day||'Let Daylight choose'}</option>`).join('')
  return `<section class="goal-breakdown-review"><div class="review-summary"><div><div class="mini-label">A SMALL PATH FORWARD</div><h2>${esc(goalDraft.title)}</h2><p>${esc(goalDraft.notice||'Edit anything before saving. Nothing goes on the calendar until you choose it.')}</p></div><button class="secondary-button" data-action="cancel-goal-breakdown">Close</button></div>
    ${goalDraft.loading?'<p class="goal-breakdown-loading">Finding a next step…</p>':`<div class="goal-breakdown-fields"><p>${esc(data.summary)}</p><div class="mini-label">MILESTONES</div>${data.milestones.map((title,index)=>`<label>Step ${index+1}<input data-goal-milestone="${index}" value="${attr(title)}"></label>`).join('')}<div class="mini-label">NEXT ACTION</div><label>What to do<input data-goal-action-title value="${attr(data.nextAction.title)}"></label><div class="goal-breakdown-row"><label>Minutes<input type="number" min="10" max="180" data-goal-action-duration value="${data.nextAction.durationMinutes}"></label><label>Day<select data-goal-action-day>${days}</select></label></div><label>Useful detail<textarea data-goal-action-details rows="2">${esc(data.nextAction.details)}</textarea></label><div class="goal-breakdown-actions"><button class="secondary-button" data-action="save-goal-breakdown">Save roadmap</button><button class="reality-button" data-action="schedule-goal-breakdown">Save & plan next step</button></div></div>`}
  </section>`
}

function inboxView() {
  const review = intakeDraft ? intakeReview() : ''
  const pendingAssistant=state.questions.filter(item=>item.status==='pending')
  const pendingIntake=state.inbox.flatMap(capture=>(capture.review?.items||[]).filter(item=>item.needsConfirmation&&item.question).map(item=>({captureId:capture.id,question:item.question})))
  const questions=pendingAssistant.length||pendingIntake.length?`<section class="inbox-questions"><div class="section-head"><div><div class="mini-label">STILL TO CLARIFY</div><h2>Questions waiting for you</h2></div></div>${pendingAssistant.map(item=>`<div class="question-row"><span>${esc(item.text)}</span><div><button class="secondary-button" data-answer-question="${attr(item.id)}">Answer</button><button class="secondary-button" data-dismiss-question="${attr(item.id)}">Dismiss</button></div></div>`).join('')}${pendingIntake.map(item=>`<div class="question-row"><span>${esc(item.question)}</span><button class="secondary-button" data-resume-intake="${attr(item.captureId)}">Review item</button></div>`).join('')}</section>`:''
  const history = state.inbox.length ? `<section class="inbox-history"><div class="section-head"><div><div class="mini-label">CAPTURE HISTORY</div><h2>What you’ve told Daylight</h2></div></div>${state.inbox.slice().reverse().map(inboxHistoryCard).join('')}</section>` : ''
  return `<div class="view-pad intake-page"><div class="page-head"><div><div class="eyebrow">BRAIN DUMP INBOX</div><h1>Tell it everything.</h1><p class="page-intro">Don’t organize it first. Daylight separates fixed commitments, flexible work, routines, rules, goals, metrics, and things that are still too vague to schedule.</p></div></div>
    <section class="intake-composer">
      <div class="intake-copy"><div class="mini-label">UNSTRUCTURED INPUT</div><h2>What does your life look like right now?</h2><p>Paste notes, a weekly schedule, worries, goals, habits, deadlines, or half-formed plans. Nothing changes until you review it.</p></div>
      <textarea id="brain-dump-input" placeholder="Monday\n8:30 - Matt\n7:15 - Motion 3D\n\nMake my bed every day...">${esc(brainDumpText)}</textarea>
      <div class="intake-actions"><button class="secondary-button" data-action="sample-intake">Use example</button><div class="intake-action-group"><button class="secondary-button" type="button" data-voice="inbox" aria-label="Speak brain dump">🎙 Speak</button><button class="reality-button" data-action="analyze-intake" ${intakeSending?'disabled':''}>${intakeSending?'Interpreting…':'✦ Understand this'}</button></div></div><div class="voice-status" data-voice-status="inbox" aria-live="polite"></div><p class="voice-note">Your browser handles transcription and may use its speech service. Review the text before sending it to Daylight.</p>
    </section>
    ${questions}
    ${review}
    ${history}
  </div>`
}
function intakeReview(){
  const accepted=intakeDraft.items.filter(i=>i.accepted).length
  const unresolved=intakeDraft.items.filter(i=>i.needsConfirmation&&!i.accepted)
  const ambiguous=unresolved.length
  const pendingQuestions=[...new Set(unresolved.map(item=>item.question).filter(Boolean))]
  if(!pendingQuestions.length&&ambiguous)pendingQuestions.push(...(intakeDraft.questions||[]))
  return `<section class="intake-review">
    <div class="review-summary"><div><div class="mini-label">HERE’S WHAT I UNDERSTOOD</div><h2>${esc(intakeDraft.summary)}</h2><p>${accepted} selected · ${ambiguous} need${ambiguous===1?'s':''} attention. Items left unchecked stay in Inbox for later.</p></div><div class="review-summary-actions"><button class="secondary-button" data-action="clear-intake">Keep for later</button><button class="reality-button" data-action="apply-intake" ${accepted?'':'disabled'}>Apply ${accepted} selected</button></div></div>
    ${pendingQuestions.length?`<div class="intake-questions"><strong>Questions that matter</strong>${pendingQuestions.map(q=>`<span>${esc(q)}</span>`).join('')}</div>`:''}
    <div class="intake-grid">${intakeDraft.items.map((entry,index)=>intakeCard(entry,index)).join('')}</div>
  </section>`
}
function intakeCard(entry,index){
  const confidence=Math.round(entry.confidence*100)
  const typeOptions=INTAKE_TYPES.map(t=>`<option value="${t}" ${entry.type===t?'selected':''}>${typeLabel(t)}</option>`).join('')
  const dayOptions=['',...DAYS].map(d=>`<option value="${d}" ${entry.day===d?'selected':''}>${d||'No fixed day'}</option>`).join('')
  const deadlineOptions=['',...DAYS].map(d=>`<option value="${d}" ${entry.deadlineDay===d?'selected':''}>${d||'No due day'}</option>`).join('')
  const recurrenceOptions=['once','daily','weekdays','weekly','custom'].map(value=>`<option value="${value}" ${entry.recurrence===value?'selected':''}>${value==='once'?'One time':value[0].toUpperCase()+value.slice(1)}</option>`).join('')
  return `<article class="intake-card ${entry.accepted?'accepted':'rejected'} ${entry.needsConfirmation?'ambiguous':''}">
    <div class="intake-card-top"><label class="accept-toggle"><input type="checkbox" data-intake-accept="${index}" ${entry.accepted?'checked':''}><span>${entry.accepted?'Use':'Later'}</span></label><span class="confidence ${confidence<66?'low':''}">${confidence}% confidence</span></div>
    <div class="source-quote">“${esc(entry.sourceText||entry.title)}”</div>
    <input class="intake-title" data-intake-title="${index}" value="${attr(entry.title)}" aria-label="Interpreted title">
    <div class="intake-fields"><select data-intake-type="${index}" aria-label="Item type">${typeOptions}</select><select data-intake-day="${index}" aria-label="Day">${dayOptions}</select></div>
    <div class="intake-fields"><label>Repeat<select data-intake-recurrence="${index}">${recurrenceOptions}</select></label>${entry.type==='task'?`<label>Due day<select data-intake-deadline="${index}">${deadlineOptions}</select></label>`:'<span></span>'}</div>
    ${(entry.type==='event'||entry.type==='task'||entry.type==='routine')?`<div class="intake-time-row"><label>Start<input type="time" data-intake-start="${index}" value="${attr(entry.start)}"></label><label>Duration<input type="number" min="0" step="5" data-intake-duration="${index}" value="${entry.durationMinutes||''}" placeholder="min"></label></div>`:''}
    ${(entry.type==='goal'||entry.type==='metric')?`<div class="intake-time-row"><label>Target<input type="number" min="0" data-intake-target="${index}" value="${entry.target||''}" placeholder="Optional"></label><label>Unit<input data-intake-unit="${index}" value="${attr(entry.unit)}" placeholder="e.g. sessions"></label></div>`:''}
    <label class="intake-notes-label">Planning note<textarea data-intake-details="${index}" rows="2" placeholder="Add an answer or useful detail">${esc(entry.details)}</textarea></label>
    <div class="intake-meta"><span>${typeLabel(entry.type)}</span><span>${esc(entry.recurrence)}</span>${entry.deadlineDay?`<span>due ${esc(entry.deadlineDay)}</span>`:''}${entry.target?`<span>${entry.target} ${esc(entry.unit)}</span>`:''}</div>
    ${entry.needsConfirmation&&!entry.accepted?`<div class="attention-box"><strong>Needs confirmation</strong><span>${esc(entry.question||'Check this interpretation before applying it.')}</span></div>`:''}
  </article>`
}
function inboxHistoryCard(item){
  const counts=item.counts||{}
  const remaining=item.review?.items?.length||0
  return `<article class="inbox-history-card"><div><div class="history-top"><span>${remaining?`${remaining} to review`:esc(item.status||'captured')}</span><time>${esc(item.createdAt?new Date(item.createdAt).toLocaleString():item.createdLabel||'')}</time></div><h3>${esc(item.summary||'Brain dump')}</h3><p>${esc(shorten(item.rawText||'',180))}</p>${remaining?`<button class="secondary-button" data-resume-intake="${attr(item.id)}">Continue review</button>`:''}</div><div class="history-counts">${Object.entries(counts).map(([k,v])=>v?`<span>${esc(v)} ${esc(typeLabel(k))}${v===1?'':'s'}</span>`:'').join('')}</div></article>`
}

function assistantPanel() {
  return `<aside class="assistant-panel ${chatOpen?'':'collapsed'}"><button class="assistant-toggle" data-action="chat-toggle">◌</button>${chatOpen?`
    <div class="assistant-head"><div class="assistant-title"><span class="icon">✦</span> Planner</div><div class="assistant-status">AI understands intent · engine owns time arithmetic</div></div>
    <div class="chat-thread">${messages.map(chatBubble).join('')}${sending?'<div class="thinking"><span class="spin">↻</span> Interpreting what changed…</div>':''}</div>
    <div class="composer">${activeQuestionId?`<div class="answer-context">Answering: ${esc(state.questions.find(item=>item.id===activeQuestionId)?.text||'Question')} <button data-action="cancel-answer" aria-label="Cancel answer">×</button></div>`:''}<textarea id="chat-input" placeholder="${activeQuestionId?'Your answer…':"Tell me what's going on…"}" rows="3"></textarea><button data-action="send" aria-label="Send message">➤</button><button type="button" class="voice-button" data-voice="chat" aria-label="Speak to planner">🎙</button><div class="voice-status" data-voice-status="chat" aria-live="polite"></div><div class="composer-tools"><button type="button" data-action="read-aloud" aria-pressed="${readRepliesAloud}">${readRepliesAloud?'🔊 Voice replies on':'🔈 Read replies aloud'}</button></div><div class="composer-hint">Your browser handles voice transcription. Review the text, then send it. Proposed changes still need your approval.</div></div>`:''}</aside>`
}
function chatBubble(m) {
  return `<div class="bubble-wrap ${m.role}"><div class="bubble">${esc(m.text)}</div>${m.proposals?.length?`<div class="proposal-list">${m.proposals.map((p,i)=>proposalCard(p,i,m.id)).join('')}</div>`:''}${m.questions?.map(q=>`<div class="question-chip">${esc(q)}</div>`).join('')||''}</div>`
}
function proposalCard(p,index,messageId) {
  return `<div class="proposal"><div class="proposal-kicker">${esc(p.action)}</div><strong>${esc(p.title||'Schedule change')}</strong><span>${[p.day,p.start&&displayTime(p.start),p.durationMinutes?formatMinutes(p.durationMinutes):'',p.details].filter(Boolean).map(esc).join(' · ')}</span><button data-apply="${messageId}:${index}">Apply change</button></div>`
}

function bindEvents() {
  document.querySelector('.account-details')?.addEventListener('toggle',event=>{accountPanelOpen=event.currentTarget.open})
  document.querySelector('#login-form')?.addEventListener('submit',signIn)
  document.querySelector('#invite-form')?.addEventListener('submit',acceptAccountInvite)
  document.querySelector('[data-action="sign-out"]')?.addEventListener('click',signOut)
  document.querySelector('[data-action="delete-cloud"]')?.addEventListener('click',deleteCloudCopy)
  document.querySelector('[data-action="use-cloud"]')?.addEventListener('click',()=>{if(!cloudCopy?.exists)return;if(!confirm('Use the cloud plan on this device? Your current device plan will be replaced. Export a backup first if you want to keep it.'))return;applyCloudCopy(cloudCopy);render()})
  document.querySelector('[data-action="use-local"]')?.addEventListener('click',()=>{if(cloudCopy?.exists&&!confirm('Replace the cloud plan with this device’s plan? The previous cloud plan will be replaced.'))return;saveToCloud(true).then(()=>render())})
  document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{stopVoice();view=el.dataset.view;render()})
  document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{selectedDay=el.dataset.day;render()})
  document.querySelectorAll('[data-day-mode]').forEach(el=>el.onclick=()=>setDayMode(el.dataset.dayMode))
  document.querySelectorAll('[data-open-day]').forEach(el=>el.onclick=()=>{selectedDay=el.dataset.openDay;view='today';render()})
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=()=>toggleItem(el.dataset.toggle))
  document.querySelectorAll('[data-skip-work]').forEach(el=>el.onclick=()=>skipFlexibleWork(el.dataset.skipWork))
  document.querySelectorAll('[data-resume-work]').forEach(el=>el.onclick=()=>resumeFlexibleWork(el.dataset.resumeWork))
  document.querySelectorAll('[data-actual-time]').forEach(el=>el.onchange=()=>updateActualTime(el.dataset.actualTime,Number(el.value)))
  document.querySelectorAll('[data-use-duration]').forEach(el=>el.onclick=()=>applyDurationSuggestion(el.dataset.useDuration))
  document.querySelectorAll('[data-ignore-duration]').forEach(el=>el.onclick=()=>ignoreDurationSuggestion(el.dataset.ignoreDuration))
  document.querySelectorAll('[data-use-window]').forEach(el=>el.onclick=()=>applyWindowSuggestion(el.dataset.useWindow))
  document.querySelectorAll('[data-ignore-window]').forEach(el=>el.onclick=()=>ignoreWindowSuggestion(el.dataset.ignoreWindow))
  document.querySelectorAll('[data-reset-learning]').forEach(el=>el.onclick=()=>resetIgnoredSuggestion(Number(el.dataset.resetLearning)))
  document.querySelectorAll('[data-subtask]').forEach(el=>el.onchange=()=>toggleSubtask(el.dataset.item,el.dataset.subtask))
  document.querySelectorAll('[data-apply]').forEach(el=>el.onclick=()=>{
    const [messageId,index]=el.dataset.apply.split(':'); const m=messages.find(m=>m.id===messageId); if(m?.proposals?.[Number(index)]) applyProposal(m.proposals[Number(index)])
  })
  document.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{pushUndo('Before reset');state=clone(initialState);intakeDraft=null;intakeCaptureId=null;goalDraft=null;brainDumpText='';save();messages.push({id:uid(),role:'assistant',text:'Prototype data restored.'});render()})
  document.querySelector('[data-action="undo"]')?.addEventListener('click',undoLast)
  document.querySelector('[data-action="undo-history"]')?.addEventListener('click',undoLast)
  document.querySelector('[data-action="load-snapshots"]')?.addEventListener('click',loadCloudSnapshots)
  document.querySelectorAll('[data-restore-snapshot]').forEach(el=>el.addEventListener('click',()=>restoreCloudSnapshot(Number(el.dataset.restoreSnapshot))))
  document.querySelector('[data-action="export-backup"]')?.addEventListener('click',exportBackup)
  document.querySelector('#import-backup')?.addEventListener('change',importBackup)
  document.querySelector('[data-action="chat-toggle"]')?.addEventListener('click',()=>{stopVoice();chatOpen=!chatOpen;render()})
  document.querySelector('[data-action="plan-day"]')?.addEventListener('click',()=>runPlanner({label:`Replanned ${selectedDay}`,startDay:selectedDay}))
  document.querySelector('[data-action="plan-week"]')?.addEventListener('click',()=>runPlanner({label:'Replanned the week',startDay:'Monday'}))
  document.querySelector('[data-action="reality"]')?.addEventListener('click',runRealityMode)
  document.querySelector('[data-action="send"]')?.addEventListener('click',()=>sendMessage())
  document.querySelectorAll('[data-voice]').forEach(el=>el.addEventListener('click',()=>toggleVoice(el.dataset.voice)))
  document.querySelector('[data-action="read-aloud"]')?.addEventListener('click',()=>{readRepliesAloud=!readRepliesAloud;try{localStorage.setItem('daylight-read-replies',String(readRepliesAloud))}catch{};if(!readRepliesAloud)globalThis.speechSynthesis?.cancel();render()})
  document.querySelector('[data-action="cancel-answer"]')?.addEventListener('click',()=>{activeQuestionId=null;render()})
  document.querySelectorAll('[data-answer-question]').forEach(el=>el.addEventListener('click',()=>{activeQuestionId=el.dataset.answerQuestion;chatOpen=true;render();document.querySelector('#chat-input')?.focus()}))
  document.querySelectorAll('[data-dismiss-question]').forEach(el=>el.addEventListener('click',()=>{const question=state.questions.find(item=>item.id===el.dataset.dismissQuestion);if(!question)return;pushUndo('Dismissed a question');state.questions=resolveQuestion(state.questions,question.id,'dismissed');save();render()}))
  document.querySelector('#quick-add-form')?.addEventListener('submit',quickAddTask)
  document.querySelector('[data-action="sample-intake"]')?.addEventListener('click',()=>{brainDumpText=sampleBrainDump();render()})
  document.querySelector('[data-action="analyze-intake"]')?.addEventListener('click',analyzeIntake)
  document.querySelector('[data-action="apply-intake"]')?.addEventListener('click',applyIntakeDraft)
  document.querySelector('[data-action="clear-intake"]')?.addEventListener('click',()=>{intakeDraft=null;render()})
  document.querySelectorAll('[data-resume-intake]').forEach(el=>el.addEventListener('click',()=>{
    const capture=state.inbox.find(item=>item.id===el.dataset.resumeIntake)
    if(!capture?.review?.items?.length)return
    intakeCaptureId=capture.id
    intakeDraft=clone(capture.review)
    render()
    document.querySelector('.intake-review')?.scrollIntoView({behavior:'smooth'})
  }))

  const textarea=document.querySelector('#chat-input'); if(textarea) textarea.onkeydown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}
  const dump=document.querySelector('#brain-dump-input'); if(dump) dump.oninput=(e)=>{brainDumpText=e.target.value}
  document.querySelector('[data-goal-progress="points"]')?.addEventListener('change',(e)=>{const goal=state.goals.find(g=>g.id==='points'); if(goal){pushUndo('Updated school points');goal.progress=Number(e.target.value);save();render()}})
  document.querySelectorAll('[data-goal-breakdown]').forEach(el=>el.addEventListener('click',()=>{
    const [kind,id]=el.dataset.goalBreakdown.split(':')
    suggestGoalBreakdown(kind,id)
  }))
  document.querySelector('[data-action="cancel-goal-breakdown"]')?.addEventListener('click',()=>{goalDraft=null;render()})
  document.querySelector('[data-action="save-goal-breakdown"]')?.addEventListener('click',()=>saveGoalBreakdown(false))
  document.querySelector('[data-action="schedule-goal-breakdown"]')?.addEventListener('click',()=>saveGoalBreakdown(true))
  document.querySelectorAll('[data-goal-milestone]').forEach(el=>el.oninput=()=>{if(goalDraft)goalDraft.data.milestones[Number(el.dataset.goalMilestone)]=el.value})
  document.querySelector('[data-goal-action-title]')?.addEventListener('input',e=>{if(goalDraft)goalDraft.data.nextAction.title=e.target.value})
  document.querySelector('[data-goal-action-duration]')?.addEventListener('input',e=>{if(goalDraft)goalDraft.data.nextAction.durationMinutes=Number(e.target.value)})
  document.querySelector('[data-goal-action-day]')?.addEventListener('change',e=>{if(goalDraft)goalDraft.data.nextAction.day=e.target.value})
  document.querySelector('[data-goal-action-details]')?.addEventListener('input',e=>{if(goalDraft)goalDraft.data.nextAction.details=e.target.value})

  document.querySelectorAll('[data-intake-accept]').forEach(el=>el.onchange=()=>editIntake(Number(el.dataset.intakeAccept),{accepted:el.checked}))
  document.querySelectorAll('[data-intake-type]').forEach(el=>el.onchange=()=>editIntake(Number(el.dataset.intakeType),{type:el.value}))
  document.querySelectorAll('[data-intake-day]').forEach(el=>el.onchange=()=>editIntake(Number(el.dataset.intakeDay),{day:el.value}))
  document.querySelectorAll('[data-intake-title]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeTitle),{title:el.value}))
  document.querySelectorAll('[data-intake-start]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeStart),{start:el.value}))
  document.querySelectorAll('[data-intake-duration]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeDuration),{durationMinutes:Number(el.value)||0}))
  document.querySelectorAll('[data-intake-recurrence]').forEach(el=>el.onchange=()=>editIntake(Number(el.dataset.intakeRecurrence),{recurrence:el.value}))
  document.querySelectorAll('[data-intake-deadline]').forEach(el=>el.onchange=()=>editIntake(Number(el.dataset.intakeDeadline),{deadlineDay:el.value}))
  document.querySelectorAll('[data-intake-target]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeTarget),{target:Number(el.value)||0}))
  document.querySelectorAll('[data-intake-unit]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeUnit),{unit:el.value}))
  document.querySelectorAll('[data-intake-details]').forEach(el=>el.oninput=()=>editIntake(Number(el.dataset.intakeDetails),{details:el.value}))
}

function editIntake(index,patch){
  if(!intakeDraft?.items?.[index])return
  intakeDraft.items[index]={...intakeDraft.items[index],...patch}
  const capture=state.inbox.find(item=>item.id===intakeCaptureId)
  if(capture){capture.review=clone(intakeDraft);save()}
  if('accepted' in patch || 'type' in patch || 'day' in patch) render()
}

function goalTarget(kind,id){
  return (kind==='goal'?state.goals:kind==='open_loop'?state.openLoops:[]).find(item=>item.id===id)
}

async function suggestGoalBreakdown(kind,id){
  const target=goalTarget(kind,id)
  if(!target)return
  if(target.roadmap){
    goalDraft={kind,id,title:target.title,data:normalizeGoalBreakdown(target.roadmap,target.title),loading:false,notice:'Edit your saved roadmap, or place its next step in the plan.'}
    render()
    document.querySelector('.goal-breakdown-review')?.scrollIntoView({behavior:'smooth'})
    return
  }
  const details=target.note||target.details||target.sourceText||''
  goalDraft={kind,id,title:target.title,data:starterGoalBreakdown(target.title),loading:!!accountUser,notice:accountUser?'':'Sign in for a tailored AI suggestion. This starter roadmap is editable and works offline.'}
  render()
  if(!accountUser)return
  try {
    const response=await fetch('/api/goal-breakdown',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,title:target.title,details})})
    if(!response.ok)throw await apiError(response)
    if(goalDraft?.id===id&&goalDraft.kind===kind){goalDraft.data=normalizeGoalBreakdown(await response.json(),target.title);goalDraft.notice='Review these suggestions. Saving a roadmap does not schedule anything.'}
  } catch {
    if(goalDraft?.id===id&&goalDraft.kind===kind)goalDraft.notice='AI suggestions are unavailable right now. Edit this starter roadmap and continue.'
  } finally {
    if(goalDraft?.id===id&&goalDraft.kind===kind){goalDraft.loading=false;render();document.querySelector('.goal-breakdown-review')?.scrollIntoView({behavior:'smooth'})}
  }
}

function saveGoalBreakdown(schedule){
  if(!goalDraft||goalDraft.loading)return
  const target=goalTarget(goalDraft.kind,goalDraft.id)
  if(!target)return
  const data=normalizeGoalBreakdown(goalDraft.data,target.title)
  if(!data.nextAction.title.trim())return
  pushUndo(`Roadmap for ${target.title}`)
  const priorTaskId=target.roadmap?.scheduledTaskId
  const linkedTask=priorTaskId&&state.items.find(item=>item.id===priorTaskId)
  const scheduledTaskId=linkedTask?.id||null
  target.roadmap={...data,scheduledTaskId}
  if(goalDraft.kind==='open_loop')target.status='in progress'
  let scheduled=false
  let planDay=null
  let action=linkedTask
  if(linkedTask){
    const nextDay=data.nextAction.day||linkedTask.day
    const changed=linkedTask.title!==data.nextAction.title||linkedTask.durationMinutes!==data.nextAction.durationMinutes||linkedTask.note!==data.nextAction.details||linkedTask.day!==nextDay
    if(changed){
      linkedTask.title=data.nextAction.title
      linkedTask.durationMinutes=data.nextAction.durationMinutes
      linkedTask.note=data.nextAction.details
      linkedTask.day=nextDay
      linkedTask.deadlineDay=nextDay
      linkedTask.start=''
      linkedTask.end=''
      planDay=nextDay
    }
  } else if(schedule){
    const day=data.nextAction.day||selectedDay
    action=task(uid(),data.nextAction.title,day,'','',data.nextAction.durationMinutes,{deadlineDay:day,priority:2,goalId:target.id,note:data.nextAction.details})
    state.items.push(action)
    planDay=day
    target.roadmap.scheduledTaskId=action.id
    scheduled=true
  }
  if(planDay){
    const day=planDay
    const result=day===detroitDay()?replanDayFromNow(state.items,day,detroitMinutes(),planningConfig(),{idFactory:uid}):planWeek(state.items,planningConfig(),{startDay:day,idFactory:uid})
    state.items=result.items
    state.lastPlan={label:`Next step for ${target.title}`,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  }
  save()
  const added=target.roadmap.scheduledTaskId&&state.items.find(item=>item.id===target.roadmap.scheduledTaskId)
  messages.push({id:uid(),role:'assistant',text:scheduled?`I saved a path for ${target.title}. ${added?.unscheduled?'Its first step needs a free slot; I kept your fixed commitments and protected free time in place.':'Its first step is in your plan.'}`:scheduledTaskId?`I saved the updated path for ${target.title}. ${added?.unscheduled?'Its first step still needs a free slot.':'Its first step is in your plan.'}`:`I saved a path for ${target.title}. You can choose when to place the next step in your plan.`})
  goalDraft=null
  render()
}

function pushUndo(label) {
  pendingOperation={id:uid(),label,at:new Date().toISOString(),before:clone(state)}
  undoStack.push({label,at:new Date().toISOString(),state:clone(state)})
  if(undoStack.length>HISTORY_LIMIT) undoStack.shift()
  saveHistory()
}
function undoLast() {
  const previous=undoStack.pop()
  if(!previous)return
  const before=state
  state=previous.state
  state.operationLog=[...(before.operationLog||[]),{id:uid(),label:`Undid ${previous.label}`,at:new Date().toISOString(),summary:describeOperation(before,state)}].slice(-100)
  pendingOperation=null
  saveHistory()
  save()
  messages.push({id:uid(),role:'assistant',text:`Undid: ${previous.label}.`})
  render()
}

function runPlanner({label,startDay}) {
  pushUndo(label)
  const result=planWeek(state.items,planningConfig(),{startDay,idFactory:uid})
  state.items=result.items
  state.lastPlan={label,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  save()
  const moved=result.changes.filter(c=>c.type==='move'||c.type==='schedule').length
  const split=result.changes.filter(c=>c.type==='split').length
  const unresolved=result.unscheduled.length
  messages.push({id:uid(),role:'assistant',text:plannerSummary(moved,split,unresolved)})
  render()
}
function setDayMode(mode) {
  if(!DAY_MODES.includes(mode)||modeForDay(state.dayModes,selectedDay)===mode)return
  pushUndo(`${MODE_LABELS[mode]} day on ${selectedDay}`)
  state.dayModes[selectedDay]=mode
  const config=planningConfig()
  const result=planWeek(state.items,config,{startDay:selectedDay,idFactory:uid})
  state.items=result.items
  state.lastPlan={label:`${MODE_LABELS[mode]} day on ${selectedDay}`,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  save()
  messages.push({id:uid(),role:'assistant',text:`${MODE_LABELS[mode]} day is on for ${selectedDay}. ${MODE_HINTS[mode]} ${result.unscheduled.length?`${result.unscheduled.length} flexible item${result.unscheduled.length===1?' needs':'s need'} another slot.`:'Fixed commitments and protected free time remain in place.'}`})
  render()
}
function runRealityMode() {
  const nowDay=detroitDay()
  const now=selectedDay===nowDay?detroitMinutes():(toMinutes(state.plannerConfig.dayStart)||420)
  pushUndo(`Reality mode on ${selectedDay}`)
  const result=replanDayFromNow(state.items,selectedDay,now,planningConfig(),{idFactory:uid})
  state.items=result.items
  state.lastPlan={label:`Reality mode · ${selectedDay}`,changes:result.changes,unscheduled:result.unscheduled,at:selectedDay===nowDay?`from ${displayTime(minutesToTime(now))}`:'from the start of the day'}
  save()
  const unresolved=result.unscheduled.length
  messages.push({id:uid(),role:'assistant',text:`I replanned forward from ${selectedDay===nowDay?'now':'the start of the day'}, kept fixed commitments anchored, and preserved the free-time target.${unresolved?` ${unresolved} item${unresolved===1?'':'s'} still can’t fit without breaking those constraints.`:''}`})
  render()
}
function plannerSummary(moved,split,unresolved) {
  if(!moved&&!split&&!unresolved)return'Everything already fits the current constraints, so I left the schedule alone.'
  const parts=[]
  if(moved)parts.push(`${moved} flexible block${moved===1?'':'s'} placed or moved`)
  if(split)parts.push(`${split} task${split===1?'':'s'} split across usable blocks`)
  if(unresolved)parts.push(`${unresolved} item${unresolved===1?'':'s'} left unscheduled rather than overpacking the week`)
  return `Planner pass complete: ${parts.join(', ')}.`
}

function toggleItem(id) {
  const it=state.items.find(i=>i.id===id)
  if(it&&!it.skipped){pushUndo(`${it.completed?'Reopened':'Finished'} ${it.title}`);state=it.completed?reopenWork(state,id):finishWork(state,id,{idFactory:uid});save();render()}
}
function skipFlexibleWork(id){
  const it=state.items.find(item=>item.id===id)
  if(!it||it.skipped||it.completed||isFixed(it))return
  pushUndo(`Skipped ${it.title}`)
  state=skipWork(state,id,{idFactory:uid})
  save();render()
}
function resumeFlexibleWork(id){
  const it=state.items.find(item=>item.id===id)
  if(!it?.skipped)return
  pushUndo(`Brought back ${it.title}`)
  state=resumeWork(state,id)
  save();render()
}
function updateActualTime(id,minutes){
  const it=state.items.find(item=>item.id===id)
  if(!it?.completed||it.actualMinutes===minutes)return
  pushUndo(`Recorded time for ${it.title}`)
  state=setActualTime(state,id,minutes)
  save();render()
}
function currentDurationSuggestion(id){
  const item=state.items.find(entry=>entry.id===id)
  return item&&!item.completed&&!item.skipped?durationSuggestion(state.workLog,item.title,item.durationMinutes,state.learningChoices):null
}
function applyDurationSuggestion(id){
  const suggestion=currentDurationSuggestion(id)
  const item=state.items.find(entry=>entry.id===id)
  if(!suggestion||!item)return
  pushUndo(`Updated estimate for ${item.title}`)
  item.durationMinutes=suggestion.suggestedMinutes
  item.start='';item.end=''
  state.learningChoices.push({titleKey:suggestion.titleKey,suggestedMinutes:suggestion.suggestedMinutes,status:'accepted',at:new Date().toISOString()})
  state.learningChoices=state.learningChoices.slice(-100)
  const result=planWeek(state.items,planningConfig(),{startDay:item.day,idFactory:uid})
  state.items=result.items
  state.lastPlan={label:`Updated estimate for ${item.title}`,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  save()
  messages.push({id:uid(),role:'assistant',text:`I changed ${item.title} to a ${formatMinutes(suggestion.suggestedMinutes)} estimate and replanned flexible work. ${result.unscheduled.length?`${result.unscheduled.length} item${result.unscheduled.length===1?' still needs':'s still need'} a slot.`:'Fixed commitments and protected free time stayed in place.'}`})
  render()
}
function ignoreDurationSuggestion(id){
  const suggestion=currentDurationSuggestion(id)
  if(!suggestion)return
  pushUndo('Ignored a duration suggestion')
  state.learningChoices.push({titleKey:suggestion.titleKey,suggestedMinutes:suggestion.suggestedMinutes,status:'ignored',at:new Date().toISOString()})
  state.learningChoices=state.learningChoices.slice(-100)
  save();render()
}
function currentWindowSuggestion(id){
  const item=state.items.find(entry=>entry.id===id)
  return item&&!item.completed&&!item.skipped&&!isFixed(item)?workPattern(state.workLog,item.title,state.learningChoices,item.preferredWindow)?.preferred:null
}
function applyWindowSuggestion(id){
  const suggestion=currentWindowSuggestion(id)
  const item=state.items.find(entry=>entry.id===id)
  if(!suggestion||!item)return
  pushUndo(`Preferred ${suggestion.band} for ${item.title}`)
  item.preferredWindow={...suggestion.window}
  item.start='';item.end=''
  state.learningChoices.push({titleKey:suggestion.titleKey,band:suggestion.band,status:'accepted',at:new Date().toISOString()})
  state.learningChoices=state.learningChoices.slice(-100)
  const result=planWeek(state.items,planningConfig(),{startDay:item.day,idFactory:uid})
  state.items=result.items
  state.lastPlan={label:`Preferred ${suggestion.band} for ${item.title}`,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  save()
  messages.push({id:uid(),role:'assistant',text:`I set ${item.title} to prefer ${suggestion.band} and replanned flexible work. ${result.unscheduled.length?`${result.unscheduled.length} item${result.unscheduled.length===1?' still needs':'s still need'} a slot.`:'Fixed commitments and protected free time stayed in place.'}`})
  render()
}
function ignoreWindowSuggestion(id){
  const suggestion=currentWindowSuggestion(id)
  if(!suggestion)return
  pushUndo('Ignored a time suggestion')
  state.learningChoices.push({titleKey:suggestion.titleKey,band:suggestion.band,status:'ignored',at:new Date().toISOString()})
  state.learningChoices=state.learningChoices.slice(-100)
  save();render()
}
function resetIgnoredSuggestion(index){
  if(state.learningChoices?.[index]?.status!=='ignored')return
  pushUndo('Show a suggestion again')
  state.learningChoices.splice(index,1)
  save();render()
}
function toggleSubtask(itemId,subId) {
  const it=state.items.find(i=>i.id===itemId); const sub=it?.subtasks?.find(s=>s.id===subId)
  if(sub){pushUndo(`Checked ${sub.title}`);sub.completed=!sub.completed;it.completed=it.subtasks.every(s=>s.completed);save();render()}
}

async function analyzeIntake(){
  const textarea=document.querySelector('#brain-dump-input')
  brainDumpText=(textarea?.value||brainDumpText||'').trim()
  if(!brainDumpText||intakeSending)return
  intakeSending=true; render()
  let source='anthropic'
  try{
    const res=await fetch('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:brainDumpText,state,now:new Date().toISOString()})})
    if(!res.ok)throw new Error(await res.text())
    intakeDraft=normalizeIntakeAnalysis(await res.json())
  }catch(err){
    source='offline fallback'
    intakeDraft=localIntakeFallback(brainDumpText)
  }finally{
    intakeSending=false
  }
  const capture=createIntakeCapture({id:uid(),rawText:brainDumpText,analysis:intakeDraft,source})
  intakeCaptureId=capture.id
  pushUndo('Captured brain dump')
  state.inbox.push(capture)
  save(); render()
}

function applyIntakeDraft(){
  if(!intakeDraft)return
  const selected=intakeDraft.items.filter(i=>i.accepted)
  if(!selected.length)return
  pushUndo('Brain dump import')
  const result=applyIntakeAnalysis(state,intakeDraft,{idFactory:uid})
  state=result.state
  const captureIndex=state.inbox.findIndex(item=>item.id===intakeCaptureId)
  if(captureIndex>=0)state.inbox[captureIndex]=finishIntakeCapture(state.inbox[captureIndex],result.applied.map(item=>item.reviewId))

  const scheduler=planWeek(state.items,planningConfig(),{startDay:'Monday',idFactory:uid})
  state.items=scheduler.items
  state.lastPlan={label:'Planned accepted brain dump items',changes:scheduler.changes,unscheduled:scheduler.unscheduled,at:'just now'}
  save()
  const remaining=state.inbox[captureIndex]?.review?.items?.length||0
  messages.push({id:uid(),role:'assistant',text:`I added ${result.applied.length} reviewed item${result.applied.length===1?'':'s'} to your planner and ran the scheduling engine. ${scheduler.unscheduled.length?scheduler.unscheduled.length+' flexible item'+(scheduler.unscheduled.length===1?'':'s')+' could not fit without breaking your constraints. ':''}${remaining?remaining+' item'+(remaining===1?' is':'s are')+' saved in Inbox for later review.':''}`})
  intakeDraft=null
  intakeCaptureId=null
  brainDumpText=''
  view='today'
  render()
}

async function sendMessage(explicit='') {
  const textarea=document.querySelector('#chat-input')
  const text=(explicit || textarea?.value || '').trim(); if(!text||sending)return
  const answering=state.questions.find(item=>item.id===activeQuestionId&&item.status==='pending')
  messages.push({id:uid(),role:'user',text}); sending=true; render()
  try {
    const history=messages.slice(-9,-1).filter(m=>m.id!=='hello'&&(m.role==='user'||(m.role==='assistant'&&!m.error))).map(m=>({role:m.role,text:m.text}))
    const message=answering?`Answer to your earlier question "${answering.text}": ${text}`:text
    const res=await fetch('/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,history,selectedDay,now:new Date().toISOString(),state})})
    if(!res.ok) throw await apiError(res)
    const data=await res.json(); messages.push({id:uid(),role:'assistant',text:data.reply,proposals:data.proposals,questions:data.questions});speakReply(data.reply)
    if(answering){pushUndo('Answered a question');state.questions=resolveQuestion(state.questions,answering.id,'answered');activeQuestionId=null}
    const nextQuestions=captureQuestions(state.questions,data.questions,{idFactory:uid})
    if(!answering&&JSON.stringify(nextQuestions)!==JSON.stringify(state.questions))pushUndo('Planner asked a question')
    state.questions=nextQuestions
    save()
  } catch(err) {
    messages.push({id:uid(),role:'assistant',text:connectionErrorMessage(err),error:true})
  } finally { sending=false; render() }
}

async function apiError(response) {
  let data={}
  try { data=await response.json() } catch { /* The server did not return JSON. */ }
  return Object.assign(new Error(data.error||`Request failed (${response.status}).`),{status:response.status,code:data.code||''})
}
function connectionErrorMessage(error) {
  if(error.status===401) return 'Sign in to your Daylight account to use the AI planner. Your local plan remains available.'
  if(error.code==='missing_key') return 'The AI key is missing from the Netlify Functions environment. Add ANTHROPIC_API_KEY there, then redeploy.'
  if(error.code==='provider_auth') return 'The AI provider rejected the key. Check that the Anthropic key is active and belongs to the right account.'
  if(error.code==='provider_balance') return 'The Anthropic account could not process this request because of its billing or usage status.'
  if(error.code==='provider_model') return 'The selected Anthropic model is unavailable for this key. Check ANTHROPIC_MODEL in Netlify.'
  if(error.code==='provider_request') return 'The AI provider rejected this request. Check the assistant Function log in Netlify for the error type.'
  if(error.status===404) return 'The AI function could not be reached. Check the latest Netlify deploy and function routes.'
  if(error.status===429) return 'The AI service is busy or has reached a rate limit. Please try again shortly.'
  return 'I couldn’t reach the AI right now. Your planner still works; please try again shortly.'
}
function speakReply(text) {
  if(!readRepliesAloud||!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance||!text)return
  globalThis.speechSynthesis.cancel()
  const utterance=new SpeechSynthesisUtterance(String(text).slice(0,900))
  utterance.rate=1
  globalThis.speechSynthesis.speak(utterance)
}
function stopVoice() {
  if(!voiceSession)return
  const session=voiceSession
  voiceSession=null
  voiceTarget=''
  session.stop()
  updateVoiceUI('')
}
function updateVoiceUI(status) {
  document.querySelectorAll('[data-voice]').forEach(button=>{
    const active=button.dataset.voice===voiceTarget
    button.classList.toggle('listening',active)
    button.setAttribute('aria-pressed',String(active))
    button.setAttribute('aria-label',active?'Stop listening':button.dataset.voice==='chat'?'Speak to planner':'Speak brain dump')
  })
  document.querySelectorAll('[data-voice-status]').forEach(node=>{node.textContent=node.dataset.voiceStatus===voiceTarget?status:''})
}
function toggleVoice(target) {
  if(voiceSession){stopVoice();return}
  const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition
  const statusNode=document.querySelector(`[data-voice-status="${target}"]`)
  if(!Recognition){if(statusNode)statusNode.textContent='Voice input is unavailable in this browser. You can still type here.';return}
  const recognition=new Recognition()
  recognition.lang=navigator.language||'en-US'
  recognition.interimResults=true
  recognition.continuous=false
  voiceSession=recognition
  voiceTarget=target
  recognition.onresult=event=>{
    let final='',interim=''
    for(let i=event.resultIndex;i<event.results.length;i++){
      const words=event.results[i][0]?.transcript||''
      if(event.results[i].isFinal)final+=words
      else interim+=words
    }
    if(final){
      const input=document.querySelector(target==='chat'?'#chat-input':'#brain-dump-input')
      if(input){input.value=`${input.value.trim()} ${final.trim()}`.trim();input.dispatchEvent(new Event('input',{bubbles:true}));if(target==='inbox')brainDumpText=input.value}
    }
    updateVoiceUI(interim?`Listening: ${interim}`:'Listening…')
  }
  recognition.onerror=event=>{
    voiceSession=null;voiceTarget='';updateVoiceUI('')
    if(statusNode)statusNode.textContent=event.error==='not-allowed'?'Microphone access was denied. Allow it in your browser to use voice.':'Voice input stopped. Please try again or type instead.'
  }
  recognition.onend=()=>{if(voiceSession===recognition){voiceSession=null;voiceTarget='';updateVoiceUI('')}}
  try{recognition.start();updateVoiceUI('Listening…')}catch{voiceSession=null;voiceTarget='';updateVoiceUI('');if(statusNode)statusNode.textContent='Voice input could not start in this browser.'}
}
function quickAddTask(event) {
  event.preventDefault()
  const form=event.currentTarget
  const title=String(form.elements.title.value||'').trim()
  const durationMinutes=Number(form.elements.duration.value)
  if(!title||!Number.isInteger(durationMinutes)||durationMinutes<1)return
  pushUndo(`Added ${title}`)
  state.items.push(task(uid(),title,selectedDay,'','',durationMinutes,{deadlineDay:selectedDay,priority:2,splittable:durationMinutes>=60}))
  const result=selectedDay===detroitDay()
    ? replanDayFromNow(state.items,selectedDay,detroitMinutes(),planningConfig(),{idFactory:uid})
    : planWeek(state.items,planningConfig(),{startDay:selectedDay,idFactory:uid})
  state.items=result.items
  state.lastPlan={label:`Added ${title}`,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  save()
  messages.push({id:uid(),role:'assistant',text:result.unscheduled.some(i=>i.title===title)?`I added ${title} to your planner, but it needs a slot. I kept your fixed commitments and protected free time intact.`:`I added ${title} and found a feasible slot on ${selectedDay}.`})
  render()
}

function applyProposal(p) {
  pushUndo(`AI change: ${p.title||p.action}`)
  if(p.action==='create') {
    const kind=p.kind||'task'
    state.items.push({
      id:uid(),title:p.title||'Untitled',day:p.day||selectedDay,start:p.start||'',end:p.end||'',
      durationMinutes:p.durationMinutes||durationFromTimes(p.start,p.end)||30,kind,completed:false,
      flexible:kind!=='event',locked:kind==='event',priority:p.priority||2,splittable:kind==='task'?(p.splittable!==false):false,minBlockMinutes:p.minBlockMinutes||30,
      deadlineDay:p.deadlineDay||undefined,preferredWindow:(p.preferredStart||p.preferredEnd)?{start:p.preferredStart||state.plannerConfig.dayStart,end:p.preferredEnd||state.plannerConfig.dayEnd}:undefined,note:p.details||undefined,
    })
    if(kind!=='event') executeEngineAfterProposal(p.day||selectedDay,`Placed: ${p.title||'new task'}`)
  }
  else if(p.action==='move') {
    const it=state.items.find(i=>i.id===p.targetId)
    if(it){if(p.day)it.day=p.day;if(p.start)it.start=p.start;if(p.end)it.end=p.end;if(p.details)it.note=p.details;it.unscheduled=false}
  }
  else if(p.action==='update') {
    const it=state.items.find(i=>i.id===p.targetId)
    if(it){
      if(p.title)it.title=p.title
      if(p.day)it.day=p.day
      if(p.durationMinutes)it.durationMinutes=p.durationMinutes
      if(p.priority)it.priority=p.priority
      if(p.deadlineDay)it.deadlineDay=p.deadlineDay
      if(p.minBlockMinutes)it.minBlockMinutes=p.minBlockMinutes
      it.splittable=p.splittable
      if(p.preferredStart||p.preferredEnd)it.preferredWindow={start:p.preferredStart||state.plannerConfig.dayStart,end:p.preferredEnd||state.plannerConfig.dayEnd}
      if(p.details)it.note=p.details
    }
  }
  else if(p.action==='complete') { const it=state.items.find(i=>i.id===p.targetId); if(it)it.completed=true }
  else if(p.action==='rule') state.rules.push({id:uid(),text:p.details||p.title})
  else if(p.action==='goal') state.goals.push({id:uid(),title:p.title,cadence:p.details||'Ongoing',progress:0,target:1,unit:'target'})
  else if(p.action==='replan') {
    undoStack.pop()
    pendingOperation=null
    runPlanner({label:p.title||`Replanned ${p.day||selectedDay}`,startDay:p.day||selectedDay})
    return
  }
  save()
  if(p.action!=='create'||p.kind==='event')messages.push({id:uid(),role:'assistant',text:`Applied: ${p.title||p.details}`})
  render()
}
function executeEngineAfterProposal(startDay,label) {
  const result=planWeek(state.items,planningConfig(),{startDay,idFactory:uid})
  state.items=result.items
  state.lastPlan={label,changes:result.changes,unscheduled:result.unscheduled,at:'just now'}
  messages.push({id:uid(),role:'assistant',text:result.unscheduled.length?`I added it, but the engine could not place ${result.unscheduled.length} item without breaking your constraints.`:'Added it and fit it into the schedule without moving fixed commitments.'})
}

function typeLabel(value){return ({event:'event',task:'task',routine:'routine',rule:'rule',goal:'goal',metric:'metric',open_loop:'open loop'})[value]||value}
function sampleBrainDump(){return `Monday\n8:30 - Matt\n7:15 - Motion 3D\n7:30hrs of school\n\nTuesday\n8:30 - Music class\n12:45 - Chad\n7:30hrs of school\n\nWednesday\n8:30 - Matt\n7:15 - Motion 3D\n7:30hrs of school\n\nThursday\n12:45 - Chad\n3:45hrs of school - 12:15hrs free\n\nMake my bed everyday.\nGet up as soon as I wake up.\nMake breakfast for me and my mom everyday.\nBrush my teeth. Apply minoxidil. Wash my face and apply cream. Make sure my hair is done, and my beard is clean.\n\nWake up at 7.\nGo to the gym at 8.\nLeave at around 9:30.\nMake sure I have all my homework done.\nBe positive for at least 15 minutes.\nWrite what I thought about.\nGo to school, arrive at least 15 min prior.\nTry to talk to friends, maybe make new ones.\nGet to at least 4000 points before leaving.\n\nFriday\nFree\n\nGo to the gym at least 3 times a week.\nAt least 45min of gym.\nDo homework 2 hours a day.\nIf I wake up at 7, I go to bed at 10:30 - 11:00.`}
function dayItems(day){return state.items.filter(i=>i.day===day&&!i.archived).sort((a,b)=>(a.start||'99:99').localeCompare(b.start||'99:99'))}
function isFixed(i){return i.locked===true||i.flexible===false||i.kind==='event'}
function durationFromTimes(start,end){const s=toMinutes(start),e=toMinutes(end);return s==null||e==null?0:Math.max(0,e-s)}
function displayTime(v){if(!/^\d{2}:\d{2}$/.test(v))return v;const [h,m]=v.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
function minutesToTime(m){return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function formatMinutes(m){if(!m)return'0h';const h=Math.floor(m/60),r=m%60;return`${h?`${h}h`:''}${r?` ${r}m`:''}`.trim()}
function uid(){return globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random()}`}
function shorten(v='',n=180){return String(v).length>n?`${String(v).slice(0,n-1)}…`:String(v)}
function attr(v=''){return esc(v)}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

render()
initializeAccount()
window.addEventListener('online', queueCloudSave)
document.addEventListener('visibilitychange', () => { if(!document.hidden)queueCloudSave() })

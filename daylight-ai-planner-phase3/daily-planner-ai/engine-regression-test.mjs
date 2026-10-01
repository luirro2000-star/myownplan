import { planWeek, replanDayFromNow, detectConflicts, dayMetrics, DEFAULT_PLANNER_CONFIG } from './site/planner-engine.js'

function assert(cond, msg) { if (!cond) throw new Error(msg) }
let uid = 0
const idFactory = () => `part-${++uid}`

// 1. Existing feasible placement should remain unchanged.
{
  const items = [
    {id:'class',day:'Monday',start:'08:30',end:'10:00',kind:'event',flexible:false,locked:true},
    {id:'homework',day:'Monday',start:'16:00',end:'18:00',durationMinutes:120,kind:'task',flexible:true,deadlineDay:'Monday',priority:3,splittable:true,minBlockMinutes:30,preferredWindow:{start:'10:00',end:'21:00'}},
  ]
  const result = planWeek(items, DEFAULT_PLANNER_CONFIG, {startDay:'Monday',idFactory})
  const hw = result.items.find(i=>i.id==='homework')
  assert(hw.start==='16:00' && hw.end==='18:00','feasible existing task moved unnecessarily')
}

// 2. Conflicting flexible work moves, fixed work does not.
{
  const items = [
    {id:'class',day:'Tuesday',start:'12:45',end:'15:30',kind:'event',flexible:false,locked:true,bufferBefore:15},
    {id:'work',day:'Tuesday',start:'13:00',end:'15:00',durationMinutes:120,kind:'task',flexible:true,deadlineDay:'Tuesday',priority:3,splittable:true,minBlockMinutes:30},
  ]
  const result = planWeek(items, DEFAULT_PLANNER_CONFIG, {startDay:'Tuesday',idFactory})
  assert(result.items.find(i=>i.id==='class').start==='12:45','fixed event moved')
  assert(detectConflicts(result.items,'Tuesday').length===0,'conflict remained after planning')
}

// 3. Starting Wednesday should not rewrite Monday/Tuesday history.
{
  const items = [
    {id:'old',day:'Monday',start:'16:00',end:'18:00',durationMinutes:120,kind:'task',flexible:true,deadlineDay:'Monday',priority:3},
    {id:'today',day:'Wednesday',start:'16:00',end:'18:00',durationMinutes:120,kind:'task',flexible:true,deadlineDay:'Wednesday',priority:3},
  ]
  const result = planWeek(items, DEFAULT_PLANNER_CONFIG, {startDay:'Wednesday',idFactory})
  const old = result.items.find(i=>i.id==='old')
  assert(old.day==='Monday' && old.start==='16:00','past day was changed')
}

// 4. Reality mode freezes completed/past history and moves missed future work after now.
{
  const items = [
    {id:'past',day:'Wednesday',start:'10:00',end:'11:00',durationMinutes:60,kind:'task',flexible:true,priority:2,completed:true},
    {id:'missed',day:'Wednesday',start:'14:00',end:'15:00',durationMinutes:60,kind:'task',flexible:true,priority:3,deadlineDay:'Wednesday'},
    {id:'class',day:'Wednesday',start:'19:15',end:'21:00',kind:'event',flexible:false,locked:true},
  ]
  const result = replanDayFromNow(items,'Wednesday',16*60,DEFAULT_PLANNER_CONFIG,{idFactory})
  const past=result.items.find(i=>i.id==='past')
  const missed=result.items.find(i=>i.id==='missed')
  assert(past.start==='10:00','past block changed in reality mode')
  assert(!missed.start || missed.start>='16:00','missed work was replanned into the past')
}

// 5. Protected free time is enforced; impossible work remains unscheduled.
{
  const config=structuredClone(DEFAULT_PLANNER_CONFIG)
  config.protectedFreeMinutes.Monday=600
  const items=[
    {id:'fixed',day:'Monday',start:'08:00',end:'12:00',kind:'event',flexible:false,locked:true},
    {id:'huge',title:'Huge task',day:'Monday',start:'',end:'',durationMinutes:300,kind:'task',flexible:true,deadlineDay:'Monday',priority:4,splittable:false},
  ]
  const result=planWeek(items,config,{startDay:'Monday',idFactory})
  assert(result.unscheduled.some(x=>x.id==='huge'),'impossible task was not marked unscheduled')
  const metrics=dayMetrics(result.items,'Monday',config)
  assert(metrics.openMinutes>=metrics.protectedFreeMinutes,'free-time protection violated')
}

console.log('ENGINE_REGRESSION_TEST_PASS')

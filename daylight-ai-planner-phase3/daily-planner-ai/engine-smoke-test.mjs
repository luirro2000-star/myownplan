import { planWeek, detectConflicts, dayMetrics, DEFAULT_PLANNER_CONFIG } from './site/planner-engine.js'

const items = [
  {id:'fixed',title:'Class',day:'Monday',start:'08:30',end:'10:00',kind:'event',flexible:false,locked:true,bufferBefore:15},
  {id:'task',title:'Homework',day:'Monday',start:'08:45',end:'10:45',durationMinutes:120,kind:'task',flexible:true,priority:3,deadlineDay:'Monday',splittable:true,minBlockMinutes:30,preferredWindow:{start:'07:00',end:'21:00'}},
]
const result = planWeek(items, DEFAULT_PLANNER_CONFIG, {startDay:'Monday', idFactory:(()=>{let i=0; return ()=>`new-${++i}`})()})
console.log(JSON.stringify(result, null, 2))
if (detectConflicts(result.items,'Monday').length) throw new Error('planner left a conflict')
if (!result.items.find(i=>i.id==='task')?.start) throw new Error('task not scheduled')
const metrics = dayMetrics(result.items,'Monday',DEFAULT_PLANNER_CONFIG)
if (metrics.openMinutes < metrics.protectedFreeMinutes) throw new Error('protected free time violated')
console.log('ENGINE_SMOKE_TEST_PASS')

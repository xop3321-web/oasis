import {emptyState,generate,uid,dateOf,shiftDate,daysIn} from './domain.mjs';
export function demoState(month='2026-09'){
 const s=emptyState();const start=month+'-01';s.settings.targets[month]=176;
 const names=['김가온','이하람','박다온','정나래','최여울','강이든','조해솔','윤도담','장보람','임새봄','한마루','오아름'];
 let ix=0;for(let floor=1;floor<=4;floor++)for(let g=0;g<3;g++)for(let j=0;j<(floor===1?2:4);j++){
  const id=`demo-${++ix}`;s.employees.push({id,name:`${names[(ix-1)%names.length]} ${String(ix).padStart(2,'0')}`,floor,group:['A','B','C'][g],kind:'rotation',start:'2024-01-01',end:null,anchor:shiftDate(start,g-3),allowed:['F'],covers:[floor],leaveBalance:12,balanceDate:start,placements:[]});}
 for(const [id,name,kind,covers] of [['lead-1','김팀장','leader',[2,3]],['lead-2','박팀장','leader',[1,4]],['day-1','이주간','day',[1,2,3,4]]])s.employees.push({id,name,kind,covers,floor:covers[0],group:'주',start:'2024-01-01',anchor:'2024-01-01',allowed:kind==='leader'?['D','F']:['D'],leaveBalance:10,balanceDate:start,placements:[]});
 const generated=generate(s,month);s.months[month]={cells:generated.cells,published:{cells:structuredClone(generated.cells),version:1,at:new Date().toISOString()},versions:[],generatedAt:new Date().toISOString()};
 const candidate=s.employees.find(e=>e.floor===3&&e.group==='B');const date=dateOf(month,Math.min(11,daysIn(month)));s.leaves.push({id:uid(),employeeId:candidate.id,date,type:'LF',days:2,hours:16,status:'requested',source:'예시 신청',createdAt:new Date().toISOString()});
 s.requests.push({id:uid(),authorId:'demo-leader',author:'김팀장',employeeId:'day-1',date:dateOf(month,18),floor:3,kind:'change',reason:'목욕 일정에 맞춰 3층 지원을 요청합니다.',agreed:true,status:'pending',changes:[{employeeId:'day-1',date:dateOf(month,18),cell:{type:'D',floor:3,extra:false}}],before:generated.cells[`${dateOf(month,18)}:day-1`]||null,createdAt:new Date().toISOString()});
 s.ledger.push({id:uid(),employeeId:'lead-1',date:start,kind:'initial',hours:16,reason:'예시 기초 잔액',recognized:false});
 return s;
}

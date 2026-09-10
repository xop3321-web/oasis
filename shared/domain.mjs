export const ADMIN_ROLES=['director','manager'];
export const ROLE_LABELS={director:'사무국장',manager:'복지실장',leader:'요양팀장',staff:'요양보호사',pending:'승인 대기'};
export const SHIFT={F:{label:'퐁',hours:17,time:'08:50 – 익일 09:00'},D:{label:'주간',hours:8,time:'08:50 – 18:00'},L:{label:'연차',hours:8},LF:{label:'연차',hours:16},OFF:{label:'휴무',hours:0}};
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const daysIn=m=>new Date(+m.slice(0,4),+m.slice(5),0).getDate();
export const dateOf=(m,n)=>`${m}-${String(n).padStart(2,'0')}`;
export const shiftDate=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const weekDay=date=>new Date(date+'T12:00:00Z').getUTCDay();
export const delta=(a,b)=>Math.round((Date.parse(a+'T00:00Z')-Date.parse(b+'T00:00Z'))/86400000);
export const cellKey=(id,date)=>`${date}:${id}`;
export const active=(e,date)=>e.start<=date&&(!e.end||date<e.end);
export function placement(e,date){return [...(e.placements||[])].filter(p=>p.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0]||{floor:e.floor,group:e.group,anchor:e.anchor};}
export function emptyState(){return {schema:1,revision:0,employees:[],accounts:[],months:{},relations:[],cases:[],leaves:[],ledger:[],requests:[],actuals:[],audit:[],settings:{bath:{1:[0,5],2:[1,3,5],3:[2,3,4],4:[1,2,4]},bathExceptions:{},targets:{},recognitionConfirmed:false}};}
export function getMonth(s,m){return s.months[m]||{cells:{},published:null,versions:[],generatedAt:null};}
export function getCell(s,id,date,cells){const local=cells&&Object.keys(cells).some(k=>k.startsWith(date.slice(0,7)));return local?cells[cellKey(id,date)]:getMonth(s,date.slice(0,7)).cells[cellKey(id,date)];}
export function bath(s,f,date){const override=s.settings.bathExceptions[`${date}:${f}`];return override===undefined?s.settings.bath[f].includes(weekDay(date)):override;}
export function pairConflict(s,a,b,f,date){return s.relations.find(r=>r.level===3&&((r.a===a&&r.b===b)||(r.a===b&&r.b===a))&&(!r.from||r.from<=date)&&(!r.until||r.until>=date));}
export function coworkers(cells,f,date){return Object.entries(cells).filter(([k,v])=>k.startsWith(date+':')&&v.floor===f&&['F','D'].includes(v.type)).map(([k])=>k.slice(11));}
export function consecutive(s,e,date,cells){let count=0;for(let n=1;n<=6;n++){const c=getCell(s,e.id,shiftDate(date,-n),cells);if(['D','F'].includes(c?.type))count++;else break;}return count;}
export function target(s,m){return Number(s.settings.targets[m]??0);}
export function stats(s,e,m,cells=getMonth(s,m).cells){let work=0,leave=0,days=0,extra=0;for(const [key,c] of Object.entries(cells)){if(!key.startsWith(m)||!key.endsWith(':'+e.id))continue;if(['F','D'].includes(c.type)){work+=c.hours??SHIFT[c.type].hours;days++;if(c.extra)extra+=c.hours??SHIFT[c.type].hours;}else leave+=c.hours??SHIFT[c.type]?.hours??0;}const paid=s.ledger.filter(x=>x.employeeId===e.id&&x.kind==='use'&&x.date.startsWith(m)&&x.recognized).reduce((a,x)=>a+x.hours,0);return {work,leave,paid,total:work+leave+paid,days,extra,short:Math.max(0,target(s,m)-work-leave-paid)};}
export function leaveBalance(s,e){const booked=s.leaves.filter(l=>l.employeeId===e.id&&l.status==='approved'&&l.date>=e.balanceDate).reduce((a,l)=>a+l.days,0);return +(Number(e.leaveBalance||0)-booked).toFixed(2);}
export function timeBalance(s,e){return s.ledger.filter(x=>x.employeeId===e.id).reduce((a,x)=>a+(x.kind==='use'?-x.hours:x.hours),0);}
export function canWork(s,e,date,type,floor,cells,{exception=false}={}){
 if(!active(e,date))return '재직 기간 밖';
 if(!e.allowed.includes(type)&&!exception)return '가능 근무유형 아님';
 const existing=getCell(s,e.id,date,cells);if(existing&&existing.type!=='OFF')return '이미 배정된 일정';
 if(getCell(s,e.id,shiftDate(date,-1),cells)?.type==='F')return '퐁 퇴근 당일';
 if(type==='F'&&['F','D'].includes(getCell(s,e.id,shiftDate(date,1),cells)?.type))return '다음 날 근무와 중복';
 if(type==='F'&&getCell(s,e.id,shiftDate(date,-2),cells)?.type==='F')return '퐁 사이 휴식 부족';
 if(e.kind!=='rotation'&&consecutive(s,e,date,cells)>=5)return '최대 5일 연속근무 초과';
 if(coworkers(cells,floor,date).some(id=>pairConflict(s,e.id,id,floor,date)))return '같은 층 배정 금지 관계';
 return null;
}
export function analyze(s,m,cells=getMonth(s,m).cells){
 const issues=[];
 for(let n=1;n<=daysIn(m);n++){const date=dateOf(m,n);for(let f=1;f<=4;f++){
  const list=Object.entries(cells).filter(([k,c])=>k.startsWith(date+':')&&c.floor===f&&['D','F'].includes(c.type));
  const full=list.filter(([,c])=>c.type==='F').length,day=list.filter(([,c])=>c.type==='D').length;
  if(f===1&&full<2)issues.push({id:`${date}:${f}:night`,date,floor:f,kind:'review',label:'1층 퐁 결원 기준 확인 필요',missing:2-full});
  if(f>1&&full<3)issues.push({id:`${date}:${f}:night`,date,floor:f,kind:'review',label:'퐁 2명 이하 · 대응 기준 확인',missing:3-full});
  const need=f===1?(bath(s,f,date)?1:0):Math.max(0,4-full);
  if(day<need)issues.push({id:`${date}:${f}:day`,date,floor:f,kind:'gap',label:f===1?'목욕일 주간 지원 필요':'주간 필수 인원 부족',missing:need-day});
  if(f>1&&full>=4&&day===0&&bath(s,f,date))issues.push({id:`${date}:${f}:bath`,date,floor:f,kind:'prefer',label:'목욕일 추가 지원 권장',missing:1});
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i][0].slice(11),b=list[j][0].slice(11);const r=s.relations.find(r=>((r.a===a&&r.b===b)||(r.a===b&&r.b===a))&&(!r.from||r.from<=date)&&(!r.until||r.until>=date));if(r)issues.push({id:`${date}:${a}:${b}`,date,floor:f,kind:r.level===3?'blocked':'relation',label:`관계 ${r.level}단계 · ${r.level===3?'함께 배정 금지':'분리 검토'}`,employees:[a,b]});}
 }
 for(const e of s.employees){const c=cells[cellKey(e.id,date)];if(!c||!['F','D'].includes(c.type))continue;const without={...cells};delete without[cellKey(e.id,date)];const reason=canWork(s,e,date,c.type,c.floor,without,{exception:c.exception});if(reason&&!reason.includes('관계'))issues.push({id:`${date}:${e.id}:rule`,date,floor:c.floor,kind:'blocked',label:`${e.name} · ${reason}`});}
 }
 return issues;
}
export function generate(s,m){
 const cells={}; const reasons=[]; for(const e of s.employees) for(let n=1;n<=daysIn(m);n++) cells[cellKey(e.id,dateOf(m,n))]={type:'OFF',floor:placement(e,dateOf(m,n)).floor};
 for(let n=1;n<=daysIn(m);n++){const date=dateOf(m,n);for(const e of s.employees.filter(x=>x.kind==='rotation')){const pl=placement(e,date);if(active(e,date)&&delta(date,pl.anchor??e.anchor)%3===0)cells[cellKey(e.id,date)]={type:'F',floor:pl.floor,reason:'전월 퐁당당 순환'};}}
 for(const l of s.leaves.filter(l=>l.status==='approved')){if(l.date.startsWith(m))cells[cellKey(l.employeeId,l.date)]={type:l.type==='LF'?'LF':'L',hours:l.hours,floor:placement(s.employees.find(e=>e.id===l.employeeId),l.date).floor,reason:'승인된 연차'};if(l.type==='LF'){const next=shiftDate(l.date,1);if(next.startsWith(m))cells[cellKey(l.employeeId,next)]={type:'OFF',floor:1,reason:'퐁 연차 연결일',leaveId:l.id};}}
 for(let n=1;n<=daysIn(m);n++){const date=dateOf(m,n);const floors=[1,2,3,4].sort((a,b)=>scoreFloor(b)-scoreFloor(a));function scoreFloor(f){const cs=Object.entries(cells).filter(([k,c])=>k.startsWith(date+':')&&c.floor===f&&c.type==='F').length;return (f===1&&bath(s,f,date)?100:0)+(f>1&&cs<4?80:0)+(bath(s,f,date)?20:0);}
  const pool=s.employees.filter(e=>e.kind!=='rotation'&&active(e,date)).sort((a,b)=>(a.kind==='leader'?-1:0)-(b.kind==='leader'?-1:0));
  for(const e of pool){if(stats(s,e,m,cells).total>=target(s,m)&&target(s,m)>0)continue;
   const candidate=floors.filter(f=>e.kind!=='leader'||e.covers.includes(f)).map(f=>({f,count:coworkers(cells,f,date).length})).sort((a,b)=>{const bonus=x=>(x.f===1?(bath(s,1,date)?3:2):4)-x.count;return bonus(b)-bonus(a)||Number(bath(s,b.f,date))-Number(bath(s,a.f,date));});
   let choice=candidate.find(x=>!canWork(s,e,date,'D',x.f,cells));if(!choice)continue;
   const deficit=choice.f===1?bath(s,1,date)&&choice.count<3:choice.count<4;
   if(consecutive(s,e,date,cells)>=4&&!deficit)continue;
   const learned=s.cases.find(c=>c.active&&c.employeeId===e.id&&c.floor===choice.f&&c.weekday===weekDay(date));
   cells[cellKey(e.id,date)]={type:'D',floor:choice.f,reason:learned?'참고 사례 반영':e.kind==='leader'?'담당 팀장 우선':'주간 근무시간·공백 보충'};
  }
 }
 // Explicit agreements survive regeneration; never silently turn pending proposals into assignments.
 for(const r of s.requests.filter(r=>r.status==='approved'))for(const ch of r.changes||[])if(ch.date.startsWith(m))cells[cellKey(ch.employeeId,ch.date)]={...ch.cell,reason:'협의 완료 근무 유지'};
 // Apply reusable preferences only when legal, without adding an unapproved shift.
 for(const c of s.cases.filter(c=>c.active)){for(let n=1;n<=daysIn(m);n++){const date=dateOf(m,n),key=cellKey(c.employeeId,date),old=cells[key],e=s.employees.find(e=>e.id===c.employeeId);if(!old||!e||old.type!=='D'||weekDay(date)!==c.weekday)continue;const copy={...cells};delete copy[key];if(!canWork(s,e,date,'D',c.floor,copy))cells[key]={...old,floor:c.floor,reason:`참고 사례 · ${c.reason||'동일 요일 지원'}`};}}
 return {cells,issues:analyze(s,m,cells),reasons};
}
export function candidates(s,issue,m){return s.employees.filter(e=>placement(e,issue.date).floor===issue.floor&&e.kind==='rotation').map(e=>({employee:e,reason:canWork(s,e,issue.date,'D',issue.floor,getMonth(s,m).cells,{exception:true}),score:getCell(s,e.id,shiftDate(issue.date,1))?.type==='F'?0:1})).filter(x=>!x.reason).sort((a,b)=>a.score-b.score);}
const publicCells=cells=>Object.fromEntries(Object.entries(cells||{}).map(([k,c])=>[k,{type:c.type,floor:c.floor}]));
export function project(s,actor){if(ADMIN_ROLES.includes(actor.role))return s;return {schema:s.schema,revision:s.revision,employees:s.employees.map(({id,name,floor,group,start,end,placements})=>({id,name,floor,group,start,end,placements:placements?.map(({floor,group,from})=>({floor,group,from}))})),months:Object.fromEntries(Object.entries(s.months).map(([m,v])=>[m,{cells:publicCells(v.published?.cells),published:v.published?{at:v.published.at,version:v.published.version,cells:publicCells(v.published.cells)}:null}])),requests:s.requests.filter(r=>r.authorId===actor.id),settings:{bath:s.settings.bath,bathExceptions:s.settings.bathExceptions,targets:{}},relations:[],cases:[],leaves:[],ledger:[],actuals:[],audit:[],accounts:[]};}
const requireValue=(v,message)=>{if(!v)throw new Error(message);};
export function reduce(state,action,actor){
 const s=structuredClone(state),admin=ADMIN_ROLES.includes(actor.role);const {type,payload:p={}}=action;
 requireValue(admin||(type==='request'&&actor.role==='leader'),'이 작업에 대한 권한이 없습니다.');
 if(['cell','leave','ledger','request','actual'].includes(type))requireValue(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date)),'날짜를 확인하세요.');
 if(['cell','request'].includes(type))requireValue([1,2,3,4].includes(+(p.cell?.floor??p.floor)),'층을 확인하세요.');
 const employee=id=>{const e=s.employees.find(e=>e.id===id);requireValue(e,'직원을 찾을 수 없습니다.');return e;};
 const audit={id:uid(),at:now(),actor:actor.name||actor.id,type,summary:''};
 if(type==='employee'){
  requireValue(p.name?.trim()&&p.name.length<=50,'직원 이름을 입력하세요.');requireValue([1,2,3,4].includes(+p.floor),'층을 선택하세요.');requireValue(['rotation','day','leader'].includes(p.kind),'근무유형이 올바르지 않습니다.');requireValue(/^\d{4}-\d{2}-\d{2}$/.test(p.start),'입사일을 입력하세요.');
  requireValue(!p.end||p.end>p.start,'퇴사일은 입사일 이후여야 합니다.');requireValue(p.kind!=='rotation'||/^\d{4}-\d{2}-\d{2}$/.test(p.anchor),'다음 퐁 시작일을 입력하세요.');requireValue(Number(p.leaveBalance)>=0,'기초 연차는 0 이상이어야 합니다.');
  const id=p.id||uid(),old=s.employees.find(e=>e.id===id);const e={id,name:p.name.trim(),floor:+p.floor,group:p.group||'A',kind:p.kind,start:p.start,end:p.end||null,anchor:p.anchor||p.start,allowed:p.kind==='rotation'?['F']:p.allowF?['D','F']:['D'],covers:(p.covers||[+p.floor]).map(Number).filter(f=>[1,2,3,4].includes(f)),leaveBalance:+p.leaveBalance||0,balanceDate:p.balanceDate||p.start,placements:old?.placements||[]};
  if(old&&(+old.floor!==e.floor||old.group!==e.group)){requireValue(p.effectiveDate,'이동 적용일을 입력하세요.');if(!e.placements.length)e.placements.push({from:old.start,floor:old.floor,group:old.group,anchor:old.anchor});e.placements.push({from:p.effectiveDate,floor:e.floor,group:e.group,anchor:e.anchor});}s.employees=old?s.employees.map(x=>x.id===id?e:x):[...s.employees,e];audit.summary=`${e.name} 직원 정보 저장`;
 }else if(type==='settings'){
  if(p.month){requireValue(/^\d{4}-\d{2}$/.test(p.month)&&Number(p.hours)>0&&Number(p.hours)<400,'월 기준시간을 확인하세요.');s.settings.targets[p.month]=+p.hours;}
  if(p.bath){for(const f of [1,2,3,4]){requireValue(Array.isArray(p.bath[f])&&p.bath[f].every(n=>Number.isInteger(n)&&n>=0&&n<=6),'목욕 요일 오류');}s.settings.bath=p.bath;}
  if(p.exception){const {date,floor,value}=p.exception;requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date)&&[1,2,3,4].includes(+floor)&&typeof value==='boolean','목욕 예외 입력 오류');s.settings.bathExceptions[`${date}:${floor}`]=value;}
  audit.summary='편성 기준 변경';
 }else if(type==='generate'){
  requireValue(target(s,p.month)>0,'먼저 해당 월의 기준근무시간을 입력하세요.');const old=getMonth(s,p.month),generated=generate(s,p.month);s.months[p.month]={...old,cells:generated.cells,generatedAt:now()};audit.summary=`${p.month} 초안 자동편성`;
 }else if(type==='cell'){
  const e=employee(p.employeeId);requireValue(SHIFT[p.cell.type]&&/^\d{4}-\d{2}-\d{2}$/.test(p.date),'근무 정보를 확인하세요.');requireValue(!['L','LF'].includes(p.cell.type),'연차는 연차 신청에서 승인해 주세요.');
  requireValue(!s.leaves.some(l=>l.employeeId===e.id&&l.status==='approved'&&(l.date===p.date||l.type==='LF'&&shiftDate(l.date,1)===p.date)),'승인 연차를 먼저 취소하거나 조정하세요.');
  const m=p.date.slice(0,7),month=getMonth(s,m),cells={...month.cells};delete cells[cellKey(e.id,p.date)];
  if(['F','D'].includes(p.cell.type)){const reason=canWork(s,e,p.date,p.cell.type,+p.cell.floor,cells,{exception:!!p.exception});requireValue(!reason,reason);}
  if(['F','D'].includes(p.cell.type)&&(!month.cells[cellKey(e.id,p.date)]||e.kind==='rotation'&&p.cell.type==='D'||!e.allowed.includes(p.cell.type))){requireValue(p.agreed,'추가·예외 근무는 직원 협의 완료를 확인하세요.');}
  cells[cellKey(e.id,p.date)]={type:p.cell.type,floor:+p.cell.floor,exception:!!p.exception,extra:!!p.agreed,reason:p.reason||'관리자 변경'};s.months[m]={...month,cells};
  if(p.learn&&p.cell.type==='D')s.cases.push({id:uid(),employeeId:e.id,floor:+p.cell.floor,weekday:weekDay(p.date),reason:p.reason||'관리자 선택',active:true});audit.summary=`${p.date} ${e.name} 근무 수정`;
 }else if(type==='relation'){
  employee(p.a);employee(p.b);requireValue(p.a!==p.b&&[1,2,3].includes(+p.level),'직원 두 명과 단계를 선택하세요.');s.relations.push({id:uid(),a:p.a,b:p.b,level:+p.level,from:p.from||'',until:p.until||''});audit.summary='직원 배치 관계 등록';
 }else if(type==='deleteRelation'){s.relations=s.relations.filter(r=>r.id!==p.id);audit.summary='관계 제한 해제';
 }else if(type==='case'){const c=s.cases.find(c=>c.id===p.id);requireValue(c,'사례를 찾을 수 없습니다.');c.active=!!p.active;audit.summary='참고 사례 적용 변경';
 }else if(type==='leave'){
  const e=employee(p.employeeId);requireValue(active(e,p.date),'재직 기간을 확인하세요.');requireValue(['L','LF'].includes(p.type),'연차 유형 오류');requireValue(!s.leaves.some(l=>l.employeeId===e.id&&l.date===p.date&&!['rejected','cancelled'].includes(l.status)),'같은 날짜의 신청이 있습니다.');
  s.leaves.push({id:uid(),employeeId:e.id,date:p.date,type:p.type,days:p.type==='LF'?2:1,hours:p.type==='LF'?16:8,status:'requested',createdAt:now(),source:p.source||'직접 입력'});audit.summary=`${e.name} 연차 신청`;
 }else if(type==='leaveStatus'){
  const l=s.leaves.find(l=>l.id===p.id);requireValue(l,'신청을 찾을 수 없습니다.');requireValue(['approved','adjust','rejected','cancelled'].includes(p.status),'상태 오류');const e=employee(l.employeeId);requireValue(l.status!==p.status,'이미 같은 상태입니다.');
  if(p.status==='approved'&&l.status!=='approved'){requireValue(leaveBalance(s,e)>=l.days,'연차 잔액이 부족합니다.');requireValue(!s.leaves.some(x=>x.id!==l.id&&x.employeeId===e.id&&x.status==='approved'&&[x.date,x.type==='LF'?shiftDate(x.date,1):x.date].some(d=>[l.date,l.type==='LF'?shiftDate(l.date,1):l.date].includes(d))),'다른 승인 연차와 겹칩니다.');}
  const m=l.date.slice(0,7),month=getMonth(s,m);if(p.status==='approved'){l.previousCell=month.cells[cellKey(e.id,l.date)]||null;month.cells[cellKey(e.id,l.date)]={type:l.type,hours:l.hours,floor:placement(e,l.date).floor,reason:'승인 연차',leaveId:l.id};if(l.type==='LF'){const next=shiftDate(l.date,1),nm=next.slice(0,7),nmonth=nm===m?month:getMonth(s,nm);l.nextPrevious=nmonth.cells[cellKey(e.id,next)]||null;nmonth.cells[cellKey(e.id,next)]={type:'OFF',floor:placement(e,next).floor,reason:'퐁 연차 연결일',leaveId:l.id};s.months[nm]=nmonth;}}else if(l.status==='approved'){
   if(l.previousCell)month.cells[cellKey(e.id,l.date)]=l.previousCell;else delete month.cells[cellKey(e.id,l.date)];if(l.type==='LF'){const next=shiftDate(l.date,1),nm=next.slice(0,7),nmonth=nm===m?month:getMonth(s,nm);if(l.nextPrevious)nmonth.cells[cellKey(e.id,next)]=l.nextPrevious;else delete nmonth.cells[cellKey(e.id,next)];s.months[nm]=nmonth;}
  }s.months[m]=month;l.status=p.status;audit.summary=`${e.name} 연차 상태 변경`;
 }else if(type==='ledger'){
  const e=employee(p.employeeId);requireValue(['initial','accrual','use'].includes(p.kind)&&+p.hours>0&&+p.hours<10000&&p.reason?.trim(),'시간과 사유를 입력하세요.');if(p.kind==='use')requireValue(timeBalance(s,e)>=+p.hours,'시간 잔액이 부족합니다.');s.ledger.push({id:uid(),employeeId:e.id,date:p.date,kind:p.kind,hours:+p.hours,reason:p.reason,recognized:!!p.recognized&&p.kind==='use',at:now()});audit.summary=`${e.name} 시간 장부 기록`;
 }else if(type==='request'){
  employee(p.employeeId);requireValue(p.agreed||p.kind==='support','팀장 변경 의견은 직원 협의 여부를 확인하세요.');requireValue(SHIFT[p.shift]&&['F','D','OFF'].includes(p.shift),'근무 유형 오류');const cell={type:p.shift,floor:+p.floor,extra:true,exception:true};const source=getMonth(s,p.date.slice(0,7));const old=(admin?source.cells:source.published?.cells||{})[cellKey(p.employeeId,p.date)]||null;
  s.requests.push({id:uid(),authorId:actor.id,author:actor.name,date:p.date,floor:+p.floor,employeeId:p.employeeId,kind:p.kind||'change',reason:p.reason||'지원 근무 협의',agreed:!!p.agreed,status:'pending',changes:[{employeeId:p.employeeId,date:p.date,cell}],before:old,createdAt:now()});audit.summary='근무 변경·지원 협의 요청';
 }else if(type==='requestStatus'){
  const r=s.requests.find(r=>r.id===p.id);requireValue(r&&r.status==='pending','이미 처리되었거나 없는 요청입니다.');requireValue(r.kind==='support'||actor.role==='director','팀장 변경 의견은 사무국장만 승인합니다.');requireValue(['approved','rejected','hold'].includes(p.status),'상태 오류');if(p.status==='hold'){r.reply=p.reply||'검토 중';audit.summary='요청 보류';}else{
   if(p.status==='approved'){requireValue(p.agreed||r.agreed,'직원 협의 수락을 확인하세요.');for(const ch of r.changes){const e=employee(ch.employeeId);requireValue(!s.leaves.some(l=>l.employeeId===e.id&&l.status==='approved'&&(l.date===ch.date||l.type==='LF'&&shiftDate(l.date,1)===ch.date)),'승인 연차를 먼저 조정하세요.');const m=ch.date.slice(0,7),month=getMonth(s,m),cur=month.cells[cellKey(e.id,ch.date)]||null;requireValue(JSON.stringify(cur)===JSON.stringify(r.before),'요청 이후 근무표가 변경되었습니다. 다시 제출해 주세요.');const copy={...month.cells};delete copy[cellKey(e.id,ch.date)];if(ch.cell.type!=='OFF'){const reason=canWork(s,e,ch.date,ch.cell.type,ch.cell.floor,copy,{exception:true});requireValue(!reason,reason);}month.cells[cellKey(e.id,ch.date)]={...ch.cell,reason:'직원 협의 완료'};s.months[m]=month;}}
   r.status=p.status;r.reply=p.reply||'';r.decidedAt=now();audit.summary='협의·변경 요청 처리';}
 }else if(type==='publish'){
  requireValue(actor.role==='director','공개는 사무국장만 가능합니다.');const month=getMonth(s,p.month);requireValue(Object.keys(month.cells).length,'먼저 초안을 작성하세요.');const issues=analyze(s,p.month);requireValue(!issues.some(i=>['blocked','gap','review'].includes(i.kind)),'미해결 필수 인원·금지 배치를 먼저 해결하세요.');const version=(month.published?.version||0)+1;const published={cells:structuredClone(month.cells),at:now(),version};if(month.published)month.versions=[...(month.versions||[]),month.published].slice(-24);month.published=published;s.months[p.month]=month;audit.summary=`${p.month} v${version} 공개`;
 }else if(type==='actual'){
  const e=employee(p.employeeId);requireValue(+p.hours>=0&&+p.hours<=24&&p.reason?.trim(),'실제 시간과 변경 사유를 확인하세요.');const rec={id:uid(),employeeId:e.id,date:p.date,hours:+p.hours,reason:p.reason,at:now(),actor:actor.name};s.actuals.push(rec);audit.summary=`${e.name} ${p.date} 실제 근무 정정`;
 }else if(type==='account'){
  requireValue(actor.role==='director','계정 권한은 사무국장만 변경할 수 있습니다.');requireValue(['manager','leader','staff','pending'].includes(p.role),'권한 오류');const a=s.accounts.find(a=>a.id===p.id);requireValue(a&&a.id!==actor.id,'대상 계정을 확인하세요.');if(p.role!=='pending')employee(p.employeeId);a.role=p.role;a.employeeId=p.employeeId||null;a.enabled=p.role!=='pending';audit.summary='직원 계정 접근 변경';
 }else throw new Error('지원하지 않는 작업입니다.');
 s.revision++;s.audit.push(audit);return s;
}

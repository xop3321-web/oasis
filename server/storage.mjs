import {emptyState} from '../shared/domain.mjs';
export function configured(){return !!(process.env.APPS_SCRIPT_URL&&process.env.APPS_SCRIPT_SECRET&&process.env.KAKAO_CLIENT_ID&&process.env.SESSION_SECRET?.length>=32&&process.env.INITIAL_ADMIN_KAKAO_ID&&process.env.APP_URL);}
export async function storage(op,payload={}){
 const response=await fetch(process.env.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.APPS_SCRIPT_SECRET,op,...payload}),redirect:'follow',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('공유 저장소에 연결하지 못했습니다.');const out=await response.json();if(!out.ok){const e=new Error(out.error||'공유 저장 오류');e.status=out.conflict?409:503;throw e;}return out;
}
export async function readState(){const out=await storage('read');return out.state||emptyState();}
export async function writeState(state,expected){return storage('write',{state,expected});}

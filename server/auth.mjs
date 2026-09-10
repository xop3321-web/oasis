import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
export function sign(value){return createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('base64url');}
export function cookie(req,name){const v=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return v?decodeURIComponent(v.slice(name.length+1)):null;}
export function token(id){const payload=Buffer.from(JSON.stringify({id,exp:Date.now()+8*3600_000})).toString('base64url');return payload+'.'+sign(payload);}
export function identity(req){try{const [payload,signature]=cookie(req,'oasis_session').split('.');const expected=sign(payload);if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;const data=JSON.parse(Buffer.from(payload,'base64url'));return data.exp>Date.now()?data:null;}catch{return null;}}
export function csrf(id){return sign('csrf:'+id);}
export function actorFor(state,id){if(id===process.env.INITIAL_ADMIN_KAKAO_ID)return {id,role:'director',name:'사무국장'};const a=state.accounts.find(a=>a.id===id);if(!a?.enabled)return {id,role:'pending',name:a?.name||'승인 대기'};const e=state.employees.find(e=>e.id===a.employeeId);const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());if(!e||e.start>today||e.end&&e.end<=today)return {id,role:'pending',name:a.name};return {...a,name:e.name};}
export function setCookie(res,name,value,maxAge=28800){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);}
export const nonce=()=>randomBytes(24).toString('hex');

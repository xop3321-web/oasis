import {configured,readState,writeState} from '../server/storage.mjs';
import {token,setCookie,cookie,nonce,identity,actorFor,csrf} from '../server/auth.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(!configured())return res.status(503).json({error:'카카오 로그인과 공유 저장소 연결이 필요합니다.'});
 const op=req.query.op;const origin=process.env.APP_URL.replace(/\/$/,'');const redirect=origin+'/api/auth?op=callback';
 if(op==='login'){const state=nonce();setCookie(res,'oasis_oauth',state,600);return res.redirect('https://kauth.kakao.com/oauth/authorize?'+new URLSearchParams({client_id:process.env.KAKAO_CLIENT_ID,redirect_uri:redirect,response_type:'code',state}));}
 if(op==='callback'){
  if(!req.query.state||req.query.state!==cookie(req,'oasis_oauth')||!req.query.code)return res.redirect('/?authError=state');
  const body=new URLSearchParams({grant_type:'authorization_code',client_id:process.env.KAKAO_CLIENT_ID,redirect_uri:redirect,code:String(req.query.code)});if(process.env.KAKAO_CLIENT_SECRET)body.set('client_secret',process.env.KAKAO_CLIENT_SECRET);
  const tr=await fetch('https://kauth.kakao.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});if(!tr.ok)return res.redirect('/?authError=token');const tk=await tr.json();
  const ur=await fetch('https://kapi.kakao.com/v2/user/me',{headers:{Authorization:'Bearer '+tk.access_token},signal:AbortSignal.timeout(10000)});if(!ur.ok)return res.redirect('/?authError=user');const me=await ur.json();const id=String(me.id);if(!me.id)throw new Error('카카오 계정을 확인할 수 없습니다.');
  for(let i=0;i<3;i++){const state=await readState();if(id===process.env.INITIAL_ADMIN_KAKAO_ID||state.accounts.some(a=>a.id===id))break;const rev=state.revision;state.accounts.push({id,name:me.properties?.nickname||'새 직원',role:'pending',enabled:false,createdAt:new Date().toISOString()});state.revision++;try{await writeState(state,rev);break;}catch(e){if(e.status!==409||i===2)throw e;}}
  setCookie(res,'oasis_session',token(id));return res.redirect('/');
 }
 const auth=identity(req);if(!auth)return res.status(401).json({error:'로그인이 필요합니다.'});
 if(op==='logout'){if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-csrf-token']!==csrf(auth.id))return res.status(403).json({error:'요청을 확인할 수 없습니다.'});setCookie(res,'oasis_session','',0);return res.status(200).json({ok:true});}
 const state=await readState();return res.status(200).json({actor:actorFor(state,auth.id),csrf:csrf(auth.id)});
 }catch(e){return res.status(e.status||503).json({error:'로그인 또는 저장소 연결을 완료하지 못했습니다. 잠시 후 다시 시도하세요.'});}
}

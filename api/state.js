import {configured,readState,writeState} from '../server/storage.mjs';
import {identity,actorFor,csrf} from '../server/auth.mjs';
import {reduce,project} from '../shared/domain.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(!configured())return res.status(503).json({error:'공유 저장소 설정이 필요합니다.'});const auth=identity(req);if(!auth)return res.status(401).json({error:'로그인이 필요합니다.'});const state=await readState(),actor=actorFor(state,auth.id);if(actor.role==='pending')return res.status(403).json({error:'관리자의 직원 연결 승인을 기다리고 있습니다.'});
 if(req.method==='GET')return res.status(200).json({state:project(state,actor),actor,csrf:csrf(actor.id)});
 if(req.method!=='POST')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 if(req.headers.origin!==process.env.APP_URL.replace(/\/$/,'')||req.headers['x-csrf-token']!==csrf(actor.id))return res.status(403).json({error:'요청을 확인할 수 없습니다.'});
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(body).length>100000)return res.status(413).json({error:'한 번에 너무 많은 데이터입니다.'});
 if(body.revision!==state.revision)return res.status(409).json({error:'다른 관리자가 변경했습니다. 최신 근무표를 새로 불러와 주세요.'});
 const next=reduce(state,body.action,actor);await writeState(next,state.revision);return res.status(200).json({state:project(next,actor)});
 }catch(e){return res.status(e.status||400).json({error:e.message||'변경을 저장하지 못했습니다.'});}
}

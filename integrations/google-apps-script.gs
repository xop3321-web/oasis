/* Google 스프레드시트 > 확장 프로그램 > Apps Script에 이 파일을 붙여넣습니다.
 * 프로젝트 설정 > 스크립트 속성: OASIS_SECRET, SPREADSHEET_ID.
 * 웹 앱으로 배포: 실행 사용자 본인, 액세스 모든 사용자.
 * URL과 동일한 비밀값은 Vercel 서버 환경변수에만 등록합니다.
 * 직원에게 스프레드시트나 스크립트 편집권한을 공유하지 않습니다.
 */
function doPost(e){
 const lock=LockService.getScriptLock();
 try{
  const body=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties();
  if(!props.getProperty('OASIS_SECRET')||body.secret!==props.getProperty('OASIS_SECRET'))return output({ok:false,error:'접근 권한이 없습니다.'});
  if(!lock.tryLock(20000))return output({ok:false,error:'다른 변경을 저장 중입니다. 다시 시도하세요.',conflict:true});
  const book=SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  let sheet=book.getSheetByName('OASIS_STATE');if(!sheet)sheet=book.insertSheet('OASIS_STATE');
  const meta=sheet.getRange('A1:B1').getValues()[0],revision=Number(meta[0]||0),count=Number(meta[1]||0);
  if(body.op==='read'){
   const json=count?sheet.getRange(2,1,count,1).getValues().map(r=>r[0]).join(''):'';
   return output({ok:true,state:json?JSON.parse(Utilities.newBlob(Utilities.base64Decode(json)).getDataAsString('UTF-8')):null});
  }
  if(body.op!=='write')return output({ok:false,error:'지원하지 않는 작업입니다.'});
  if(body.expected!==revision)return output({ok:false,conflict:true,error:'최신 버전을 불러와 주세요.'});
  if(!body.state||body.state.revision!==revision+1)return output({ok:false,error:'버전 정보가 올바르지 않습니다.'});
  const json=Utilities.base64Encode(JSON.stringify(body.state),Utilities.Charset.UTF_8),chunks=[];for(let i=0;i<json.length;i+=40000)chunks.push([json.slice(i,i+40000),'']);
  const values=[[body.state.revision,chunks.length]].concat(chunks);
  if(sheet.getMaxRows()<values.length)sheet.insertRowsAfter(sheet.getMaxRows(),values.length-sheet.getMaxRows());
  sheet.getRange(1,1,values.length,2).setValues(values);SpreadsheetApp.flush();
  return output({ok:true,revision:body.state.revision});
 }catch(error){return output({ok:false,error:'스프레드시트 저장 오류. 관리자 설정을 확인하세요.'});}
 finally{if(lock.hasLock())lock.releaseLock();}
}
function output(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

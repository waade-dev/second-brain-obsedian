import {LibraryError} from './notion.js';
import {taskClient} from './tasks.js';
const UUID=/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const text=v=>(v||[]).map(x=>x.plain_text??x.text?.content??'').join('');
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function validateLog(input){if(!date(input?.date))throw new LibraryError('Choose a valid day.',400);if(typeof input.notes!=='string'||input.notes.trim().length>2000)throw new LibraryError('Use up to 2,000 characters for the work log.',400);if(!Number.isInteger(input.minutes)||input.minutes<0||input.minutes>1440)throw new LibraryError('Time spent must be 0–1,440 minutes.',400);if(!input.notes.trim()&&!input.minutes)throw new LibraryError('Add notes or time spent before saving.',400);return{date:input.date,notes:input.notes.trim(),minutes:input.minutes};}
export function mapLog(p){return{id:p.id,date:p.properties.Due?.date?.start?.slice(0,10)||'',notes:text(p.properties.Notes?.rich_text),minutes:p.properties.Minutes?.number||0,url:p.url};}
export function daybookClient({token,dataSourceId,fetchImpl=fetch}){
  if(!token||!UUID.test(dataSourceId||''))throw new LibraryError('The Notion workspace is not configured.',503);
  async function request(path,method='GET',body){
    for(let attempt=0;attempt<3;attempt++){
      const r=await fetchImpl(`https://api.notion.com/v1${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2026-03-11','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
      if(r.status===429&&attempt<2&&(method==='GET'||path.endsWith('/query'))){await new Promise(resolve=>setTimeout(resolve,1200));continue;}
      if(!r.ok){let detail={};try{detail=await r.json();}catch{}console.error('Daybook Notion request failed',JSON.stringify({status:r.status,path,code:detail.code}));throw new LibraryError(r.status===429?'Notion is busy. Refresh before retrying.':'Notion couldn’t complete the request. Refresh before retrying.',r.status===429?429:502);}
      return r.json();
    }
  }
  async function logs(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw new LibraryError('Choose a valid month.',400);const[y,m]=month.split('-').map(Number),end=`${y}-${String(m).padStart(2,'0')}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`;const result=await request(`/data_sources/${dataSourceId}/query`,'POST',{page_size:100,filter:{and:[{property:'Record type',select:{equals:'Work log'}},{property:'Due',date:{on_or_after:month+'-01'}},{property:'Due',date:{on_or_before:end}}]},sorts:[{property:'Due',direction:'ascending'}]});if(result.has_more||!Array.isArray(result.results)||result.request_status?.incomplete_reason)throw new LibraryError('Notion returned an incomplete month. Refresh before saving.',502);return result.results.filter(p=>!p.archived&&!p.in_trash).map(mapLog);}
  return{
    async setup(){
      const source=await request(`/data_sources/${dataSourceId}`),properties={};
      if(!source.properties['Record type'])properties['Record type']={select:{options:[{name:'Task',color:'blue'},{name:'Work log',color:'green'}]}};
      else if(source.properties['Record type'].type!=='select')throw new LibraryError('Record type must be a select property.',422);
      if(!source.properties.Minutes)properties.Minutes={number:{format:'number'}};
      else if(source.properties.Minutes.type!=='number')throw new LibraryError('Minutes must be a number property.',422);
      if(Object.keys(properties).length)await request(`/data_sources/${dataSourceId}`,'PATCH',{properties});
      return{dataSourceId,databaseId:source.parent?.database_id,properties:Object.keys(source.properties),added:Object.keys(properties)};
    },
    async setupViews(){
      const source=await request(`/data_sources/${dataSourceId}`),databaseId=source.parent.database_id;
      const listing=await request(`/views?database_id=${databaseId}`);
      if(listing.has_more)throw new LibraryError('Inspect all database views before adding another.',422);
      const views=[];for(const ref of listing.results||[])views.push(await request(`/views/${ref.id}`));
      let calendar=views.find(v=>v.type==='calendar'&&v.name==='Daily work calendar');
      if(!calendar)calendar=await request('/views','POST',{database_id:databaseId,data_source_id:dataSourceId,name:'Daily work calendar',type:'calendar',filter:{property:'Record type',select:{equals:'Work log'}},configuration:{type:'calendar',date_property_id:source.properties.Due.id,view_range:'month',show_weekends:true}});
      const board=views.find(v=>v.type==='board');
      if(board&&!JSON.stringify(board.filter||{}).includes('Record type'))await request(`/views/${board.id}`,'PATCH',{filter:board.filter?{and:[board.filter,{or:[{property:'Record type',select:{is_empty:true}},{property:'Record type',select:{does_not_equal:'Work log'}}]}]}:{or:[{property:'Record type',select:{is_empty:true}},{property:'Record type',select:{does_not_equal:'Work log'}}]}});
      return{calendarViewId:calendar.id,boardViewId:board?.id,databaseId,calendarUrl:`https://www.notion.so/${databaseId.replaceAll('-','')}?v=${calendar.id.replaceAll('-','')}`};
    },
    async state(month){const [board,workLogs]=await Promise.all([taskClient({token,dataSourceId,fetchImpl}).list(),logs(month)]);return{tasks:board.rows,logs:workLogs,syncedAt:new Date().toISOString(),calendarUrl:board.databaseUrl+(process.env.NOTION_DAYBOOK_CALENDAR_VIEW_ID?'?v='+process.env.NOTION_DAYBOOK_CALENDAR_VIEW_ID.replaceAll('-',''):''),boardUrl:board.databaseUrl+(process.env.NOTION_DAYBOOK_BOARD_VIEW_ID?'?v='+process.env.NOTION_DAYBOOK_BOARD_VIEW_ID.replaceAll('-',''):'')};},
    async saveLog(input){const log=validateLog(input),existing=(await logs(log.date.slice(0,7))).filter(x=>x.date===log.date);if(existing.length>1)throw new LibraryError('More than one work log exists for this day. Resolve duplicates in Notion before saving.',409);const properties={Name:{title:[{text:{content:`Work log · ${log.date}`}}]},Due:{date:{start:log.date}},Notes:{rich_text:log.notes?[{text:{content:log.notes}}]:[]},Minutes:{number:log.minutes},'Record type':{select:{name:'Work log'}},Status:{status:{name:'Done'}},Link:{url:`https://waade-projects.vercel.app/daily/?date=${log.date}`}};const result=existing.length?await request(`/pages/${existing[0].id}`,'PATCH',{properties}):await request('/pages','POST',{parent:{type:'data_source_id',data_source_id:dataSourceId},properties});return{log:mapLog(result)};},
    async createTask(input){return{task:await taskClient({token,dataSourceId,fetchImpl}).create(input)};},
    async updateTask(input){if(!UUID.test(input?.id||''))throw new LibraryError('Choose a valid task.',400);const page=await request(`/pages/${input.id}`);if(page.properties?.['Record type']?.select?.name==='Work log')throw new LibraryError('Use the calendar to edit a work log.',400);return{task:await taskClient({token,dataSourceId,fetchImpl}).update(input.id,input)};}
  };
}

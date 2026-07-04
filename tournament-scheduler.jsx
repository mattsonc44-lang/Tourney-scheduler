import { useState, useMemo, useEffect, useCallback } from "react";

const P = {
  bg:"#0d1b2a", surface:"#1a2e45", surfaceLight:"#213652",
  border:"#2a4060", accent:"#f5a623", green:"#2ecc71",
  red:"#e74c3c", blue:"#3498db", purple:"#9b59b6",
  text:"#e8f0fe", muted:"#7a9cbf",
};
const TEAM_COLORS = [
  "#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c",
  "#3498db","#9b59b6","#e91e63","#00bcd4","#ff5722",
  "#8bc34a","#607d8b","#ff9800","#673ab7","#4caf50",
];
const GAME_DURATIONS = [30,35,40,45,50,55,60];

const uid = () => Math.random().toString(36).slice(2,8);
const timeMins = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const fmtTime = m => {
  const h=Math.floor(m/60)%24, mn=m%60;
  return `${h%12===0?12:h%12}:${String(mn).padStart(2,"0")} ${h<12?"AM":"PM"}`;
};
const fmtDate = d => {
  if (!d) return "";
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
};
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtSaved = iso => {
  const d=new Date(iso);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+
    d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
};
function roundRobinPairs(teamIds) {
  const pairs=[];
  for(let i=0;i<teamIds.length;i++)
    for(let j=i+1;j<teamIds.length;j++)
      pairs.push([teamIds[i],teamIds[j]]);
  return pairs;
}
const matchKey=(a,b)=>[a,b].sort().join("__");

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const LS_INDEX="ts_index";
const lsKey=id=>`ts_data_${id}`;
function loadIndex(){try{return JSON.parse(localStorage.getItem(LS_INDEX)||"[]");}catch{return[];}}
function saveIndex(idx){localStorage.setItem(LS_INDEX,JSON.stringify(idx));}

// pinnedMatchups: { matchKey: { date, time:"HH:MM", courtId } | null }
// null = in pool but not pinned. Entry present = game is in pool. Missing = excluded entirely.
// We store as plain object (no Sets needed now).
function serializeState(state) {
  return {
    groups: state.groups,
    teams: state.teams,
    courts: state.courts,
    courtGroupPrimary: state.courtGroupPrimary,
    gameDuration: state.gameDuration,
    gamesPerTeam: state.gamesPerTeam,
    gamesPerDay: state.gamesPerDay,
    linkedGroups: state.linkedGroups,
    pinnedMatchups: state.pinnedMatchups,   // { key: null | {date,time,courtId} }
    excludedMatchups: state.excludedMatchups, // Set → array
  };
}
function deserializeState(raw) {
  return {
    ...raw,
    pinnedMatchups: raw.pinnedMatchups||{},
    excludedMatchups: new Set(raw.excludedMatchups||[]),
  };
}
function saveTournament(id,name,state){
  const data={...serializeState(state), excludedMatchups:[...state.excludedMatchups]};
  localStorage.setItem(lsKey(id),JSON.stringify(data));
  const idx=loadIndex();
  const ex=idx.findIndex(x=>x.id===id);
  const entry={id,name,savedAt:new Date().toISOString(),
    summary:`${state.groups.length} groups · ${Object.keys(state.teams).length} teams · ${state.courts.length} courts`};
  if(ex>=0)idx[ex]=entry;else idx.push(entry);
  saveIndex(idx);
}
function loadTournament(id){
  try{const raw=JSON.parse(localStorage.getItem(lsKey(id))||"null");if(!raw)return null;return deserializeState(raw);}
  catch{return null;}
}
function deleteTournament(id){
  localStorage.removeItem(lsKey(id));
  saveIndex(loadIndex().filter(x=>x.id!==id));
}
function blankState(){
  const today=todayStr();
  return {
    groups:[],teams:{},
    courts:[{id:"c1",name:"Court 1",location:"",windows:[{id:"w1",date:today,open:"08:00",close:"17:00"}]}],
    courtGroupPrimary:{},gameDuration:30,linkedGroups:[],
    gamesPerTeam:4,gamesPerDay:2,
    pinnedMatchups:{},excludedMatchups:new Set(),
  };
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const Btn=({children,onClick,variant="primary",small,disabled,style={}})=>{
  const base={border:"none",borderRadius:6,cursor:disabled?"not-allowed":"pointer",
    fontFamily:"inherit",fontWeight:600,transition:"all .15s",
    opacity:disabled?0.4:1,padding:small?"5px 11px":"9px 18px",fontSize:small?12:14,...style};
  const v={
    primary:{background:P.accent,color:"#0d1b2a"},
    secondary:{background:P.surfaceLight,color:P.text,border:`1px solid ${P.border}`},
    danger:{background:"#c0392b18",color:P.red,border:`1px solid ${P.red}44`},
    ghost:{background:"transparent",color:P.muted,border:`1px solid ${P.border}`},
    success:{background:"#1a3d28",color:P.green,border:`1px solid ${P.green}44`},
    pin:{background:P.blue+"22",color:P.blue,border:`1px solid ${P.blue}44`},
  };
  return <button style={{...base,...v[variant]}} onClick={disabled?undefined:onClick}>{children}</button>;
};
const Inp=({value,onChange,placeholder,style={},type="text"})=>(
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.text,
      padding:"7px 10px",fontFamily:"inherit",fontSize:13,outline:"none",
      width:"100%",boxSizing:"border-box",...style}}/>
);
const Card=({children,style={}})=>(
  <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:10,padding:20,...style}}>
    {children}
  </div>
);
const Tag=({label,color,onRemove})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:5,
    background:color+"22",border:`1px solid ${color}55`,color,
    borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
    {label}{onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:0.7}}>✕</span>}
  </span>
);
const Lbl=({children})=>(
  <div style={{color:P.muted,fontSize:11,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>{children}</div>
);
const SecHead=({title,sub})=>(
  <div style={{marginBottom:20}}>
    <h2 style={{margin:0,color:P.accent,fontSize:18,fontWeight:700,letterSpacing:1}}>{title}</h2>
    {sub&&<p style={{margin:"4px 0 0",color:P.muted,fontSize:13}}>{sub}</p>}
  </div>
);
const TimeInp=({value,onChange,color})=>(
  <input type="time" value={value} onChange={e=>onChange(e.target.value)}
    style={{background:"transparent",border:"none",color:color||P.text,
      fontWeight:700,fontSize:13,fontFamily:"inherit",outline:"none",minWidth:90}}/>
);
const DateBadge=({dateStr})=>(
  <span style={{background:P.blue+"22",border:`1px solid ${P.blue}44`,color:P.blue,
    borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700}}>
    {fmtDate(dateStr)||"No date"}
  </span>
);

// ─── MATCHUP ROW ─────────────────────────────────────────────────────────────
// Each matchup can be: excluded | free (auto-schedule) | pinned (fixed slot)
function MatchupRow({ teamA, teamB, mkey, status, pin, courts, allDates, onExclude, onFree, onPin, onUpdatePin }) {
  // status: "excluded" | "free" | "pinned"
  const [expanding, setExpanding] = useState(false);

  const pinBg    = P.blue+"18";
  const pinBdr   = P.blue+"66";
  const freeBg   = P.green+"12";
  const freeBdr  = P.green+"55";
  const exclBg   = P.bg;
  const exclBdr  = P.border;

  const bg  = status==="pinned"?pinBg  : status==="free"?freeBg  : exclBg;
  const bdr = status==="pinned"?pinBdr : status==="free"?freeBdr : exclBdr;

  return (
    <div style={{border:`1.5px solid ${bdr}`,background:bg,borderRadius:9,overflow:"hidden",marginBottom:7}}>
      {/* Main row */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",flexWrap:"wrap"}}>
        {/* Teams */}
        <span style={{fontWeight:700,fontSize:13,color:status==="excluded"?P.muted:teamA.color}}>{teamA.name}</span>
        <span style={{color:P.muted,fontSize:11}}>vs</span>
        <span style={{fontWeight:700,fontSize:13,color:status==="excluded"?P.muted:teamB.color}}>{teamB.name}</span>

        {/* Status badge */}
        {status==="pinned"&&(
          <span style={{background:P.blue+"22",color:P.blue,border:`1px solid ${P.blue}44`,
            borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>
            📌 {pin?.date?fmtDate(pin.date):""} {pin?.time?fmtTime(timeMins(pin.time)):""} {pin?.courtId?(courts.find(c=>c.id===pin.courtId)?.name||""):""}
          </span>
        )}
        {status==="free"&&(
          <span style={{background:P.green+"18",color:P.green,border:`1px solid ${P.green}44`,
            borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>auto-schedule</span>
        )}
        {status==="excluded"&&(
          <span style={{background:"transparent",color:P.muted,border:`1px solid ${P.border}`,
            borderRadius:20,padding:"2px 8px",fontSize:11}}>excluded</span>
        )}

        {/* Actions */}
        <div style={{marginLeft:"auto",display:"flex",gap:5}}>
          {status!=="free"    && <Btn small variant="success" onClick={onFree}>Auto</Btn>}
          {status!=="pinned"  && <Btn small variant="pin" onClick={()=>{onPin();setExpanding(true);}}>📌 Pin</Btn>}
          {status!=="excluded"&& <Btn small variant="danger" onClick={onExclude}>✕ Exclude</Btn>}
          {status==="pinned"  && <Btn small variant="secondary" onClick={()=>setExpanding(e=>!e)}>{expanding?"▲":"▼"}</Btn>}
        </div>
      </div>

      {/* Pin editor — shown when pinned */}
      {status==="pinned"&&expanding&&(
        <div style={{borderTop:`1px solid ${P.blue}33`,padding:"10px 14px",
          background:P.blue+"0d",display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
          <div>
            <Lbl>Date</Lbl>
            <input type="date" value={pin?.date||""} onChange={e=>onUpdatePin("date",e.target.value)}
              style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.blue,
                fontWeight:700,fontSize:13,fontFamily:"inherit",outline:"none",padding:"5px 9px",cursor:"pointer"}}/>
          </div>
          <div>
            <Lbl>Time</Lbl>
            <input type="time" value={pin?.time||""} onChange={e=>onUpdatePin("time",e.target.value)}
              style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.green,
                fontWeight:700,fontSize:13,fontFamily:"inherit",outline:"none",padding:"5px 9px"}}/>
          </div>
          <div>
            <Lbl>Court</Lbl>
            <select value={pin?.courtId||""} onChange={e=>onUpdatePin("courtId",e.target.value)}
              style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.text,
                padding:"6px 10px",fontFamily:"inherit",fontSize:13,outline:"none"}}>
              <option value="">Any court</option>
              {courts.map(c=><option key={c.id} value={c.id}>{c.name}{c.location?` (${c.location})`:""}</option>)}
            </select>
          </div>
          <div style={{fontSize:12,color:P.muted,alignSelf:"flex-end",paddingBottom:2}}>
            Pinned games are placed first; all others fill in automatically.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOURNAMENT DRAWER ───────────────────────────────────────────────────────
function TournamentDrawer({open,onClose,currentId,currentName,onNew,onLoad,onSave,onRename,onDelete}){
  const [index,setIndex]=useState([]);
  const [renaming,setRenaming]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const [newName,setNewName]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(null);
  useEffect(()=>{if(open)setIndex(loadIndex());},[open]);
  const handleSave=()=>{onSave();setIndex(loadIndex());};
  const handleLoad=id=>{onLoad(id);onClose();};
  const handleDelete=id=>{onDelete(id);setIndex(loadIndex());setConfirmDelete(null);};
  const handleRename=id=>{if(!renameVal.trim())return;onRename(id,renameVal.trim());setIndex(loadIndex());setRenaming(null);};
  const handleNew=()=>{if(!newName.trim())return;onNew(newName.trim());setNewName("");onClose();};
  if(!open)return null;
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000066",zIndex:100}}/>
      <div style={{position:"fixed",top:0,left:0,bottom:0,width:340,background:P.surface,
        borderRight:`1px solid ${P.border}`,zIndex:101,display:"flex",flexDirection:"column",
        boxShadow:"4px 0 24px #00000044"}}>
        <div style={{padding:"18px 20px",borderBottom:`1px solid ${P.border}`,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>📋</span>
          <span style={{fontWeight:800,fontSize:16,color:P.accent,flex:1}}>Tournaments</span>
          <span onClick={onClose} style={{cursor:"pointer",color:P.muted,fontSize:18}}>✕</span>
        </div>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${P.border}`,background:P.bg}}>
          <Lbl>Current Tournament</Lbl>
          <div style={{fontWeight:700,color:P.text,marginBottom:10,fontSize:14}}>
            {currentName||<span style={{color:P.muted,fontStyle:"italic"}}>Unsaved</span>}
          </div>
          <Btn onClick={handleSave} style={{width:"100%",textAlign:"center"}}>
            💾 Save{currentName?" Changes":" Tournament"}
          </Btn>
        </div>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${P.border}`}}>
          <Lbl>New Tournament</Lbl>
          <div style={{display:"flex",gap:8}}>
            <Inp value={newName} onChange={setNewName} placeholder="Tournament name…"/>
            <Btn onClick={handleNew} disabled={!newName.trim()} style={{whiteSpace:"nowrap"}}>+ New</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 20px"}}>
          <Lbl>Saved ({index.length})</Lbl>
          {index.length===0&&<div style={{color:P.muted,fontSize:13,fontStyle:"italic",textAlign:"center",padding:"20px 0"}}>No saved tournaments yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
            {[...index].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).map(entry=>{
              const isCurrent=entry.id===currentId;
              const isDeleting=confirmDelete===entry.id;
              const isRenaming=renaming===entry.id;
              return (
                <div key={entry.id} style={{background:isCurrent?P.accent+"18":P.bg,
                  border:`1px solid ${isCurrent?P.accent+"66":P.border}`,borderRadius:8,padding:"12px 14px"}}>
                  {isRenaming?(
                    <div style={{display:"flex",gap:6}}>
                      <Inp value={renameVal} onChange={setRenameVal} placeholder="New name…" style={{fontSize:12}}/>
                      <Btn small onClick={()=>handleRename(entry.id)}>Save</Btn>
                      <Btn small variant="ghost" onClick={()=>setRenaming(null)}>✕</Btn>
                    </div>
                  ):(
                    <>
                      <div style={{marginBottom:6}}>
                        <div style={{fontWeight:700,fontSize:13,color:isCurrent?P.accent:P.text}}>
                          {entry.name}{isCurrent&&<span style={{fontSize:10,color:P.accent,marginLeft:6,fontWeight:400}}>● current</span>}
                        </div>
                        <div style={{color:P.muted,fontSize:11,marginTop:2}}>{entry.summary}</div>
                        <div style={{color:P.muted,fontSize:10,marginTop:2}}>Saved {fmtSaved(entry.savedAt)}</div>
                      </div>
                      {isDeleting?(
                        <div>
                          <div style={{color:P.red,fontSize:12,marginBottom:8}}>Delete "{entry.name}"?</div>
                          <div style={{display:"flex",gap:6}}>
                            <Btn small variant="danger" onClick={()=>handleDelete(entry.id)}>Yes, Delete</Btn>
                            <Btn small variant="ghost" onClick={()=>setConfirmDelete(null)}>Cancel</Btn>
                          </div>
                        </div>
                      ):(
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {!isCurrent&&<Btn small onClick={()=>handleLoad(entry.id)}>📂 Load</Btn>}
                          <Btn small variant="secondary" onClick={()=>{setRenaming(entry.id);setRenameVal(entry.name);}}>✏️ Rename</Btn>
                          <Btn small variant="danger" onClick={()=>setConfirmDelete(entry.id)}>🗑 Delete</Btn>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SCHEDULER ───────────────────────────────────────────────────────────────
/*
  pinnedMatchups: { matchKey: { date, time:"HH:MM", courtId } }
  excludedMatchups: Set of matchKeys

  1. Place pinned games first (fixed slot/court, skip if conflict).
  2. Auto-schedule remaining free games using normal constraint rules.
*/
function generateSchedule({groups,teams,courts,gameDurationMins,linkedGroups,courtGroupPrimary,pinnedMatchups,excludedMatchups,gamesPerTeam,gamesPerDay}){
  // Build all matches for each group (round-robin), respecting excluded/pinned
  const pinnedGames=[];   // { groupId, home, away, date, time, courtId }
  const freeMatches=[];   // { groupId, home, away }

  for(const group of groups){
    const pairs=roundRobinPairs(group.teams);
    for(const [a,b] of pairs){
      const key=matchKey(a,b);
      if(excludedMatchups.has(key)) continue;
      if(pinnedMatchups[key]){
        const p=pinnedMatchups[key];
        pinnedGames.push({groupId:group.id,home:a,away:b,...p});
      } else {
        freeMatches.push({groupId:group.id,home:a,away:b});
      }
    }
  }

  if(pinnedGames.length===0&&freeMatches.length===0||courts.length===0)
    return{slots:[],warnings:["No matches to schedule."]};

  // Linked map
  const linkedMap={};
  for(const link of linkedGroups)
    for(const a of link){linkedMap[a]=linkedMap[a]||new Set();for(const b of link)if(a!==b)linkedMap[a].add(b);}

  // Date index
  const dateSet=new Set();
  for(const court of courts)for(const w of(court.windows||[]))if(w.date)dateSet.add(w.date);
  // Also include pinned game dates
  for(const pg of pinnedGames)if(pg.date)dateSet.add(pg.date);
  const sortedDates=[...dateSet].sort();
  if(sortedDates.length===0)return{slots:[],warnings:["No court availability dates defined."]};
  const dateIndex={};sortedDates.forEach((d,i)=>dateIndex[d]=i);

  // Build slot map
  const courtSlots={};const slotMeta={};
  for(const court of courts){
    courtSlots[court.id]=new Set();
    for(const w of(court.windows||[])){
      if(!w.date||!w.open||!w.close)continue;
      const di=dateIndex[w.date];if(di===undefined)continue;
      const openM=timeMins(w.open),closeM=timeMins(w.close);let cur=openM;
      while(cur<=closeM){
        const key=di*100000+cur;
        courtSlots[court.id].add(key);
        slotMeta[key]={dayIdx:di,date:w.date,absTimeMins:cur,timeLabel:fmtTime(cur)};
        cur+=gameDurationMins;
      }
    }
  }

  const allSlotKeys=[...new Set(Object.values(courtSlots).flatMap(s=>[...s]))].sort((a,b)=>a-b);

  // prev-slot lookup for back-to-back check
  const prevSlotKey={};const keysByDay={};
  for(const key of allSlotKeys){const m=slotMeta[key];(keysByDay[m.dayIdx]=keysByDay[m.dayIdx]||[]).push(key);}
  for(const dayKeys of Object.values(keysByDay)){
    dayKeys.sort((a,b)=>a-b);
    for(let i=1;i<dayKeys.length;i++){
      const prev=slotMeta[dayKeys[i-1]],cur=slotMeta[dayKeys[i]];
      if(prev.absTimeMins+gameDurationMins===cur.absTimeMins)prevSlotKey[dayKeys[i]]=dayKeys[i-1];
    }
  }

  const resultSlots=[];
  const usedCourtSlot={};      // "courtId-slotKey"
  const slotTeamsPlaying={};   // slotKey -> Set<teamId>
  const teamGameCount={};      // teamId -> total games placed
  const teamDayCount={};       // "teamId-dayIdx" -> games that day
  const warnings=[];

  const incTeam=(teamId,dayIdx)=>{
    teamGameCount[teamId]=(teamGameCount[teamId]||0)+1;
    const dk=`${teamId}-${dayIdx}`;
    teamDayCount[dk]=(teamDayCount[dk]||0)+1;
  };

  // Helper: register a placed game
  const placeGame=(slotKey,courtId,match,isPinned,isPrimary)=>{
    const meta=slotMeta[slotKey];
    resultSlots.push({
      slotKey,dayIdx:meta.dayIdx,date:meta.date,
      absTimeMins:meta.absTimeMins,timeLabel:meta.timeLabel,
      courtId,match,isPinned,
      isPrimary:isPrimary||false,
    });
    usedCourtSlot[`${courtId}-${slotKey}`]=true;
    slotTeamsPlaying[slotKey]=slotTeamsPlaying[slotKey]||new Set();
    slotTeamsPlaying[slotKey].add(match.home);
    slotTeamsPlaying[slotKey].add(match.away);
    incTeam(match.home,meta.dayIdx);
    incTeam(match.away,meta.dayIdx);
  };

  // Check constraints (used for auto-scheduled games; pinned games are forced)
  const canPlace=(slotKey,home,away)=>{
    const meta=slotMeta[slotKey];
    const playing=slotTeamsPlaying[slotKey]||new Set();
    if(playing.has(home)||playing.has(away))return false;
    const prevKey=prevSlotKey[slotKey];
    if(prevKey!==undefined){
      const pp=slotTeamsPlaying[prevKey]||new Set();
      if(pp.has(home)||pp.has(away))return false;
    }
    const linked=[...(linkedMap[home]||[]),...(linkedMap[away]||[])];
    if(linked.some(t=>playing.has(t)))return false;
    // Games per team total
    if(gamesPerTeam&&(teamGameCount[home]||0)>=gamesPerTeam)return false;
    if(gamesPerTeam&&(teamGameCount[away]||0)>=gamesPerTeam)return false;
    // Games per team per day
    if(gamesPerDay){
      const di=meta.dayIdx;
      if((teamDayCount[`${home}-${di}`]||0)>=gamesPerDay)return false;
      if((teamDayCount[`${away}-${di}`]||0)>=gamesPerDay)return false;
    }
    return true;
  };

  // ── STEP 1: Place pinned games ──
  for(const pg of pinnedGames){
    const{home,away,date,time,courtId}=pg;
    if(!date||!time){
      // Pinned but missing date/time — treat as free
      freeMatches.push({groupId:pg.groupId,home,away});
      continue;
    }
    const di=dateIndex[date];
    if(di===undefined){warnings.push(`Pinned game ${teams[home]?.name} vs ${teams[away]?.name}: date ${date} not in any court window. Moved to auto-schedule.`);freeMatches.push({groupId:pg.groupId,home,away});continue;}
    const slotKey=di*100000+timeMins(time);

    // Determine court: if courtId specified use it; else find any available court at that slot
    let targetCourt=courtId?courts.find(c=>c.id===courtId):null;
    if(!targetCourt){
      targetCourt=courts.find(c=>courtSlots[c.id].has(slotKey)&&!usedCourtSlot[`${c.id}-${slotKey}`]);
    }
    if(!targetCourt||!courtSlots[targetCourt.id]?.has(slotKey)){
      warnings.push(`Pinned game ${teams[home]?.name} vs ${teams[away]?.name}: court/time not available. Moved to auto-schedule.`);
      freeMatches.push({groupId:pg.groupId,home,away});continue;
    }
    if(usedCourtSlot[`${targetCourt.id}-${slotKey}`]){
      warnings.push(`Pinned game ${teams[home]?.name} vs ${teams[away]?.name}: court already taken at that time. Moved to auto-schedule.`);
      freeMatches.push({groupId:pg.groupId,home,away});continue;
    }
    // Force-place (override back-to-back/limits for pinned games — coordinator's choice)
    if(!slotMeta[slotKey])slotMeta[slotKey]={dayIdx:di,date,absTimeMins:timeMins(time),timeLabel:fmtTime(timeMins(time))};
    placeGame(slotKey,targetCourt.id,{groupId:pg.groupId,home,away},true,false);
  }

  // ── STEP 2: Auto-schedule free games ──
  const unscheduled=[...freeMatches];
  for(const slotKey of allSlotKeys){
    if(unscheduled.length===0)break;
    const availCourts=courts.filter(c=>courtSlots[c.id].has(slotKey)&&!usedCourtSlot[`${c.id}-${slotKey}`]);
    for(const court of availCourts){
      if(unscheduled.length===0)break;
      const primaryGroups=courtGroupPrimary[court.id]||[];
      const sorted=[...unscheduled.filter(m=>primaryGroups.includes(m.groupId)),...unscheduled.filter(m=>!primaryGroups.includes(m.groupId))];
      const idx=sorted.findIndex(m=>canPlace(slotKey,m.home,m.away)&&!usedCourtSlot[`${court.id}-${slotKey}`]);
      if(idx===-1)continue;
      const match=sorted[idx];
      const ri=unscheduled.findIndex(m=>m.groupId===match.groupId&&m.home===match.home&&m.away===match.away);
      unscheduled.splice(ri,1);
      placeGame(slotKey,court.id,match,false,(courtGroupPrimary[court.id]||[]).includes(match.groupId));
    }
  }

  if(unscheduled.length>0)
    warnings.push(`${unscheduled.length} game(s) could not be scheduled — check court availability or constraints.`);

  return{slots:resultSlots,warnings,sortedDates};
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("groups");
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [tournamentId,setTournamentId]=useState(null);
  const [tournamentName,setTournamentName]=useState("");
  const [savedFlash,setSavedFlash]=useState(false);

  // Saveable state
  const [groups,setGroups]=useState([]);
  const [teams,setTeams]=useState({});
  const [pinnedMatchups,setPinnedMatchups]=useState({});      // key -> {date,time,courtId} or null (free)
  const [excludedMatchups,setExcludedMatchups]=useState(new Set()); // keys that are excluded
  const [courts,setCourts]=useState([{id:"c1",name:"Court 1",location:"",windows:[{id:"w1",date:todayStr(),open:"08:00",close:"17:00"}]}]);
  const [courtGroupPrimary,setCourtGroupPrimary]=useState({});
  const [gameDuration,setGameDuration]=useState(30);
  const [gamesPerTeam,setGamesPerTeam]=useState(4);
  const [gamesPerDay,setGamesPerDay]=useState(2);
  const [linkedGroups,setLinkedGroups]=useState([]);

  // UI-only state
  const [newGroupName,setNewGroupName]=useState("");
  const [newTeamName,setNewTeamName]=useState({});
  const [newCourtName,setNewCourtName]=useState("");
  const [newCourtLoc,setNewCourtLoc]=useState("");
  const [linkSelections,setLinkSelections]=useState([]);
  const [schedule,setSchedule]=useState(null);
  const [scheduleWarnings,setScheduleWarnings]=useState([]);

  const currentState=useCallback(()=>({
    groups,teams,courts,courtGroupPrimary,gameDuration,gamesPerTeam,gamesPerDay,linkedGroups,
    pinnedMatchups,excludedMatchups,
  }),[groups,teams,courts,courtGroupPrimary,gameDuration,gamesPerTeam,gamesPerDay,linkedGroups,pinnedMatchups,excludedMatchups]);

  const applyState=st=>{
    setGroups(st.groups||[]);setTeams(st.teams||{});
    setCourts(st.courts||[]);setCourtGroupPrimary(st.courtGroupPrimary||{});
    setGameDuration(st.gameDuration||30);setGamesPerTeam(st.gamesPerTeam||4);setGamesPerDay(st.gamesPerDay||2);setLinkedGroups(st.linkedGroups||[]);
    setPinnedMatchups(st.pinnedMatchups||{});
    setExcludedMatchups(st.excludedMatchups instanceof Set?st.excludedMatchups:new Set(st.excludedMatchups||[]));
    setSchedule(null);setScheduleWarnings([]);setTab("groups");
  };

  const handleSave=useCallback(()=>{
    const id=tournamentId||("t"+uid());
    const name=tournamentName||"Untitled Tournament";
    saveTournament(id,name,currentState());
    setTournamentId(id);setTournamentName(name);
    setSavedFlash(true);setTimeout(()=>setSavedFlash(false),2000);
  },[tournamentId,tournamentName,currentState]);

  const handleLoad=id=>{const st=loadTournament(id);if(!st)return;const idx=loadIndex();const entry=idx.find(x=>x.id===id);setTournamentId(id);setTournamentName(entry?.name||"");applyState(st);};
  const handleNew=name=>{const id="t"+uid();const st=blankState();saveTournament(id,name,st);setTournamentId(id);setTournamentName(name);applyState(st);};
  const handleRename=(id,name)=>{const st=loadTournament(id);if(st)saveTournament(id,name,st);if(id===tournamentId)setTournamentName(name);};
  const handleDelete=id=>{deleteTournament(id);if(id===tournamentId){setTournamentId(null);setTournamentName("");applyState(blankState());}};

  // Groups & Teams
  const addGroup=()=>{if(!newGroupName.trim())return;const id="g"+uid();setGroups(g=>[...g,{id,name:newGroupName.trim(),teams:[]}]);setNewGroupName("");};
  const removeGroup=id=>setGroups(g=>g.filter(x=>x.id!==id));
  const updateGroupName=(id,name)=>setGroups(g=>g.map(x=>x.id===id?{...x,name}:x));
  const addTeam=gid=>{const name=(newTeamName[gid]||"").trim();if(!name)return;const id="t"+uid();const ci=Object.keys(teams).length%TEAM_COLORS.length;setTeams(t=>({...t,[id]:{id,name,color:TEAM_COLORS[ci]}}));setGroups(g=>g.map(x=>x.id===gid?{...x,teams:[...x.teams,id]}:x));setNewTeamName(n=>({...n,[gid]:""}));};
  const removeTeam=(gid,tid)=>{setGroups(g=>g.map(x=>x.id===gid?{...x,teams:x.teams.filter(t=>t!==tid)}:x));setTeams(t=>{const c={...t};delete c[tid];return c;});setLinkedGroups(lg=>lg.map(l=>l.filter(t=>t!==tid)).filter(l=>l.length>1));};
  const updTeamName=(id,name)=>setTeams(t=>({...t,[id]:{...t[id],name}}));
  const updTeamColor=(id,color)=>setTeams(t=>({...t,[id]:{...t[id],color}}));

  // Matchup state helpers
  const setMatchupFree=key=>{
    setPinnedMatchups(p=>{const n={...p};delete n[key];return n;});
    setExcludedMatchups(s=>{const n=new Set(s);n.delete(key);return n;});
  };
  const setMatchupExcluded=key=>{
    setPinnedMatchups(p=>{const n={...p};delete n[key];return n;});
    setExcludedMatchups(s=>new Set([...s,key]));
  };
  const setMatchupPinned=key=>{
    setExcludedMatchups(s=>{const n=new Set(s);n.delete(key);return n;});
    setPinnedMatchups(p=>({...p,[key]:p[key]||{date:todayStr(),time:"09:00",courtId:""}}));
  };
  const updatePin=(key,field,val)=>setPinnedMatchups(p=>({...p,[key]:{...p[key],[field]:val}}));

  const getMatchupStatus=key=>{
    if(excludedMatchups.has(key))return"excluded";
    if(pinnedMatchups[key])return"pinned";
    return"free";
  };

  // Courts
  const today=todayStr();
  const addCourt=()=>{if(!newCourtName.trim())return;const id="c"+uid();setCourts(c=>[...c,{id,name:newCourtName.trim(),location:newCourtLoc.trim(),windows:[{id:"w"+uid(),date:today,open:"08:00",close:"17:00"}]}]);setNewCourtName("");setNewCourtLoc("");};
  const removeCourt=id=>{setCourts(c=>c.filter(x=>x.id!==id));setCourtGroupPrimary(p=>{const c={...p};delete c[id];return c;});};
  const updCourt=(id,f,v)=>setCourts(c=>c.map(x=>x.id===id?{...x,[f]:v}:x));
  const addWindow=cid=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:[...x.windows,{id:"w"+uid(),date:today,open:"08:00",close:"17:00"}]}:x));
  const removeWindow=(cid,wid)=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:x.windows.filter(w=>w.id!==wid)}:x));
  const updWindow=(cid,wid,f,v)=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:x.windows.map(w=>w.id===wid?{...w,[f]:v}:w)}:x));
  const toggleCourtGroup=(cid,gid)=>setCourtGroupPrimary(p=>{const cur=p[cid]||[];return{...p,[cid]:cur.includes(gid)?cur.filter(g=>g!==gid):[...cur,gid]};});

  // Links
  const toggleLinkSel=tid=>setLinkSelections(s=>s.includes(tid)?s.filter(t=>t!==tid):[...s,tid]);
  const addLink=()=>{if(linkSelections.length<2)return;setLinkedGroups(lg=>[...lg,[...linkSelections]]);setLinkSelections([]);};
  const removeLink=i=>setLinkedGroups(lg=>lg.filter((_,j)=>j!==i));

  // Schedule
  const buildSchedule=()=>{
    const res=generateSchedule({groups,teams,courts,gameDurationMins:gameDuration,linkedGroups,courtGroupPrimary,pinnedMatchups,excludedMatchups,gamesPerTeam,gamesPerDay});
    setSchedule(res.slots);setScheduleWarnings(res.warnings||[]);setTab("schedule");
  };

  const allTeams=Object.values(teams);

  // Counts for header
  const {totalGames,pinnedCount,excludedCount}=useMemo(()=>{
    let total=0,pinned=0,excl=0;
    for(const g of groups){
      const pairs=roundRobinPairs(g.teams);
      for(const [a,b] of pairs){
        const k=matchKey(a,b);
        if(excludedMatchups.has(k)){excl++;continue;}
        total++;
        if(pinnedMatchups[k])pinned++;
      }
    }
    return{totalGames:total,pinnedCount:pinned,excludedCount:excl};
  },[groups,pinnedMatchups,excludedMatchups]);

  const totalSlots=courts.reduce((s,c)=>s+(c.windows||[]).reduce((ws,w)=>{
    if(!w.date||!w.open||!w.close)return ws;const diff=timeMins(w.close)-timeMins(w.open);return ws+(diff>=0?Math.floor(diff/gameDuration)+1:0);
  },0),0);

  const scheduleByDate={};
  if(schedule)for(const s of schedule)(scheduleByDate[s.date]=scheduleByDate[s.date]||[]).push(s);
  const scheduleDatesSorted=Object.keys(scheduleByDate).sort();

  // All dates defined across courts (for pin dropdowns)
  const allDates=[...new Set(courts.flatMap(c=>(c.windows||[]).map(w=>w.date).filter(Boolean)))].sort();

  const TABS=[
    {id:"groups",label:"🏅 Groups & Teams"},
    {id:"courts",label:"🏟 Courts & Times"},
    {id:"settings",label:"⚙️ Settings"},
    {id:"links",label:"🔗 Linked Teams"},
    {id:"schedule",label:"📅 Schedule",hi:!!schedule},
  ];

  return (
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,fontFamily:"'Inter','Segoe UI',sans-serif",fontSize:14}}>

      <TournamentDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)}
        currentId={tournamentId} currentName={tournamentName}
        onNew={handleNew} onLoad={handleLoad} onSave={handleSave}
        onRename={handleRename} onDelete={handleDelete}/>

      {/* Header */}
      <div style={{background:P.surface,borderBottom:`1px solid ${P.border}`,padding:"13px 22px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <button onClick={()=>setDrawerOpen(true)} style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",color:P.text,fontFamily:"inherit",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>📋</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontWeight:700,fontSize:13,color:tournamentName?P.accent:P.muted}}>{tournamentName||"New Tournament"}</div>
            <div style={{fontSize:10,color:P.muted}}>{loadIndex().length} saved</div>
          </div>
          <span style={{color:P.muted,fontSize:11,marginLeft:2}}>▼</span>
        </button>
        <input value={tournamentName} onChange={e=>setTournamentName(e.target.value)} placeholder="Tournament name…"
          style={{background:"transparent",border:"none",borderBottom:`1px solid ${P.border}`,color:P.text,fontWeight:600,fontSize:15,fontFamily:"inherit",outline:"none",width:220,padding:"2px 4px"}}/>
        <div style={{color:P.muted,fontSize:12,flex:1}}>
          {totalGames} games · {pinnedCount} pinned · {excludedCount} excluded · {courts.length} courts
        </div>
        <Btn onClick={handleSave} variant={savedFlash?"success":"secondary"} style={{whiteSpace:"nowrap"}}>
          {savedFlash?"✅ Saved!":"💾 Save"}
        </Btn>
        <Btn onClick={buildSchedule} disabled={allTeams.length<2||courts.length===0||totalGames===0} style={{whiteSpace:"nowrap"}}>
          ⚡ Generate
        </Btn>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:P.surface,paddingLeft:12,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"12px 17px",fontFamily:"inherit",fontSize:13,fontWeight:600,whiteSpace:"nowrap",color:tab===t.id?P.accent:P.muted,borderBottom:tab===t.id?`2px solid ${P.accent}`:"2px solid transparent",transition:"all .15s",position:"relative"}}>
            {t.label}
            {t.hi&&tab!==t.id&&<span style={{position:"absolute",top:8,right:8,width:7,height:7,borderRadius:"50%",background:P.green}}/>}
          </button>
        ))}
      </div>

      <div style={{padding:22,maxWidth:1000,margin:"0 auto"}}>

        {/* ══ GROUPS & TEAMS ════════════════════════════════════════════════ */}
        {tab==="groups"&&(
          <div>
            <SecHead title="Groups & Teams"
              sub="Each matchup can be auto-scheduled, pinned to a specific time/court, or excluded entirely."/>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <Inp value={newGroupName} onChange={setNewGroupName} placeholder="New group name…"/>
              <Btn onClick={addGroup} style={{whiteSpace:"nowrap"}}>+ Add Group</Btn>
            </div>
            {groups.length===0&&<Card style={{textAlign:"center",color:P.muted,padding:40}}>No groups yet.</Card>}
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {groups.map(group=>{
                const pairs=roundRobinPairs(group.teams);
                const statuses=pairs.map(([a,b])=>getMatchupStatus(matchKey(a,b)));
                const nPinned=statuses.filter(s=>s==="pinned").length;
                const nExcluded=statuses.filter(s=>s==="excluded").length;
                const nFree=statuses.filter(s=>s==="free").length;
                return (
                  <Card key={group.id}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <input value={group.name} onChange={e=>updateGroupName(group.id,e.target.value)}
                        style={{background:"transparent",border:"none",color:P.accent,fontWeight:700,fontSize:15,fontFamily:"inherit",outline:"none",flex:1}}/>
                      <span style={{color:P.muted,fontSize:12}}>{group.teams.length} teams</span>
                      <Btn variant="danger" small onClick={()=>removeGroup(group.id)}>Remove</Btn>
                    </div>

                    {/* Teams */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
                      {group.teams.map(tid=>{
                        const team=teams[tid];if(!team)return null;
                        return (
                          <div key={tid} style={{background:team.color+"18",border:`1px solid ${team.color}44`,borderRadius:8,padding:"5px 9px",display:"flex",alignItems:"center",gap:7}}>
                            <input type="color" value={team.color} onChange={e=>updTeamColor(tid,e.target.value)} style={{width:16,height:16,border:"none",borderRadius:3,cursor:"pointer",background:"none"}}/>
                            <input value={team.name} onChange={e=>updTeamName(tid,e.target.value)} style={{background:"transparent",border:"none",color:team.color,fontWeight:600,fontSize:13,fontFamily:"inherit",outline:"none",width:85}}/>
                            <span onClick={()=>removeTeam(group.id,tid)} style={{cursor:"pointer",color:P.muted,fontSize:11}}>✕</span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{display:"flex",gap:8,marginBottom:pairs.length>0?16:0}}>
                      <Inp value={newTeamName[group.id]||""} onChange={v=>setNewTeamName(n=>({...n,[group.id]:v}))} placeholder="Team name…" style={{maxWidth:210}}/>
                      <Btn variant="secondary" small onClick={()=>addTeam(group.id)}>+ Add Team</Btn>
                    </div>

                    {/* Matchups */}
                    {pairs.length>0&&(
                      <div style={{borderTop:`1px solid ${P.border}`,paddingTop:14}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{color:P.text,fontWeight:600,fontSize:13}}>Matchups</span>
                            {nFree>0&&<span style={{background:P.green+"18",color:P.green,border:`1px solid ${P.green}44`,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{nFree} auto</span>}
                            {nPinned>0&&<span style={{background:P.blue+"22",color:P.blue,border:`1px solid ${P.blue}44`,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>📌 {nPinned} pinned</span>}
                            {nExcluded>0&&<span style={{background:"transparent",color:P.muted,border:`1px solid ${P.border}`,borderRadius:20,padding:"2px 8px",fontSize:11}}>{nExcluded} excluded</span>}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <Btn variant="ghost" small onClick={()=>pairs.forEach(([a,b])=>setMatchupFree(matchKey(a,b)))}>All Auto</Btn>
                            <Btn variant="danger" small onClick={()=>pairs.forEach(([a,b])=>setMatchupExcluded(matchKey(a,b)))}>Exclude All</Btn>
                          </div>
                        </div>
                        {group.teams.length<2&&<div style={{color:P.muted,fontSize:12,fontStyle:"italic"}}>Add at least 2 teams to configure matchups.</div>}
                        {pairs.map(([a,b])=>{
                          const key=matchKey(a,b);
                          const status=getMatchupStatus(key);
                          const teamA=teams[a],teamB=teams[b];
                          if(!teamA||!teamB)return null;
                          return (
                            <MatchupRow key={key}
                              teamA={teamA} teamB={teamB} mkey={key}
                              status={status} pin={pinnedMatchups[key]}
                              courts={courts} allDates={allDates}
                              onFree={()=>setMatchupFree(key)}
                              onPin={()=>setMatchupPinned(key)}
                              onExclude={()=>setMatchupExcluded(key)}
                              onUpdatePin={(f,v)=>updatePin(key,f,v)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COURTS & TIMES ════════════════════════════════════════════════ */}
        {tab==="courts"&&(
          <div>
            <SecHead title="Courts & Availability" sub="Set each court's open dates/times and which groups play there primarily."/>
            <Card style={{marginBottom:16}}>
              <div style={{fontWeight:600,color:P.accent,marginBottom:11}}>Add New Court</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"end"}}>
                <div><Lbl>Court Name</Lbl><Inp value={newCourtName} onChange={setNewCourtName} placeholder="Court 3"/></div>
                <div><Lbl>Location (optional)</Lbl><Inp value={newCourtLoc} onChange={setNewCourtLoc} placeholder="East Gym"/></div>
                <Btn onClick={addCourt}>+ Add</Btn>
              </div>
            </Card>
            {courts.length===0&&<Card style={{textAlign:"center",color:P.muted,padding:40}}>No courts yet.</Card>}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {courts.map((court,ci)=>{
                const primaryGroups=courtGroupPrimary[court.id]||[];
                const winsByDate={};
                for(const w of court.windows||[]){const d=w.date||"no-date";(winsByDate[d]=winsByDate[d]||[]).push(w);}
                const winDates=Object.keys(winsByDate).sort();
                return (
                  <Card key={court.id}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                      <div style={{width:32,height:32,borderRadius:7,background:P.blue+"22",border:`1px solid ${P.blue}44`,display:"flex",alignItems:"center",justifyContent:"center",color:P.blue,fontWeight:700,fontSize:13}}>{ci+1}</div>
                      <input value={court.name} onChange={e=>updCourt(court.id,"name",e.target.value)} style={{background:"transparent",border:"none",color:P.text,fontWeight:700,fontSize:15,fontFamily:"inherit",outline:"none",flex:1}}/>
                      <input value={court.location} onChange={e=>updCourt(court.id,"location",e.target.value)} placeholder="Location…" style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:5,color:P.muted,padding:"5px 9px",fontFamily:"inherit",fontSize:12,outline:"none",width:140}}/>
                      <Btn variant="danger" small onClick={()=>removeCourt(court.id)}>Remove</Btn>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                          <Lbl>Availability Windows</Lbl>
                          <Btn variant="ghost" small onClick={()=>addWindow(court.id)}>+ Add Window</Btn>
                        </div>
                        {(court.windows||[]).length===0&&<div style={{color:P.muted,fontSize:12,fontStyle:"italic"}}>No windows set.</div>}
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {winDates.map(dateKey=>(
                            <div key={dateKey}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <DateBadge dateStr={dateKey==="no-date"?"":dateKey}/>
                                {dateKey==="no-date"&&<span style={{color:P.red,fontSize:11}}>⚠ No date</span>}
                              </div>
                              <div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:4}}>
                                {winsByDate[dateKey].map(win=>(
                                  <div key={win.id} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",background:P.bg,border:`1px solid ${P.border}`,borderRadius:7,padding:"8px 11px"}}>
                                    <input type="date" value={win.date||""} onChange={e=>updWindow(court.id,win.id,"date",e.target.value)} style={{background:"transparent",border:"none",color:P.blue,fontWeight:700,fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:130}}/>
                                    <span style={{color:P.border,fontSize:12}}>|</span>
                                    <TimeInp value={win.open} onChange={v=>updWindow(court.id,win.id,"open",v)} color={P.green}/>
                                    <span style={{color:P.muted,fontSize:13}}>→</span>
                                    <TimeInp value={win.close} onChange={v=>updWindow(court.id,win.id,"close",v)} color={P.red}/>
                                    {win.open&&win.close&&(()=>{const d=timeMins(win.close)-timeMins(win.open);const s=d>=0?Math.floor(d/gameDuration)+1:0;return <span style={{color:P.muted,fontSize:11}}>{s} slot{s!==1?"s":""}</span>;})()}
                                    <span onClick={()=>removeWindow(court.id,win.id)} style={{marginLeft:"auto",cursor:"pointer",color:P.muted,fontSize:12}}>✕</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {(court.windows||[]).length>0&&(()=>{const tot=(court.windows||[]).reduce((s,w)=>{const d=timeMins(w.close||"00:00")-timeMins(w.open||"00:00");return s+(d>=0?d:0);},0);const sl=(court.windows||[]).reduce((s,w)=>{const d=timeMins(w.close||"00:00")-timeMins(w.open||"00:00");return s+(d>=0?Math.floor(d/gameDuration)+1:0);},0);const dates=[...new Set((court.windows||[]).map(w=>w.date).filter(Boolean))];return <div style={{marginTop:8,fontSize:11,color:P.muted}}>{dates.length} day{dates.length!==1?"s":""} · {tot} min · ~{sl} slot{sl!==1?"s":""}</div>;})()}
                      </div>
                      <div>
                        <Lbl>Primary Groups (preferred)</Lbl>
                        <div style={{fontSize:12,color:P.muted,marginBottom:10}}>These groups are scheduled here first.</div>
                        {groups.length===0&&<div style={{color:P.muted,fontSize:12,fontStyle:"italic"}}>No groups defined yet.</div>}
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {groups.map(group=>{
                            const on=primaryGroups.includes(group.id);
                            return (
                              <div key={group.id} onClick={()=>toggleCourtGroup(court.id,group.id)}
                                style={{cursor:"pointer",borderRadius:7,padding:"7px 11px",display:"flex",alignItems:"center",gap:9,transition:"all .15s",background:on?P.accent+"18":P.bg,border:`1px solid ${on?P.accent+"88":P.border}`}}>
                                <div style={{width:16,height:16,borderRadius:4,background:on?P.accent:"transparent",border:`2px solid ${on?P.accent:P.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#0d1b2a",fontWeight:800}}>{on?"✓":""}</div>
                                <span style={{fontWeight:600,color:on?P.accent:P.muted,fontSize:13}}>{group.name}</span>
                                <span style={{color:P.muted,fontSize:11,marginLeft:"auto"}}>{group.teams.length} teams</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {courts.length>0&&(
              <Card style={{marginTop:16,background:P.bg}}>
                <Lbl>Availability Overview</Lbl>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  {courts.map(court=>{
                    const pgs=(courtGroupPrimary[court.id]||[]).map(gid=>groups.find(g=>g.id===gid)?.name).filter(Boolean);
                    const dateList=[...new Set((court.windows||[]).map(w=>w.date).filter(Boolean))].sort();
                    return (
                      <div key={court.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderTop:`1px solid ${P.border}`}}>
                        <span style={{color:P.text,fontWeight:600,minWidth:90,fontSize:13}}>{court.name}</span>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,flex:1}}>
                          {dateList.length===0?<span style={{color:P.border,fontSize:12}}>No dates set</span>:dateList.map(d=>{
                            const wins=(court.windows||[]).filter(w=>w.date===d);
                            return <span key={d} style={{background:P.surfaceLight,border:`1px solid ${P.border}`,borderRadius:6,padding:"3px 8px",fontSize:12}}><span style={{color:P.blue,fontWeight:600}}>{fmtDate(d)}</span><span style={{color:P.muted,marginLeft:5}}>{wins.map(w=>`${fmtTime(timeMins(w.open))}–${fmtTime(timeMins(w.close))}`).join(", ")}</span></span>;
                          })}
                        </div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",minWidth:80}}>
                          {pgs.length===0?<span style={{color:P.border,fontSize:11}}>No primary</span>:pgs.map(n=><Tag key={n} label={n} color={P.accent}/>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ SETTINGS ══════════════════════════════════════════════════════ */}
        {tab==="settings"&&(
          <div>
            <SecHead title="Schedule Settings" sub="Configure game duration, games per team, and daily limits."/>
            <Card style={{maxWidth:500}}>

              {/* Game Duration */}
              <div style={{marginBottom:24}}>
                <Lbl>Game Duration</Lbl>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {GAME_DURATIONS.map(m=>(
                    <button key={m} onClick={()=>setGameDuration(m)} style={{
                      border:`2px solid ${gameDuration===m?P.accent:P.border}`,
                      background:gameDuration===m?P.accent+"22":P.bg,
                      color:gameDuration===m?P.accent:P.muted,
                      borderRadius:8,padding:"8px 16px",cursor:"pointer",
                      fontFamily:"inherit",fontWeight:700,fontSize:13,transition:"all .15s",
                    }}>{m} min</button>
                  ))}
                </div>
              </div>

              {/* Games Per Team */}
              <div style={{marginBottom:24}}>
                <Lbl>Games Per Team (total)</Lbl>
                <div style={{fontSize:12,color:P.muted,marginBottom:10}}>
                  Max games each team plays across the entire tournament.
                </div>
                <div style={{display:"flex",gap:8}}>
                  {[3,4,5,6].map(n=>(
                    <button key={n} onClick={()=>setGamesPerTeam(n)} style={{
                      border:`2px solid ${gamesPerTeam===n?P.accent:P.border}`,
                      background:gamesPerTeam===n?P.accent+"22":P.bg,
                      color:gamesPerTeam===n?P.accent:P.muted,
                      borderRadius:8,padding:"8px 20px",cursor:"pointer",
                      fontFamily:"inherit",fontWeight:700,fontSize:15,transition:"all .15s",
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Games Per Day */}
              <div style={{marginBottom:24}}>
                <Lbl>Max Games Per Team Per Day</Lbl>
                <div style={{fontSize:12,color:P.muted,marginBottom:10}}>
                  How many games a team can play in a single day.
                </div>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4].map(n=>(
                    <button key={n} onClick={()=>setGamesPerDay(n)} style={{
                      border:`2px solid ${gamesPerDay===n?P.accent:P.border}`,
                      background:gamesPerDay===n?P.accent+"22":P.bg,
                      color:gamesPerDay===n?P.accent:P.muted,
                      borderRadius:8,padding:"8px 20px",cursor:"pointer",
                      fontFamily:"inherit",fontWeight:700,fontSize:15,transition:"all .15s",
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={{background:P.bg,borderRadius:8,padding:14,border:`1px solid ${P.border}`}}>
                <Lbl>Summary</Lbl>
                {[
                  ["Total matchups",totalGames],
                  ["Pinned",pinnedCount],
                  ["Auto-schedule",totalGames-pinnedCount],
                  ["Courts",courts.length],
                  ["Available slots",totalSlots],
                  ["Max games / team",gamesPerTeam],
                  ["Max games / day",gamesPerDay],
                  ["Capacity",totalSlots>=totalGames?"✅ Enough":"⚠️ May not fit"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{color:P.muted}}>{l}</span>
                    <span style={{color:P.accent,fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══ LINKED TEAMS ══════════════════════════════════════════════════ */}
        {tab==="links"&&(
          <div>
            <SecHead title="Linked Teams" sub="Linked teams cannot be scheduled at the same time."/>
            <Card style={{marginBottom:16}}>
              <div style={{fontWeight:600,color:P.accent,marginBottom:8}}>Create a link</div>
              <div style={{fontSize:12,color:P.muted,marginBottom:11}}>Select 2+ teams that must not play simultaneously:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:13}}>
                {allTeams.map(team=>{const sel=linkSelections.includes(team.id);return <div key={team.id} onClick={()=>toggleLinkSel(team.id)} style={{cursor:"pointer",borderRadius:20,padding:"5px 13px",fontSize:13,fontWeight:600,background:sel?team.color+"33":P.bg,border:`2px solid ${sel?team.color:P.border}`,color:sel?team.color:P.muted,transition:"all .15s"}}>{team.name}</div>;})}
                {allTeams.length===0&&<span style={{color:P.muted}}>No teams yet.</span>}
              </div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={addLink} disabled={linkSelections.length<2}>🔗 Link ({linkSelections.length})</Btn>
                {linkSelections.length>0&&<Btn variant="ghost" small onClick={()=>setLinkSelections([])}>Clear</Btn>}
              </div>
            </Card>
            {linkedGroups.length===0&&<Card style={{textAlign:"center",color:P.muted,padding:30}}>No linked groups.</Card>}
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {linkedGroups.map((link,i)=>(
                <Card key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:P.accent,fontSize:16}}>🔗</span>
                  <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:6}}>
                    {link.map((tid,j)=>{const team=teams[tid];if(!team)return null;return <span key={tid}><Tag label={team.name} color={team.color}/>{j<link.length-1&&<span style={{color:P.muted,margin:"0 4px",fontSize:12}}>+</span>}</span>;})}
                  </div>
                  <Btn variant="danger" small onClick={()=>removeLink(i)}>Remove</Btn>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ══ SCHEDULE ══════════════════════════════════════════════════════ */}
        {tab==="schedule"&&(
          <div>
            <SecHead title="Generated Schedule" sub={schedule?`${schedule.length} games across ${scheduleDatesSorted.length} day(s)`:"Generate a schedule to see it here."}/>
            {scheduleWarnings.map((w,i)=>(
              <div key={i} style={{background:"#7d1d0022",border:`1px solid ${P.red}55`,borderRadius:8,padding:"10px 15px",color:P.red,marginBottom:10,fontSize:13}}>⚠️ {w}</div>
            ))}
            {!schedule&&<Card style={{textAlign:"center",padding:60}}>
              <div style={{fontSize:44,marginBottom:14}}>📅</div>
              <div style={{color:P.muted,marginBottom:18}}>Configure groups, courts, and matchups, then generate.</div>
              <Btn onClick={buildSchedule} disabled={allTeams.length<2||courts.length===0}>⚡ Generate Schedule</Btn>
            </Card>}
            {schedule&&schedule.length===0&&scheduleWarnings.length===0&&<Card style={{textAlign:"center",padding:40,color:P.muted}}>No games placed.</Card>}
            {schedule&&schedule.length>0&&(()=>(
              <>
                <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
                  {allTeams.map(t=><Tag key={t.id} label={t.name} color={t.color}/>)}
                </div>
                {scheduleDatesSorted.map(date=>{
                  const daySlots=scheduleByDate[date]||[];
                  const slotKeys=[...new Set(daySlots.map(s=>s.slotKey))].sort((a,b)=>a-b);
                  return (
                    <div key={date} style={{marginBottom:28}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                        <div style={{background:P.blue+"22",border:`1px solid ${P.blue}44`,borderRadius:8,padding:"6px 14px",color:P.blue,fontWeight:800,fontSize:15}}>📅 {fmtDate(date)}</div>
                        <div style={{color:P.muted,fontSize:12}}>{daySlots.length} game{daySlots.length!==1?"s":""} · {daySlots.filter(s=>s.isPinned).length} pinned</div>
                        <div style={{flex:1,height:1,background:P.border}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {slotKeys.map(sk=>{
                          const skGames=daySlots.filter(s=>s.slotKey===sk);
                          const slotTime=skGames[0]?.absTimeMins??0;
                          return (
                            <div key={sk} style={{display:"flex",alignItems:"stretch"}}>
                              <div style={{width:86,minWidth:86,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:P.surfaceLight,border:`1px solid ${P.border}`,borderRight:"none",borderRadius:"8px 0 0 8px",padding:"8px 4px"}}>
                                <div style={{color:P.accent,fontWeight:700,fontSize:12,textAlign:"center"}}>{skGames[0]?.timeLabel}</div>
                                <div style={{color:P.muted,fontSize:10}}>{gameDuration}min</div>
                              </div>
                              <div style={{flex:1,display:"grid",gridTemplateColumns:`repeat(${courts.length},1fr)`,border:`1px solid ${P.border}`,borderRadius:"0 8px 8px 0",overflow:"hidden"}}>
                                {courts.map((court,ci)=>{
                                  const game=skGames.find(s=>s.courtId===court.id);
                                  const home=game?teams[game.match.home]:null;
                                  const away=game?teams[game.match.away]:null;
                                  const grp=game?groups.find(g=>g.id===game.match.groupId):null;
                                  const courtOpen=(court.windows||[]).some(w=>w.date===date&&timeMins(w.open)<=slotTime&&slotTime+gameDuration<=timeMins(w.close));
                                  const closed=!courtOpen&&!game?.isPinned;
                                  return (
                                    <div key={court.id} style={{background:closed?"#0a1520":game?.isPinned?P.blue+"18":game?P.surface:P.bg,borderLeft:ci>0?`1px solid ${P.border}`:"none",padding:"8px 11px",minHeight:60,display:"flex",flexDirection:"column",justifyContent:"center",opacity:closed?0.45:1}}>
                                      <div style={{color:P.muted,fontSize:10,marginBottom:4,fontWeight:600}}>{court.name}{court.location?` · ${court.location}`:""}</div>
                                      {closed?<div style={{color:P.border,fontSize:11,fontStyle:"italic"}}>— closed —</div>
                                        :game&&home&&away?<div>
                                          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                                            <span style={{color:home.color,fontWeight:700,fontSize:13}}>{home.name}</span>
                                            <span style={{color:P.muted,fontSize:10}}>vs</span>
                                            <span style={{color:away.color,fontWeight:700,fontSize:13}}>{away.name}</span>
                                          </div>
                                          <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                                            {grp&&<span style={{fontSize:10,color:P.muted,background:P.bg,borderRadius:4,padding:"1px 5px",border:`1px solid ${P.border}`}}>{grp.name}</span>}
                                            {game.isPinned&&<span style={{fontSize:10,color:P.blue,background:P.blue+"18",borderRadius:4,padding:"1px 5px",border:`1px solid ${P.blue}44`}}>📌 pinned</span>}
                                            {game.isPrimary&&!game.isPinned&&<span style={{fontSize:10,color:P.accent,background:P.accent+"18",borderRadius:4,padding:"1px 5px",border:`1px solid ${P.accent}44`}}>★ primary</span>}
                                          </div>
                                        </div>:<div style={{color:P.border,fontSize:11,fontStyle:"italic"}}>— open —</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:28}}>
                  <div style={{color:P.accent,fontWeight:700,fontSize:15,marginBottom:12}}>Team Schedules</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:12}}>
                    {allTeams.map(team=>{
                      const tGames=schedule.filter(s=>s.match.home===team.id||s.match.away===team.id).sort((a,b)=>a.slotKey-b.slotKey);
                      return (
                        <Card key={team.id} style={{borderLeft:`3px solid ${team.color}`}}>
                          <div style={{color:team.color,fontWeight:700,marginBottom:9}}>
                            {team.name}<span style={{color:P.muted,fontWeight:400,fontSize:12,marginLeft:6}}>{tGames.length} game{tGames.length!==1?"s":""}</span>
                          </div>
                          {tGames.map((s,i)=>{
                            const opp=s.match.home===team.id?teams[s.match.away]:teams[s.match.home];
                            const crt=courts.find(c=>c.id===s.courtId);
                            return (
                              <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0",borderTop:i>0?`1px solid ${P.border}`:"none"}}>
                                <div style={{minWidth:60}}>
                                  <div style={{color:P.blue,fontSize:10,fontWeight:600}}>{fmtDate(s.date)}</div>
                                  <div style={{color:P.accent,fontSize:12}}>{s.timeLabel}</div>
                                </div>
                                <span style={{color:P.muted,fontSize:11}}>vs</span>
                                <span style={{color:opp?.color,fontWeight:600,fontSize:13,flex:1}}>{opp?.name}</span>
                                <span style={{color:P.muted,fontSize:11}}>{crt?.name}</span>
                                {s.isPinned&&<span style={{fontSize:10,color:P.blue}}>📌</span>}
                              </div>
                            );
                          })}
                        </Card>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginTop:20}}><Btn onClick={buildSchedule} variant="secondary">↺ Regenerate</Btn></div>
              </>
            ))()}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const P = {
  bg:"#0d1b2a", surface:"#1a2e45", surfaceLight:"#213652",
  border:"#2a4060", accent:"#f5a623", green:"#2ecc71",
  red:"#e74c3c", blue:"#3498db", text:"#e8f0fe", muted:"#7a9cbf",
};
const TEAM_COLORS = [
  "#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c",
  "#3498db","#9b59b6","#e91e63","#00bcd4","#ff5722",
  "#8bc34a","#607d8b","#ff9800","#673ab7","#4caf50",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

// Build all round-robin pairs for a list of teamIds
function roundRobinPairs(teamIds) {
  const pairs = [];
  for (let i=0; i<teamIds.length; i++)
    for (let j=i+1; j<teamIds.length; j++)
      pairs.push([teamIds[i], teamIds[j]]);
  return pairs;
}

// Matchup key (canonical, order-independent)
const matchKey = (a,b) => [a,b].sort().join("__");

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant="primary", small, disabled, style={} }) => {
  const base = {
    border:"none", borderRadius:6, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"inherit", fontWeight:600, transition:"all .15s",
    opacity:disabled?0.4:1, padding:small?"5px 11px":"9px 18px", fontSize:small?12:14, ...style,
  };
  const v = {
    primary:   {background:P.accent,color:"#0d1b2a"},
    secondary: {background:P.surfaceLight,color:P.text,border:`1px solid ${P.border}`},
    danger:    {background:"#c0392b18",color:P.red,border:`1px solid ${P.red}44`},
    ghost:     {background:"transparent",color:P.muted,border:`1px solid ${P.border}`},
    success:   {background:"#1a3d28",color:P.green,border:`1px solid ${P.green}44`},
  };
  return <button style={{...base,...v[variant]}} onClick={disabled?undefined:onClick}>{children}</button>;
};

const Inp = ({ value, onChange, placeholder, style={}, type="text" }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.text,
      padding:"7px 10px",fontFamily:"inherit",fontSize:13,outline:"none",
      width:"100%",boxSizing:"border-box",...style}} />
);

const Card = ({ children, style={} }) => (
  <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:10,padding:20,...style}}>
    {children}
  </div>
);

const Tag = ({ label, color, onRemove }) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:5,
    background:color+"22",border:`1px solid ${color}55`,color,
    borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
    {label}
    {onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:0.7}}>✕</span>}
  </span>
);

const Lbl = ({ children }) => (
  <div style={{color:P.muted,fontSize:11,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
    {children}
  </div>
);

const SecHead = ({ title, sub }) => (
  <div style={{marginBottom:20}}>
    <h2 style={{margin:0,color:P.accent,fontSize:18,fontWeight:700,letterSpacing:1}}>{title}</h2>
    {sub&&<p style={{margin:"4px 0 0",color:P.muted,fontSize:13}}>{sub}</p>}
  </div>
);

const TimeInp = ({ value, onChange, color }) => (
  <input type="time" value={value} onChange={e=>onChange(e.target.value)}
    style={{background:"transparent",border:"none",color:color||P.text,
      fontWeight:700,fontSize:13,fontFamily:"inherit",outline:"none",minWidth:90}} />
);

const DateBadge = ({ dateStr }) => (
  <span style={{background:P.blue+"22",border:`1px solid ${P.blue}44`,color:P.blue,
    borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700}}>
    {fmtDate(dateStr)||"No date"}
  </span>
);

// ─── MATCHUP CHIP ─────────────────────────────────────────────────────────────
// Shows "TeamA vs TeamB" as a toggleable pill
function MatchupChip({ teamA, teamB, enabled, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display:"inline-flex", alignItems:"center", gap:6,
      borderRadius:8, padding:"6px 10px", cursor:"pointer",
      border:`1.5px solid ${enabled ? P.accent+"88" : P.border}`,
      background: enabled ? P.accent+"12" : P.bg,
      transition:"all .15s", userSelect:"none",
    }}>
      {/* Checkbox */}
      <div style={{
        width:14, height:14, borderRadius:3, flexShrink:0,
        background: enabled ? P.accent : "transparent",
        border:`2px solid ${enabled ? P.accent : P.border}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:9, color:"#0d1b2a", fontWeight:900,
      }}>{enabled?"✓":""}</div>
      {/* Home */}
      <span style={{
        fontWeight:700, fontSize:12,
        color: enabled ? teamA.color : P.muted,
      }}>{teamA.name}</span>
      <span style={{color:P.border,fontSize:11}}>vs</span>
      {/* Away */}
      <span style={{
        fontWeight:700, fontSize:12,
        color: enabled ? teamB.color : P.muted,
      }}>{teamB.name}</span>
    </div>
  );
}

// ─── SCHEDULER ───────────────────────────────────────────────────────────────
function generateSchedule({ groups, teams, courts, gameDurationMins, linkedGroups, courtGroupPrimary, groupMatchups }) {
  // Build match list — use groupMatchups (enabled set) if defined, else full round-robin
  const allMatches = [];
  for (const group of groups) {
    const enabledKeys = groupMatchups[group.id]; // Set of matchKey strings, or undefined=all
    const pairs = roundRobinPairs(group.teams);
    for (const [a,b] of pairs) {
      const key = matchKey(a,b);
      if (enabledKeys===undefined || enabledKeys.has(key)) {
        allMatches.push({ groupId:group.id, home:a, away:b });
      }
    }
  }
  if (allMatches.length===0 || courts.length===0) return { slots:[], warnings:["No matches to schedule."] };

  // Linked map
  const linkedMap = {};
  for (const link of linkedGroups)
    for (const a of link) {
      linkedMap[a]=linkedMap[a]||new Set();
      for (const b of link) if(a!==b) linkedMap[a].add(b);
    }

  const dateSet = new Set();
  for (const court of courts)
    for (const w of (court.windows||[]))
      if (w.date) dateSet.add(w.date);
  const sortedDates = [...dateSet].sort();
  if (sortedDates.length===0) return { slots:[], warnings:["No court availability dates defined."] };

  const dateIndex = {};
  sortedDates.forEach((d,i)=>dateIndex[d]=i);

  const courtSlots = {};
  const slotMeta = {};
  for (const court of courts) {
    courtSlots[court.id]=new Set();
    for (const w of (court.windows||[])) {
      if (!w.date||!w.open||!w.close) continue;
      const di=dateIndex[w.date]; if(di===undefined) continue;
      const openM=timeMins(w.open), closeM=timeMins(w.close);
      let cur=openM;
      while(cur+gameDurationMins<=closeM) {
        const key=di*100000+cur;
        courtSlots[court.id].add(key);
        slotMeta[key]={dayIdx:di,date:w.date,absTimeMins:cur,timeLabel:fmtTime(cur)};
        cur+=gameDurationMins;
      }
    }
  }

  const allSlotKeys=[...new Set(Object.values(courtSlots).flatMap(s=>[...s]))].sort((a,b)=>a-b);
  if (allSlotKeys.length===0) return { slots:[], warnings:["No valid game slots."] };

  const prevSlotKey={};
  const keysByDay={};
  for (const key of allSlotKeys) {
    const m=slotMeta[key];
    (keysByDay[m.dayIdx]=keysByDay[m.dayIdx]||[]).push(key);
  }
  for (const dayKeys of Object.values(keysByDay)) {
    dayKeys.sort((a,b)=>a-b);
    for (let i=1;i<dayKeys.length;i++) {
      const prev=slotMeta[dayKeys[i-1]], cur=slotMeta[dayKeys[i]];
      if (prev.absTimeMins+gameDurationMins===cur.absTimeMins)
        prevSlotKey[dayKeys[i]]=dayKeys[i-1];
    }
  }

  const resultSlots=[];
  const usedCourtSlot={};
  const slotTeamsPlaying={};
  const unscheduled=[...allMatches];

  for (const slotKey of allSlotKeys) {
    if (unscheduled.length===0) break;
    const availCourts=courts.filter(c=>courtSlots[c.id].has(slotKey)&&!usedCourtSlot[`${c.id}-${slotKey}`]);
    for (const court of availCourts) {
      if (unscheduled.length===0) break;
      const primaryGroups=courtGroupPrimary[court.id]||[];
      const sorted=[
        ...unscheduled.filter(m=>primaryGroups.includes(m.groupId)),
        ...unscheduled.filter(m=>!primaryGroups.includes(m.groupId)),
      ];
      const idx=sorted.findIndex(m=>{
        const {home,away}=m;
        const playing=slotTeamsPlaying[slotKey]||new Set();
        if(playing.has(home)||playing.has(away)) return false;
        const prevKey=prevSlotKey[slotKey];
        if(prevKey!==undefined){
          const pp=slotTeamsPlaying[prevKey]||new Set();
          if(pp.has(home)||pp.has(away)) return false;
        }
        const linked=[...(linkedMap[home]||[]),...(linkedMap[away]||[])];
        if(linked.some(t=>playing.has(t))) return false;
        return true;
      });
      if(idx===-1) continue;
      const match=sorted[idx];
      const realIdx=unscheduled.findIndex(m=>m.groupId===match.groupId&&m.home===match.home&&m.away===match.away);
      unscheduled.splice(realIdx,1);
      const meta=slotMeta[slotKey];
      resultSlots.push({
        slotKey, dayIdx:meta.dayIdx, date:meta.date,
        absTimeMins:meta.absTimeMins, timeLabel:meta.timeLabel,
        courtId:court.id, match,
        isPrimary:(courtGroupPrimary[court.id]||[]).includes(match.groupId),
      });
      usedCourtSlot[`${court.id}-${slotKey}`]=true;
      slotTeamsPlaying[slotKey]=slotTeamsPlaying[slotKey]||new Set();
      slotTeamsPlaying[slotKey].add(match.home);
      slotTeamsPlaying[slotKey].add(match.away);
    }
  }

  const warnings=[];
  if (unscheduled.length>0)
    warnings.push(`${unscheduled.length} game(s) could not be scheduled — check court availability or constraints.`);
  return { slots:resultSlots, warnings, sortedDates };
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("groups");

  const [groups, setGroups] = useState([
    { id:"g1", name:"Division A", teams:["t1","t2","t3","t4"] },
  ]);
  const [teams, setTeams] = useState({
    t1:{id:"t1",name:"Eagles", color:TEAM_COLORS[0]},
    t2:{id:"t2",name:"Hawks",  color:TEAM_COLORS[1]},
    t3:{id:"t3",name:"Falcons",color:TEAM_COLORS[2]},
    t4:{id:"t4",name:"Ravens", color:TEAM_COLORS[3]},
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [newTeamName, setNewTeamName]   = useState({});

  // groupMatchups: { groupId: Set<matchKey> }
  // If a group's entry is missing, ALL round-robin pairs are included (default)
  const [groupMatchups, setGroupMatchups] = useState({});

  const today = todayStr();
  const [courts, setCourts] = useState([
    { id:"c1", name:"Court 1", location:"Main Gym",  windows:[{id:"w1",date:today,open:"08:00",close:"17:00"}] },
    { id:"c2", name:"Court 2", location:"Main Gym",  windows:[{id:"w2",date:today,open:"08:00",close:"17:00"}] },
  ]);
  const [newCourtName, setNewCourtName] = useState("");
  const [newCourtLoc,  setNewCourtLoc]  = useState("");
  const [courtGroupPrimary, setCourtGroupPrimary] = useState({});

  const [gameDuration, setGameDuration] = useState(30);
  const [linkedGroups,   setLinkedGroups]   = useState([]);
  const [linkSelections, setLinkSelections] = useState([]);

  const [schedule,         setSchedule]         = useState(null);
  const [scheduleWarnings, setScheduleWarnings] = useState([]);
  const [scheduleDates,    setScheduleDates]    = useState([]);

  // ── Groups & Teams ──────────────────────────────────────────────────────
  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const id="g"+uid();
    setGroups(g=>[...g,{id,name:newGroupName.trim(),teams:[]}]);
    setNewGroupName("");
  };
  const removeGroup = id => {
    setGroups(g=>g.filter(x=>x.id!==id));
    setGroupMatchups(m=>{ const c={...m}; delete c[id]; return c; });
  };
  const updateGroupName=(id,name)=>setGroups(g=>g.map(x=>x.id===id?{...x,name}:x));

  const addTeam = gid => {
    const name=(newTeamName[gid]||"").trim(); if(!name) return;
    const id="t"+uid();
    const ci=Object.keys(teams).length%TEAM_COLORS.length;
    setTeams(t=>({...t,[id]:{id,name,color:TEAM_COLORS[ci]}}));
    setGroups(g=>g.map(x=>x.id===gid?{...x,teams:[...x.teams,id]}:x));
    setNewTeamName(n=>({...n,[gid]:""}));
    // Adding a team invalidates any existing matchup selections for this group
    setGroupMatchups(m=>{ const c={...m}; delete c[gid]; return c; });
  };
  const removeTeam=(gid,tid)=>{
    setGroups(g=>g.map(x=>x.id===gid?{...x,teams:x.teams.filter(t=>t!==tid)}:x));
    setTeams(t=>{ const c={...t}; delete c[tid]; return c; });
    setLinkedGroups(lg=>lg.map(l=>l.filter(t=>t!==tid)).filter(l=>l.length>1));
    // Remove any matchups involving this team from all groups
    setGroupMatchups(m=>{
      const next={...m};
      for (const gid2 in next) {
        const s=new Set([...next[gid2]].filter(k=>!k.includes(tid)));
        next[gid2]=s;
      }
      return next;
    });
  };
  const updTeamName =(id,name) =>setTeams(t=>({...t,[id]:{...t[id],name}}));
  const updTeamColor=(id,color)=>setTeams(t=>({...t,[id]:{...t[id],color}}));

  // ── Matchup toggles ─────────────────────────────────────────────────────
  // Get effective enabled set for a group (undefined means all-on)
  const getEnabledSet = (gid, teamIds) => {
    if (groupMatchups[gid]) return groupMatchups[gid];
    // Default: all pairs enabled — return a full set
    const all = new Set(roundRobinPairs(teamIds).map(([a,b])=>matchKey(a,b)));
    return all;
  };

  const toggleMatchup = (gid, teamIds, keyStr) => {
    setGroupMatchups(m => {
      const full = new Set(roundRobinPairs(teamIds).map(([a,b])=>matchKey(a,b)));
      const cur = m[gid] ? new Set(m[gid]) : new Set(full);
      if (cur.has(keyStr)) cur.delete(keyStr); else cur.add(keyStr);
      return {...m, [gid]:cur};
    });
  };

  const selectAllMatchups = (gid, teamIds) => {
    const all=new Set(roundRobinPairs(teamIds).map(([a,b])=>matchKey(a,b)));
    setGroupMatchups(m=>({...m,[gid]:all}));
  };
  const clearAllMatchups = (gid) => {
    setGroupMatchups(m=>({...m,[gid]:new Set()}));
  };

  // ── Courts ──────────────────────────────────────────────────────────────
  const addCourt=()=>{
    if(!newCourtName.trim()) return;
    const id="c"+uid();
    setCourts(c=>[...c,{id,name:newCourtName.trim(),location:newCourtLoc.trim(),
      windows:[{id:"w"+uid(),date:today,open:"08:00",close:"17:00"}]}]);
    setNewCourtName(""); setNewCourtLoc("");
  };
  const removeCourt=id=>{
    setCourts(c=>c.filter(x=>x.id!==id));
    setCourtGroupPrimary(p=>{const c={...p};delete c[id];return c;});
  };
  const updCourt=(id,field,val)=>setCourts(c=>c.map(x=>x.id===id?{...x,[field]:val}:x));
  const addWindow=cid=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:[...x.windows,{id:"w"+uid(),date:today,open:"08:00",close:"17:00"}]}:x));
  const removeWindow=(cid,wid)=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:x.windows.filter(w=>w.id!==wid)}:x));
  const updWindow=(cid,wid,field,val)=>setCourts(c=>c.map(x=>x.id===cid?{...x,windows:x.windows.map(w=>w.id===wid?{...w,[field]:val}:w)}:x));
  const toggleCourtGroup=(cid,gid)=>setCourtGroupPrimary(p=>{
    const cur=p[cid]||[];
    return {...p,[cid]:cur.includes(gid)?cur.filter(g=>g!==gid):[...cur,gid]};
  });

  // ── Links ────────────────────────────────────────────────────────────────
  const toggleLinkSel=tid=>setLinkSelections(s=>s.includes(tid)?s.filter(t=>t!==tid):[...s,tid]);
  const addLink=()=>{
    if(linkSelections.length<2) return;
    setLinkedGroups(lg=>[...lg,[...linkSelections]]); setLinkSelections([]);
  };
  const removeLink=i=>setLinkedGroups(lg=>lg.filter((_,j)=>j!==i));

  // ── Schedule ─────────────────────────────────────────────────────────────
  const buildSchedule=()=>{
    // Convert groupMatchups Sets for use in scheduler
    const effectiveMatchups={};
    for (const group of groups) {
      effectiveMatchups[group.id]=getEnabledSet(group.id, group.teams);
    }
    const res=generateSchedule({groups,teams,courts,gameDurationMins:gameDuration,linkedGroups,courtGroupPrimary,groupMatchups:effectiveMatchups});
    setSchedule(res.slots);
    setScheduleWarnings(res.warnings||[]);
    setScheduleDates(res.sortedDates||[]);
    setTab("schedule");
  };

  const allTeams=Object.values(teams);
  const totalEnabledMatches=useMemo(()=>{
    return groups.reduce((s,g)=>{
      const en=getEnabledSet(g.id,g.teams);
      return s+en.size;
    },0);
  },[groups,groupMatchups]);

  const totalSlots=courts.reduce((s,c)=>{
    return s+(c.windows||[]).reduce((ws,w)=>{
      if(!w.date||!w.open||!w.close) return ws;
      const diff=timeMins(w.close)-timeMins(w.open);
      return ws+(diff>0?Math.floor(diff/gameDuration):0);
    },0);
  },0);

  const scheduleByDate={};
  if (schedule) for(const s of schedule)(scheduleByDate[s.date]=scheduleByDate[s.date]||[]).push(s);
  const scheduleDatesSorted=Object.keys(scheduleByDate).sort();

  const TABS=[
    {id:"groups", label:"🏅 Groups & Teams"},
    {id:"courts", label:"🏟 Courts & Times"},
    {id:"settings",label:"⚙️ Settings"},
    {id:"links",  label:"🔗 Linked Teams"},
    {id:"schedule",label:"📅 Schedule",hi:!!schedule},
  ];

  return (
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,fontFamily:"'Inter','Segoe UI',sans-serif",fontSize:14}}>

      {/* Header */}
      <div style={{background:P.surface,borderBottom:`1px solid ${P.border}`,padding:"13px 22px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:36,height:36,borderRadius:8,background:P.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏆</div>
        <div>
          <div style={{fontWeight:800,fontSize:17}}>Tournament Scheduler</div>
          <div style={{color:P.muted,fontSize:12}}>
            {groups.length} group{groups.length!==1?"s":""} · {allTeams.length} teams · {totalEnabledMatches} matchups · {courts.length} courts · {totalSlots} slots
          </div>
        </div>
        <div style={{marginLeft:"auto"}}>
          <Btn onClick={buildSchedule} disabled={allTeams.length<2||courts.length===0||totalEnabledMatches===0}>⚡ Generate Schedule</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:P.surface,paddingLeft:12,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:"none",border:"none",cursor:"pointer",padding:"12px 17px",
            fontFamily:"inherit",fontSize:13,fontWeight:600,whiteSpace:"nowrap",
            color:tab===t.id?P.accent:P.muted,
            borderBottom:tab===t.id?`2px solid ${P.accent}`:"2px solid transparent",
            transition:"all .15s",position:"relative",
          }}>
            {t.label}
            {t.hi&&tab!==t.id&&<span style={{position:"absolute",top:8,right:8,width:7,height:7,borderRadius:"50%",background:P.green}}/>}
          </button>
        ))}
      </div>

      <div style={{padding:22,maxWidth:1000,margin:"0 auto"}}>

        {/* ══ GROUPS & TEAMS ══════════════════════════════════════════════ */}
        {tab==="groups"&&(
          <div>
            <SecHead title="Groups & Teams" sub="Add teams to each group, then select which matchups to schedule." />
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <Inp value={newGroupName} onChange={setNewGroupName} placeholder="New group name…"/>
              <Btn onClick={addGroup} style={{whiteSpace:"nowrap"}}>+ Add Group</Btn>
            </div>
            {groups.length===0&&<Card style={{textAlign:"center",color:P.muted,padding:40}}>No groups yet.</Card>}

            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {groups.map(group=>{
                const pairs=roundRobinPairs(group.teams);
                const enabledSet=getEnabledSet(group.id,group.teams);
                const enabledCount=pairs.filter(([a,b])=>enabledSet.has(matchKey(a,b))).length;
                const allOn=enabledCount===pairs.length;
                const allOff=enabledCount===0;

                return (
                  <Card key={group.id}>
                    {/* Group header */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <input value={group.name} onChange={e=>updateGroupName(group.id,e.target.value)}
                        style={{background:"transparent",border:"none",color:P.accent,fontWeight:700,fontSize:15,fontFamily:"inherit",outline:"none",flex:1}}/>
                      <span style={{color:P.muted,fontSize:12}}>{group.teams.length} teams</span>
                      <Btn variant="danger" small onClick={()=>removeGroup(group.id)}>Remove</Btn>
                    </div>

                    {/* Teams */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
                      {group.teams.map(tid=>{
                        const team=teams[tid]; if(!team) return null;
                        return (
                          <div key={tid} style={{background:team.color+"18",border:`1px solid ${team.color}44`,borderRadius:8,padding:"5px 9px",display:"flex",alignItems:"center",gap:7}}>
                            <input type="color" value={team.color} onChange={e=>updTeamColor(tid,e.target.value)}
                              style={{width:16,height:16,border:"none",borderRadius:3,cursor:"pointer",background:"none"}}/>
                            <input value={team.name} onChange={e=>updTeamName(tid,e.target.value)}
                              style={{background:"transparent",border:"none",color:team.color,fontWeight:600,fontSize:13,fontFamily:"inherit",outline:"none",width:85}}/>
                            <span onClick={()=>removeTeam(group.id,tid)} style={{cursor:"pointer",color:P.muted,fontSize:11}}>✕</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add team row */}
                    <div style={{display:"flex",gap:8,marginBottom: pairs.length>0?16:0}}>
                      <Inp value={newTeamName[group.id]||""} onChange={v=>setNewTeamName(n=>({...n,[group.id]:v}))}
                        placeholder="Team name…" style={{maxWidth:210}}/>
                      <Btn variant="secondary" small onClick={()=>addTeam(group.id)}>+ Add Team</Btn>
                    </div>

                    {/* ── MATCHUPS SECTION ── */}
                    {pairs.length>0&&(
                      <div style={{borderTop:`1px solid ${P.border}`,paddingTop:14}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{color:P.text,fontWeight:600,fontSize:13}}>Matchups</span>
                            <span style={{
                              background: allOff?P.red+"22":allOn?P.green+"22":P.accent+"22",
                              border:`1px solid ${allOff?P.red+"55":allOn?P.green+"55":P.accent+"55"}`,
                              color: allOff?P.red:allOn?P.green:P.accent,
                              borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700,
                            }}>
                              {enabledCount} / {pairs.length} selected
                            </span>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <Btn variant="ghost" small onClick={()=>selectAllMatchups(group.id,group.teams)}
                              disabled={allOn}>Select All</Btn>
                            <Btn variant="ghost" small onClick={()=>clearAllMatchups(group.id)}
                              disabled={allOff}>Clear All</Btn>
                          </div>
                        </div>

                        {group.teams.length<2&&(
                          <div style={{color:P.muted,fontSize:12,fontStyle:"italic"}}>
                            Add at least 2 teams to configure matchups.
                          </div>
                        )}

                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {pairs.map(([a,b])=>{
                            const key=matchKey(a,b);
                            const enabled=enabledSet.has(key);
                            const teamA=teams[a]; const teamB=teams[b];
                            if(!teamA||!teamB) return null;
                            return (
                              <MatchupChip
                                key={key}
                                teamA={teamA}
                                teamB={teamB}
                                enabled={enabled}
                                onToggle={()=>toggleMatchup(group.id,group.teams,key)}
                              />
                            );
                          })}
                        </div>

                        {allOff&&(
                          <div style={{marginTop:10,color:P.red,fontSize:12}}>
                            ⚠️ No matchups selected — this group won't appear in the schedule.
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COURTS & TIMES ══════════════════════════════════════════════ */}
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
                      <input value={court.name} onChange={e=>updCourt(court.id,"name",e.target.value)}
                        style={{background:"transparent",border:"none",color:P.text,fontWeight:700,fontSize:15,fontFamily:"inherit",outline:"none",flex:1}}/>
                      <input value={court.location} onChange={e=>updCourt(court.id,"location",e.target.value)}
                        placeholder="Location…"
                        style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:5,color:P.muted,padding:"5px 9px",fontFamily:"inherit",fontSize:12,outline:"none",width:140}}/>
                      <Btn variant="danger" small onClick={()=>removeCourt(court.id)}>Remove</Btn>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                      {/* Availability windows */}
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
                                    <input type="date" value={win.date||""} onChange={e=>updWindow(court.id,win.id,"date",e.target.value)}
                                      style={{background:"transparent",border:"none",color:P.blue,fontWeight:700,fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:130}}/>
                                    <span style={{color:P.border,fontSize:12}}>|</span>
                                    <TimeInp value={win.open} onChange={v=>updWindow(court.id,win.id,"open",v)} color={P.green}/>
                                    <span style={{color:P.muted,fontSize:13}}>→</span>
                                    <TimeInp value={win.close} onChange={v=>updWindow(court.id,win.id,"close",v)} color={P.red}/>
                                    {win.open&&win.close&&(()=>{const d=timeMins(win.close)-timeMins(win.open);const s=d>0?Math.floor(d/gameDuration):0;return <span style={{color:P.muted,fontSize:11}}>{s} slot{s!==1?"s":""}</span>;})()}
                                    <span onClick={()=>removeWindow(court.id,win.id)} style={{marginLeft:"auto",cursor:"pointer",color:P.muted,fontSize:12}}>✕</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {(court.windows||[]).length>0&&(()=>{
                          const tot=(court.windows||[]).reduce((s,w)=>{const d=timeMins(w.close||"00:00")-timeMins(w.open||"00:00");return s+(d>0?d:0);},0);
                          const sl=Math.floor(tot/gameDuration);
                          const dates=[...new Set((court.windows||[]).map(w=>w.date).filter(Boolean))];
                          return <div style={{marginTop:8,fontSize:11,color:P.muted}}>{dates.length} day{dates.length!==1?"s":""} · {tot} min · ~{sl} slot{sl!==1?"s":""}</div>;
                        })()}
                      </div>
                      {/* Primary groups */}
                      <div>
                        <Lbl>Primary Groups (preferred)</Lbl>
                        <div style={{fontSize:12,color:P.muted,marginBottom:10}}>These groups are scheduled here first.</div>
                        {groups.length===0&&<div style={{color:P.muted,fontSize:12,fontStyle:"italic"}}>No groups defined yet.</div>}
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {groups.map(group=>{
                            const on=primaryGroups.includes(group.id);
                            return (
                              <div key={group.id} onClick={()=>toggleCourtGroup(court.id,group.id)}
                                style={{cursor:"pointer",borderRadius:7,padding:"7px 11px",display:"flex",alignItems:"center",gap:9,transition:"all .15s",
                                  background:on?P.accent+"18":P.bg,border:`1px solid ${on?P.accent+"88":P.border}`}}>
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

        {/* ══ SETTINGS ════════════════════════════════════════════════════ */}
        {tab==="settings"&&(
          <div>
            <SecHead title="Schedule Settings" sub="Configure game duration."/>
            <Card style={{maxWidth:420}}>
              <div style={{marginBottom:20}}>
                <Lbl>Game Duration</Lbl>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <select value={gameDuration} onChange={e=>setGameDuration(Number(e.target.value))}
                    style={{background:P.bg,border:`1px solid ${P.border}`,borderRadius:6,color:P.text,padding:"7px 10px",fontFamily:"inherit",fontSize:13,outline:"none"}}>
                    {[15,20,25,30,35,40,45,50,60,75,90].map(m=><option key={m} value={m}>{m} minutes</option>)}
                  </select>
                  <span style={{color:P.muted,fontSize:12}}>per game slot</span>
                </div>
              </div>
              <div style={{background:P.bg,borderRadius:8,padding:14,border:`1px solid ${P.border}`}}>
                <Lbl>Summary</Lbl>
                {[
                  ["Selected matchups",totalEnabledMatches],
                  ["Courts",courts.length],
                  ["Available slots",totalSlots],
                  ["Capacity",totalSlots>=totalEnabledMatches?"✅ Enough":"⚠️ May not fit"],
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

        {/* ══ LINKED TEAMS ════════════════════════════════════════════════ */}
        {tab==="links"&&(
          <div>
            <SecHead title="Linked Teams" sub="Linked teams cannot be scheduled at the same time."/>
            <Card style={{marginBottom:16}}>
              <div style={{fontWeight:600,color:P.accent,marginBottom:8}}>Create a link</div>
              <div style={{fontSize:12,color:P.muted,marginBottom:11}}>Select 2+ teams that must not play simultaneously:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:13}}>
                {allTeams.map(team=>{
                  const sel=linkSelections.includes(team.id);
                  return <div key={team.id} onClick={()=>toggleLinkSel(team.id)}
                    style={{cursor:"pointer",borderRadius:20,padding:"5px 13px",fontSize:13,fontWeight:600,
                      background:sel?team.color+"33":P.bg,border:`2px solid ${sel?team.color:P.border}`,
                      color:sel?team.color:P.muted,transition:"all .15s"}}>{team.name}</div>;
                })}
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
                    {link.map((tid,j)=>{const team=teams[tid];if(!team) return null;return <span key={tid}><Tag label={team.name} color={team.color}/>{j<link.length-1&&<span style={{color:P.muted,margin:"0 4px",fontSize:12}}>+</span>}</span>;})}
                  </div>
                  <Btn variant="danger" small onClick={()=>removeLink(i)}>Remove</Btn>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ══ SCHEDULE ════════════════════════════════════════════════════ */}
        {tab==="schedule"&&(
          <div>
            <SecHead title="Generated Schedule"
              sub={schedule?`${schedule.length} games across ${scheduleDatesSorted.length} day(s)`:"Generate a schedule to see it here."}/>
            {scheduleWarnings.map((w,i)=>(
              <div key={i} style={{background:"#7d1d0022",border:`1px solid ${P.red}55`,borderRadius:8,padding:"10px 15px",color:P.red,marginBottom:10,fontSize:13}}>⚠️ {w}</div>
            ))}
            {!schedule&&(
              <Card style={{textAlign:"center",padding:60}}>
                <div style={{fontSize:44,marginBottom:14}}>📅</div>
                <div style={{color:P.muted,marginBottom:18}}>Configure groups, courts, and matchups, then generate.</div>
                <Btn onClick={buildSchedule} disabled={allTeams.length<2||courts.length===0}>⚡ Generate Schedule</Btn>
              </Card>
            )}
            {schedule&&schedule.length===0&&scheduleWarnings.length===0&&(
              <Card style={{textAlign:"center",padding:40,color:P.muted}}>No games placed. Add court windows with dates.</Card>
            )}
            {schedule&&schedule.length>0&&(()=>{
              return (
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
                          <div style={{background:P.blue+"22",border:`1px solid ${P.blue}44`,borderRadius:8,padding:"6px 14px",color:P.blue,fontWeight:800,fontSize:15}}>
                            📅 {fmtDate(date)}
                          </div>
                          <div style={{color:P.muted,fontSize:12}}>{daySlots.length} game{daySlots.length!==1?"s":""}</div>
                          <div style={{flex:1,height:1,background:P.border}}/>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {slotKeys.map(sk=>{
                            const skGames=daySlots.filter(s=>s.slotKey===sk);
                            const timeLbl=skGames[0]?.timeLabel||"";
                            const slotTime=skGames[0]?.absTimeMins??0;
                            return (
                              <div key={sk} style={{display:"flex",alignItems:"stretch"}}>
                                <div style={{width:86,minWidth:86,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:P.surfaceLight,border:`1px solid ${P.border}`,borderRight:"none",borderRadius:"8px 0 0 8px",padding:"8px 4px"}}>
                                  <div style={{color:P.accent,fontWeight:700,fontSize:12,textAlign:"center"}}>{timeLbl}</div>
                                  <div style={{color:P.muted,fontSize:10}}>{gameDuration}min</div>
                                </div>
                                <div style={{flex:1,display:"grid",gridTemplateColumns:`repeat(${courts.length},1fr)`,border:`1px solid ${P.border}`,borderRadius:"0 8px 8px 0",overflow:"hidden"}}>
                                  {courts.map((court,ci)=>{
                                    const game=skGames.find(s=>s.courtId===court.id);
                                    const home=game?teams[game.match.home]:null;
                                    const away=game?teams[game.match.away]:null;
                                    const grp=game?groups.find(g=>g.id===game.match.groupId):null;
                                    const courtOpen=(court.windows||[]).some(w=>w.date===date&&timeMins(w.open)<=slotTime&&slotTime+gameDuration<=timeMins(w.close));
                                    const closed=!courtOpen;
                                    return (
                                      <div key={court.id} style={{background:closed?"#0a1520":game?P.surface:P.bg,borderLeft:ci>0?`1px solid ${P.border}`:"none",padding:"8px 11px",minHeight:60,display:"flex",flexDirection:"column",justifyContent:"center",opacity:closed?0.45:1}}>
                                        <div style={{color:P.muted,fontSize:10,marginBottom:4,fontWeight:600}}>{court.name}{court.location?` · ${court.location}`:""}</div>
                                        {closed?<div style={{color:P.border,fontSize:11,fontStyle:"italic"}}>— closed —</div>
                                          :game&&home&&away?(
                                            <div>
                                              <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                                                <span style={{color:home.color,fontWeight:700,fontSize:13}}>{home.name}</span>
                                                <span style={{color:P.muted,fontSize:10}}>vs</span>
                                                <span style={{color:away.color,fontWeight:700,fontSize:13}}>{away.name}</span>
                                              </div>
                                              <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                                                {grp&&<span style={{fontSize:10,color:P.muted,background:P.bg,borderRadius:4,padding:"1px 5px",border:`1px solid ${P.border}`}}>{grp.name}</span>}
                                                {game.isPrimary&&<span style={{fontSize:10,color:P.accent,background:P.accent+"18",borderRadius:4,padding:"1px 5px",border:`1px solid ${P.accent}44`}}>★ primary</span>}
                                              </div>
                                            </div>
                                          ):<div style={{color:P.border,fontSize:11,fontStyle:"italic"}}>— open —</div>}
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
                  {/* Per-team */}
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
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

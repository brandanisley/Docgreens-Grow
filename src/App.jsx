import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const GREEN="#4ade80",DARK="#0a0a0a",CARD="#141414",BORDER="#2a2a2a",MUTED="#6b7280",WARN="#f59e0b",DANGER="#ef4444",WHITE="#f9fafb",BLUE="#60a5fa",PURPLE="#a78bfa";
const STAGES=["Veg","Week 1-3 (Stretch)","Week 4-6 (Bulk)","Week 7+ (Finish)"];
const TABLES=Array.from({length:9},(_,i)=>`Table ${i+1}`);
const VPD_R={"Veg":{min:0.8,max:0.95},"Week 1-3 (Stretch)":{min:0.95,max:1.15},"Week 4-6 (Bulk)":{min:0.95,max:1.15},"Week 7+ (Finish)":{min:1.0,max:1.2}};
const DB_T={"Veg":{min:10,max:20,label:"Light — keep moist"},"Week 1-3 (Stretch)":{min:20,max:35,label:"Moderate — generative push"},"Week 4-6 (Bulk)":{min:25,max:40,label:"Moderate-high — bulk steering"},"Week 7+ (Finish)":{min:30,max:45,label:"High — finish mode"}};
const EC_T={"Veg":{input:"1.2–1.8",runoff:"2.0–2.8"},"Week 1-3 (Stretch)":{input:"1.8–2.2",runoff:"3.5–5.0"},"Week 4-6 (Bulk)":{input:"1.6–2.0",runoff:"3.5–4.5"},"Week 7+ (Finish)":{input:"0.5–1.0",runoff:"1.5–2.5"}};
const RH_T={"Veg":{min:55,max:70},"Week 1-3 (Stretch)":{min:55,max:65},"Week 4-6 (Bulk)":{min:50,max:60},"Week 7+ (Finish)":{min:45,max:55}};
const CO2_T={min:1200,max:1500},TEMP_T={min:74,max:82};

const STRAIN_PROFILES=[
  {name:"Custom/Unknown",stretch:"Medium",ecSensitivity:"Medium",notes:""},
  {name:"OG Kush",stretch:"Medium",ecSensitivity:"Medium",notes:"Classic structure. Responds well to heavy defoliation."},
  {name:"Gelato",stretch:"Medium-High",ecSensitivity:"Medium",notes:"Can run tall. Watch for PM. Good EC tolerance."},
  {name:"Wedding Cake",stretch:"Medium",ecSensitivity:"High",notes:"Sensitive to high EC — keep runoff conservative."},
  {name:"Zkittlez",stretch:"Low",ecSensitivity:"Medium",notes:"Compact structure. Heavy feeder late flower."},
  {name:"Blue Dream",stretch:"High",ecSensitivity:"Low",notes:"Very stretchy — consider negative DIF weeks 1-3."},
  {name:"GSC",stretch:"Low-Medium",ecSensitivity:"Medium",notes:"Tight internodal spacing. Dense buds — watch airflow."},
  {name:"Runtz",stretch:"Medium",ecSensitivity:"Medium-High",notes:"Finicky. Watch for micronutrient deficiencies."},
  {name:"MAC",stretch:"Medium-High",ecSensitivity:"Medium",notes:"Long flower time. Push EC in bulk phase."},
];

const IPM_DATA=[
  {pest:"Spider Mites",type:"Pest",symptoms:"Fine webbing, stippled yellowing, bronze sheen",products:["Grandevo","Venerate XC","Suffoil-X","Floramite SC (veg only)"],notes:"Thrives hot/dry. Nearly impossible late flower."},
  {pest:"Fungus Gnats",type:"Pest",symptoms:"Small flies near medium, wilting, root damage",products:["Gnatrol (Bti)","Hypoaspis miles","Diatomaceous earth","Yellow sticky traps"],notes:"Larvae are the problem. Let medium dry between waterings."},
  {pest:"Aphids",type:"Pest",symptoms:"Clusters on new growth, sticky honeydew, curled leaves",products:["Azamax","M-Pede","Entrust SC"],notes:"Reproduce rapidly. Harvest interval required for Spinosad."},
  {pest:"Thrips",type:"Pest",symptoms:"Silver streaking, black fecal spots, distorted growth",products:["Entrust SC","Amblyseius cucumeris","Azamax","BotaniGard"],notes:"Pupate in soil — treat medium too."},
  {pest:"Botrytis",type:"Pathogen",symptoms:"Gray fuzzy mold in dense buds, brown water-soaked tissue",products:["Regalia","Cease","Oxidate 2.0","Actinovate"],notes:"PREVENTION ONLY in flower. Bag infected material before removing."},
  {pest:"Powdery Mildew",type:"Pathogen",symptoms:"White powdery coating on upper leaf surface",products:["Regalia","Oxidate 2.0","GreenCure","Lost Coast Plant Therapy"],notes:"Keep RH below 55% in flower."},
  {pest:"Pythium/Root Rot",type:"Pathogen",symptoms:"Brown slimy roots, wilting despite wet medium",products:["Actinovate","RootShield","Hydroguard","Oxidate drench"],notes:"Overwatering + warm rootzone = primary cause."},
  {pest:"Calcium Deficiency",type:"Deficiency",symptoms:"Brown spots, curled tips, new growth affected",products:["CalMag supplement","pH adjust 6.0–6.5"],notes:"Often pH lockout. Check runoff pH first."},
  {pest:"Iron Deficiency",type:"Deficiency",symptoms:"Interveinal chlorosis on NEW growth",products:["pH down if alkaline","Chelated iron"],notes:"Almost always pH >7.0. Fix pH first."},
  {pest:"Nitrogen Deficiency",type:"Deficiency",symptoms:"Yellowing on LOWER leaves moving upward",products:["Increase N in feed","Athena Grow"],notes:"Late flower lower leaf yellowing is normal senescence."},
];

const TABS=["Dashboard","VPD","Dryback","EC Log","Env Log","Trollmaster","Strains","Flip/Harvest","Grow Log","IPM","AI Diag"];

function calcVPD(f,rh){const c=(f-32)*5/9,svp=0.6108*Math.exp((17.27*c)/(c+237.3));return+(svp*(1-rh/100)).toFixed(2);}
function sColor(v,mn,mx){if(v<mn-(mx-mn)*.15)return BLUE;if(v<mn)return WARN;if(v<=mx)return GREEN;if(v<=mx+(mx-mn)*.15)return WARN;return DANGER;}
function weekOfFlower(d){if(!d)return null;const days=Math.floor((Date.now()-new Date(d))/(864e5));return days<0?null:Math.ceil((days+1)/7);}
function flowerStage(wk){if(!wk)return null;if(wk<=3)return"Week 1-3 (Stretch)";if(wk<=6)return"Week 4-6 (Bulk)";return"Week 7+ (Finish)";}
function daysToHarvest(d,total=63){if(!d)return null;return Math.max(0,total-Math.floor((Date.now()-new Date(d))/864e5));}

const Pill=({label,color})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}}>{label}</span>;
const Card=({children,style})=><div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:16,...style}}>{children}</div>;
const Lbl=({children})=><div style={{color:MUTED,fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{children}</div>;
const Inp=({value,onChange,type="number",placeholder,style})=><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:WHITE,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box",...style}}/>;
const Sel=({value,onChange,options})=><select value={value} onChange={e=>onChange(e.target.value)} style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:WHITE,fontSize:14,width:"100%",outline:"none"}}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>;
const Btn=({onClick,children,style,color=GREEN,disabled})=><button onClick={onClick} disabled={disabled} style={{background:disabled?"#333":color,color:disabled?MUTED:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:disabled?"not-allowed":"pointer",...style}}>{children}</button>;
const Row=({label,value})=><div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BORDER}`}}><span style={{color:MUTED,fontSize:13}}>{label}</span><span style={{fontWeight:600,fontSize:13}}>{value}</span></div>;

export default function App(){
  const [tab,setTab]=useState("Dashboard");
  const [stage,setStage]=useState("Week 1-3 (Stretch)");
  const [loading,setLoading]=useState(false);

  const [temp,setTemp]=useState(77),[rh,setRh]=useState(58);
  const vpd=calcVPD(Number(temp),Number(rh));
  const vpdC=sColor(vpd,VPD_R[stage].min,VPD_R[stage].max);
  const vpdLbl=vpdC===GREEN?"Optimal ✓":vpdC===WARN?(vpd<VPD_R[stage].min?"Low":"High"):vpdC===BLUE?"Too Low":"Stress Zone";

  const [satW,setSatW]=useState(""),[morningW,setMorningW]=useState(""),[dryWt,setDryWt]=useState("");
  const dryPct=satW&&morningW&&dryWt?Math.round(((satW-morningW)/(satW-dryWt))*100):null;
  const dbC=dryPct!==null?sColor(dryPct,DB_T[stage].min,DB_T[stage].max):null;
  const dbLbl=dbC===GREEN?"On Target ✓":dbC===BLUE?"Too Wet":dbC===WARN?(dryPct<DB_T[stage].min?"Slightly Wet":"Slightly Dry"):"Too Dry";

  const [ecLogs,setEcLogs]=useState([]);
  const [envLogs,setEnvLogs]=useState([]);
  const [growLogs,setGrowLogs]=useState([]);
  const [flipData,setFlipData]=useState({});
  const [harvestLogs,setHarvestLogs]=useState([]);
  const [tableStrains,setTableStrains]=useState({});

  const [ecTable,setEcTable]=useState("Table 1"),[ecIn,setEcIn]=useState(""),[ecRun,setEcRun]=useState(""),[ecNote,setEcNote]=useState("");
  const [eTemp,setETemp]=useState(""),[eRh,setERh]=useState(""),[eCo2,setECo2]=useState(""),[eDN,setEDN]=useState("Day"),[eNote,setENote]=useState("");
  const [logTable,setLogTable]=useState("Table 1"),[logType,setLogType]=useState("General"),[logNote,setLogNote]=useState("");
  const [editStrain,setEditStrain]=useState(null),[strainCustomName,setStrainCustomName]=useState(""),[strainProfile,setStrainProfile]=useState("Custom/Unknown"),[strainNotes,setStrainNotes]=useState("");
  const [flipTable,setFlipTable]=useState("Table 1"),[flipDate,setFlipDate]=useState(""),[flipTotalDays,setFlipTotalDays]=useState("63"),[flipStrain,setFlipStrain]=useState("");
  const [hTable,setHTable]=useState("Table 1"),[hWet,setHWet]=useState(""),[hDry,setHDry]=useState(""),[hSqft,setHSqft]=useState(""),[hNotes,setHNotes]=useState("");
  const [ipmFilter,setIpmFilter]=useState("All");
  const [diagText,setDiagText]=useState(""),[diagResult,setDiagResult]=useState(""),[diagLoading,setDiagLoading]=useState(false);
  const [tmImage,setTmImage]=useState(null),[tmPreview,setTmPreview]=useState(null),[tmParsed,setTmParsed]=useState(null),[tmLoading,setTmLoading]=useState(false),[tmConfirmed,setTmConfirmed]=useState(false),[tmEdits,setTmEdits]=useState({});
  const fileRef=useRef();

  useEffect(()=>{loadAll();},[]);

  const loadAll=async()=>{
    setLoading(true);
    const [ec,env,grow,flip,harvest,strains]=await Promise.all([
      supabase.from("ec_logs").select("*").order("created_at",{ascending:false}).limit(100),
      supabase.from("env_logs").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("grow_logs").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("flip_data").select("*").order("created_at",{ascending:false}),
      supabase.from("harvest_logs").select("*").order("created_at",{ascending:false}).limit(50),
      supabase.from("strain_assignments").select("*"),
    ]);
    if(ec.data)setEcLogs(ec.data);
    if(env.data)setEnvLogs(env.data);
    if(grow.data)setGrowLogs(grow.data);
    if(flip.data){const fd={};flip.data.forEach(r=>{fd[r.table_name]={flipDate:r.flip_date,totalDays:r.total_days,strain:r.strain};});setFlipData(fd);}
    if(harvest.data)setHarvestLogs(harvest.data);
    if(strains.data){const sd={};strains.data.forEach(r=>{sd[r.table_name]={name:r.strain_name,profile:r.profile,stretch:r.stretch,ecSensitivity:r.ec_sensitivity,notes:r.notes};});setTableStrains(sd);}
    setLoading(false);
  };

  const addEcLog=async()=>{
    if(!ecRun)return;
    const [lo,hi]=[parseFloat(EC_T[stage].runoff.split("–")[0]),parseFloat(EC_T[stage].runoff.split("–")[1])];
    const c=sColor(Number(ecRun),lo,hi);
    const statusLabel=c===GREEN?"On Target ✓":c===WARN?(Number(ecRun)<lo?"Slightly Low":"Slightly High"):c===BLUE?"Low":"Too High";
    const {data}=await supabase.from("ec_logs").insert({date:new Date().toLocaleDateString(),table_name:ecTable,stage,input_ec:ecIn||"—",runoff_ec:Number(ecRun),note:ecNote}).select().single();
    if(data)setEcLogs(p=>[{...data,status:{label:statusLabel,color:c}},...p]);
    setEcIn("");setEcRun("");setEcNote("");
  };

  const addEnvLog=async(d)=>{
    const data=d||{temp:eTemp,rh:eRh,co2:eCo2,dayNight:eDN,note:eNote};
    if(!data.temp&&!data.rh&&!data.co2)return;
    const {data:row}=await supabase.from("env_logs").insert({date:new Date().toLocaleDateString(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),stage,temp:data.temp?Number(data.temp):null,rh:data.rh?Number(data.rh):null,co2:data.co2?Number(data.co2):null,day_night:data.dayNight,note:data.note,source:data.source||null}).select().single();
    if(row)setEnvLogs(p=>[row,...p]);
    if(!d){setETemp("");setERh("");setECo2("");setENote("");}
  };

  const addGrowLog=async()=>{
    if(!logNote)return;
    const {data}=await supabase.from("grow_logs").insert({date:new Date().toLocaleDateString(),table_name:logTable,stage,type:logType,note:logNote}).select().single();
    if(data)setGrowLogs(p=>[data,...p]);
    setLogNote("");
  };

  const saveStrain=async()=>{
    if(!editStrain)return;
    const profile=STRAIN_PROFILES.find(s=>s.name===strainProfile)||STRAIN_PROFILES[0];
    await supabase.from("strain_assignments").upsert({table_name:editStrain,strain_name:strainCustomName||strainProfile,profile:strainProfile,stretch:profile.stretch,ec_sensitivity:profile.ecSensitivity,notes:strainNotes||profile.notes},{onConflict:"table_name"});
    setTableStrains(p=>({...p,[editStrain]:{name:strainCustomName||strainProfile,profile:strainProfile,stretch:profile.stretch,ecSensitivity:profile.ecSensitivity,notes:strainNotes||profile.notes}}));
    setEditStrain(null);
  };

  const saveFlip=async()=>{
    if(!flipTable||!flipDate)return;
    await supabase.from("flip_data").upsert({table_name:flipTable,flip_date:flipDate,total_days:Number(flipTotalDays)||63,strain:flipStrain},{onConflict:"table_name"});
    setFlipData(p=>({...p,[flipTable]:{flipDate,totalDays:Number(flipTotalDays)||63,strain:flipStrain}}));
    setFlipDate("");setFlipStrain("");
  };

  const deleteFlip=async(tbl)=>{
    await supabase.from("flip_data").delete().eq("table_name",tbl);
    setFlipData(p=>{const n={...p};delete n[tbl];return n;});
  };

  const addHarvest=async()=>{
    if(!hTable||(!hWet&&!hDry))return;
    const sqft=Number(hSqft)||32;
    const yps=hDry?(Number(hDry)/sqft).toFixed(2):null;
    const {data}=await supabase.from("harvest_logs").insert({date:new Date().toLocaleDateString(),table_name:hTable,strain:tableStrains[hTable]?.name||"Unknown",wet_weight:hWet?Number(hWet):null,dry_weight:hDry?Number(hDry):null,sqft,yield_per_sqft:yps?Number(yps):null,notes:hNotes}).select().single();
    if(data)setHarvestLogs(p=>[data,...p]);
    setHWet("");setHDry("");setHNotes("");
  };

  const handleTmFile=(e)=>{
    const f=e.target.files[0];if(!f)return;
    setTmParsed(null);setTmConfirmed(false);setTmEdits({});
    const r=new FileReader();
    r.onload=ev=>{setTmPreview(ev.target.result);setTmImage(ev.target.result.split(",")[1]);};
    r.readAsDataURL(f);
  };

  const parseTrolmaster=async()=>{
    if(!tmImage)return;setTmLoading(true);setTmParsed(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,system:`Extract environmental data from Trolmaster controller photos. Return ONLY valid JSON. Keys: temp_f, rh_percent, co2_ppm, vpd. Omit unreadable values.`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:tmImage}},{type:"text",text:"Extract all visible environmental readings. Return only JSON."}]}]})});
      const d=await res.json();
      const raw=d.content?.[0]?.text||"{}";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setTmParsed(parsed);setTmEdits(Object.fromEntries(Object.entries(parsed).map(([k,v])=>[k,String(v)])));
    }catch{setTmParsed({error:"Could not parse. Check photo quality."});}
    setTmLoading(false);
  };

  const confirmTmLog=()=>{
    addEnvLog({temp:tmEdits.temp_f||"",rh:tmEdits.rh_percent||"",co2:tmEdits.co2_ppm||"",dayNight:eDN,note:"Auto-logged from Trolmaster",source:"Trolmaster"});
    setTmConfirmed(true);
  };

  const runDiagnosis=async()=>{
    if(!diagText)return;setDiagLoading(true);setDiagResult("");
    const recentEnv=envLogs.slice(0,3).map(l=>`${l.date}: ${l.temp}°F ${l.rh}% ${l.co2||"?"}ppm`).join("; ");
    const recentEc=ecLogs.slice(0,3).map(l=>`${l.table_name} runoff ${l.runoff_ec}`).join(", ");
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"Expert cannabis cultivation advisor. Given symptoms and grow data: 1) Most likely cause 2) Secondary possibilities 3) Immediate action steps. Be direct and concise.",messages:[{role:"user",content:`Stage:${stage} VPD:${vpd} Env:${recentEnv||"none"} EC:${recentEc||"none"}\n\nSymptoms: ${diagText}`}]})});
      const d=await res.json();setDiagResult(d.content?.[0]?.text||"No response.");
    }catch{setDiagResult("Connection error. Try again.");}
    setDiagLoading(false);
  };

  const tmFieldLabels={temp_f:"Temperature (°F)",rh_percent:"Humidity (%)",co2_ppm:"CO2 (PPM)",vpd:"VPD (kPa)"};
  const activeFlips=Object.entries(flipData).filter(([,d])=>d.flipDate);
  const latestEnv=envLogs[0];
  const latestEc=ecLogs[0];

  return(
    <div style={{background:DARK,minHeight:"100vh",color:WHITE,fontFamily:"system-ui,sans-serif",paddingBottom:60}}>
      <div style={{background:CARD,borderBottom:`1px solid ${BORDER}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:10}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:GREEN,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:15}}>DOC GREEN'S</div>
          <div style={{color:MUTED,fontSize:10,letterSpacing:1.5,textTransform:"uppercase"}}>Cultivation Command Center</div>
        </div>
        {loading&&<div style={{color:MUTED,fontSize:11}}>syncing...</div>}
        <button onClick={loadAll} style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:8,color:MUTED,fontSize:11,padding:"4px 8px",cursor:"pointer"}}>↻</button>
      </div>

      <div style={{padding:"10px 16px 0"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {STAGES.map(s=><button key={s} onClick={()=>setStage(s)} style={{background:stage===s?GREEN:"#1a1a1a",color:stage===s?"#000":WHITE,border:`1px solid ${stage===s?GREEN:BORDER}`,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{s}</button>)}
        </div>
      </div>

      <div style={{padding:"8px 16px 0",display:"flex",gap:0,overflowX:"auto",borderBottom:`1px solid ${BORDER}`}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:tab===t?`2px solid ${GREEN}`:"2px solid transparent",color:tab===t?GREEN:MUTED,padding:"6px 8px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>)}
      </div>

      <div style={{padding:16}}>

        {tab==="Dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:MUTED,fontSize:12,fontWeight:600}}>ENVIRONMENT</span>
                <Pill label={vpdLbl} color={vpdC}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                {[["VPD",vpd,"kPa",vpdC],["TEMP",temp,"°F",sColor(Number(temp),TEMP_T.min,TEMP_T.max)],["RH",rh,"%",sColor(Number(rh),RH_T[stage].min,RH_T[stage].max)]].map(([l,v,u,c])=>(
                  <div key={l} style={{flex:1,background:"#1a1a1a",borderRadius:8,padding:"8px",textAlign:"center"}}>
                    <div style={{color:MUTED,fontSize:10}}>{l}</div>
                    <div style={{color:c,fontWeight:800,fontSize:20}}>{v}</div>
                    <div style={{color:MUTED,fontSize:10}}>{u}</div>
                  </div>
                ))}
                {latestEnv?.co2&&<div style={{flex:1,background:"#1a1a1a",borderRadius:8,padding:"8px",textAlign:"center"}}>
                  <div style={{color:MUTED,fontSize:10}}>CO2</div>
                  <div style={{color:sColor(Number(latestEnv.co2),CO2_T.min,CO2_T.max),fontWeight:800,fontSize:16}}>{latestEnv.co2}</div>
                  <div style={{color:MUTED,fontSize:10}}>ppm</div>
                </div>}
              </div>
            </Card>

            {activeFlips.length>0&&<Card>
              <div style={{color:MUTED,fontSize:12,fontWeight:600,marginBottom:8}}>TABLES IN FLOWER</div>
              {activeFlips.map(([tbl,d])=>{
                const wk=weekOfFlower(d.flipDate),dth=daysToHarvest(d.flipDate,d.totalDays),pct=wk?Math.min(100,Math.round((wk/Math.ceil(d.totalDays/7))*100)):0;
                return(<div key={tbl} style={{borderBottom:`1px solid ${BORDER}`,padding:"8px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><span style={{fontWeight:700,fontSize:13}}>{tbl}</span>{d.strain&&<span style={{color:MUTED,fontSize:11,marginLeft:8}}>{d.strain}</span>}</div>
                    <Pill label={`Wk ${wk}`} color={wk>6?PURPLE:wk>3?WARN:GREEN}/>
                  </div>
                  <div style={{background:"#1a1a1a",borderRadius:4,height:5,margin:"6px 0"}}>
                    <div style={{background:wk>6?PURPLE:wk>3?WARN:GREEN,borderRadius:4,height:5,width:`${pct}%`}}/>
                  </div>
                  <span style={{color:dth<=7?DANGER:dth<=14?WARN:MUTED,fontSize:11,fontWeight:dth<=14?700:400}}>{dth<=0?"🌿 Harvest Now":`${dth}d to harvest`}</span>
                </div>);
              })}
            </Card>}

            {latestEc&&<Card>
              <div style={{color:MUTED,fontSize:12,fontWeight:600,marginBottom:6}}>LAST EC LOG</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><span style={{fontWeight:700}}>{latestEc.table_name}</span><span style={{color:MUTED,fontSize:12,marginLeft:8}}>{latestEc.date}</span></div>
                <Pill label={`Runoff ${latestEc.runoff_ec}`} color={GREEN}/>
              </div>
            </Card>}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["📊 VPD","VPD"],["💧 Dryback","Dryback"],["🌿 Strains","Strains"],["📅 Flip/Harvest","Flip/Harvest"],["📋 EC Log","EC Log"],["🤖 AI Diag","AI Diag"]].map(([l,t])=>(
                <button key={t} onClick={()=>setTab(t)} style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 8px",color:WHITE,fontWeight:600,fontSize:13,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {tab==="VPD"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card><Lbl>Temperature (°F)</Lbl><Inp value={temp} onChange={setTemp}/><div style={{marginTop:10}}/><Lbl>Humidity (%)</Lbl><Inp value={rh} onChange={setRh}/></Card>
            <Card style={{textAlign:"center"}}>
              <div style={{color:MUTED,fontSize:12,marginBottom:4}}>VPD</div>
              <div style={{fontSize:56,fontWeight:800,color:vpdC,lineHeight:1}}>{vpd}</div>
              <div style={{color:MUTED,fontSize:13,marginBottom:8}}>kPa</div>
              <Pill label={vpdLbl} color={vpdC}/>
              <div style={{color:MUTED,fontSize:12,marginTop:8}}>Target {stage}: {VPD_R[stage].min}–{VPD_R[stage].max} kPa</div>
            </Card>
          </div>
        )}

        {tab==="Dryback"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <Lbl>Dry Weight (lbs)</Lbl><Inp value={dryWt} onChange={setDryWt} placeholder="4.0"/>
              <div style={{marginTop:10}}/><Lbl>Saturated Weight (lbs)</Lbl><Inp value={satW} onChange={setSatW} placeholder="8.0"/>
              <div style={{marginTop:10}}/><Lbl>Morning Weight (lbs)</Lbl><Inp value={morningW} onChange={setMorningW} placeholder="7.2"/>
            </Card>
            {dryPct!==null?<Card style={{textAlign:"center"}}>
              <div style={{color:MUTED,fontSize:12,marginBottom:4}}>OVERNIGHT DRYBACK</div>
              <div style={{fontSize:56,fontWeight:800,color:dbC,lineHeight:1}}>{dryPct}%</div>
              <div style={{marginTop:8}}><Pill label={dbLbl} color={dbC}/></div>
              <div style={{color:MUTED,fontSize:12,marginTop:8}}>Target {stage}: {DB_T[stage].min}–{DB_T[stage].max}%</div>
            </Card>:<Card style={{textAlign:"center",color:MUTED,padding:24}}>Enter all three weights</Card>}
          </div>
        )}

        {tab==="EC Log"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <Lbl>Table</Lbl><Sel value={ecTable} onChange={setEcTable} options={TABLES}/>
              <div style={{marginTop:10}}/><Lbl>Input EC</Lbl><Inp value={ecIn} onChange={setEcIn} placeholder="2.0"/>
              <div style={{marginTop:10}}/><Lbl>Runoff EC *</Lbl><Inp value={ecRun} onChange={setEcRun} placeholder="3.5"/>
              <div style={{marginTop:10}}/><Lbl>Notes</Lbl><Inp value={ecNote} onChange={setEcNote} type="text" placeholder="Optional"/>
              <div style={{marginTop:12}}/><Btn onClick={addEcLog} style={{width:"100%"}}>Log EC</Btn>
              <div style={{color:MUTED,fontSize:11,marginTop:6}}>Target runoff {stage}: {EC_T[stage].runoff}</div>
            </Card>
            {ecLogs.map(log=>(
              <Card key={log.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontWeight:700}}>{log.table_name}</span>
                  <span style={{color:MUTED,fontSize:11}}>{log.date}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}><div style={{color:MUTED,fontSize:10}}>INPUT</div><div style={{fontWeight:600}}>{log.input_ec}</div></div>
                  <div style={{flex:1}}><div style={{color:MUTED,fontSize:10}}>RUNOFF</div><div style={{fontWeight:600}}>{log.runoff_ec}</div></div>
                </div>
                {log.note&&<div style={{color:MUTED,fontSize:12,marginTop:4}}>{log.note}</div>}
              </Card>
            ))}
          </div>
        )}

        {tab==="Env Log"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}><Lbl>Temp (°F)</Lbl><Inp value={eTemp} onChange={setETemp} placeholder="77"/></div>
                <div style={{flex:1}}><Lbl>RH (%)</Lbl><Inp value={eRh} onChange={setERh} placeholder="58"/></div>
              </div>
              <div style={{marginTop:10}}/><Lbl>CO2 (PPM)</Lbl><Inp value={eCo2} onChange={setECo2} placeholder="1350"/>
              <div style={{marginTop:10}}/><Lbl>Period</Lbl>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {["Day","Night","Lights Out"].map(p=><button key={p} onClick={()=>setEDN(p)} style={{background:eDN===p?GREEN:"#1a1a1a",color:eDN===p?"#000":WHITE,border:`1px solid ${eDN===p?GREEN:BORDER}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p}</button>)}
              </div>
              <Lbl>Notes</Lbl><Inp value={eNote} onChange={setENote} type="text" placeholder="Optional"/>
              <div style={{marginTop:12}}/><Btn onClick={()=>addEnvLog()} style={{width:"100%"}}>Log Environment</Btn>
            </Card>
            <Card><Lbl>Targets — {stage}</Lbl>
              <Row label="Temp" value={`${TEMP_T.min}–${TEMP_T.max}°F`}/>
              <Row label="Humidity" value={`${RH_T[stage].min}–${RH_T[stage].max}%`}/>
              <Row label="CO2" value={`${CO2_T.min}–${CO2_T.max} ppm`}/>
            </Card>
            {envLogs.slice(0,15).map(log=>(
              <Card key={log.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:MUTED}}>{log.date} {log.time} · {log.day_night}</span>
                  {log.source&&<Pill label={log.source} color={BLUE}/>}
                </div>
                <div style={{display:"flex",gap:12}}>
                  {log.temp&&<span style={{fontSize:13,color:sColor(Number(log.temp),TEMP_T.min,TEMP_T.max),fontWeight:700}}>{log.temp}°F</span>}
                  {log.rh&&<span style={{fontSize:13,color:sColor(Number(log.rh),RH_T[stage].min,RH_T[stage].max),fontWeight:700}}>{log.rh}%</span>}
                  {log.co2&&<span style={{fontSize:13,color:sColor(Number(log.co2),CO2_T.min,CO2_T.max),fontWeight:700}}>{log.co2}ppm</span>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="Trollmaster"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:6}}>SCREEN PARSER</div>
              <div style={{color:MUTED,fontSize:12,marginBottom:12}}>Photo your HydroX screen. AI reads values and logs automatically.</div>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleTmFile} style={{display:"none"}}/>
              <Btn onClick={()=>fileRef.current.click()} style={{width:"100%",marginBottom:8}} color={BLUE}>📷 Select Photo</Btn>
            </Card>
            {tmPreview&&<Card>
              <img src={tmPreview} alt="Trolmaster" style={{width:"100%",borderRadius:8,marginBottom:10}}/>
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                {["Day","Night","Lights Out"].map(p=><button key={p} onClick={()=>setEDN(p)} style={{background:eDN===p?GREEN:"#1a1a1a",color:eDN===p?"#000":WHITE,border:`1px solid ${eDN===p?GREEN:BORDER}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p}</button>)}
              </div>
              <Btn onClick={parseTrolmaster} disabled={tmLoading} style={{width:"100%"}}>{tmLoading?"Reading...":"Parse Screen →"}</Btn>
            </Card>}
            {tmParsed&&!tmParsed.error&&<Card>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:8}}>VERIFY & CONFIRM</div>
              {Object.entries(tmFieldLabels).filter(([k])=>tmEdits[k]!==undefined).map(([k,label])=>(
                <div key={k} style={{marginBottom:10}}><Lbl>{label}</Lbl><Inp value={tmEdits[k]||""} onChange={v=>setTmEdits(p=>({...p,[k]:v}))}/></div>
              ))}
              {!tmConfirmed?<Btn onClick={confirmTmLog} style={{width:"100%"}}>✓ Confirm & Log</Btn>:
                <div style={{background:GREEN+"22",border:`1px solid ${GREEN}44`,borderRadius:8,padding:10,color:GREEN,fontWeight:600,textAlign:"center"}}>✓ Logged to Env Log</div>}
            </Card>}
            {tmParsed?.error&&<Card style={{borderColor:DANGER+"44"}}><div style={{color:DANGER}}>{tmParsed.error}</div></Card>}
          </div>
        )}

        {tab==="Strains"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:8}}>TABLE STRAIN ASSIGNMENTS</div>
              {TABLES.map(tbl=>{
                const s=tableStrains[tbl];
                return(<div key={tbl} style={{borderBottom:`1px solid ${BORDER}`,padding:"10px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:13}}>{tbl}</span>
                      {s&&<div style={{color:GREEN,fontSize:12,marginTop:2}}>{s.name}</div>}
                      {s&&<div style={{color:MUTED,fontSize:11}}>Stretch: {s.stretch} · EC: {s.ecSensitivity}</div>}
                      {!s&&<div style={{color:MUTED,fontSize:12}}>Unassigned</div>}
                    </div>
                    <Btn onClick={()=>{setEditStrain(tbl);setStrainCustomName(s?.name||"");setStrainProfile(s?.profile||"Custom/Unknown");setStrainNotes(s?.notes||"");}} color={s?BLUE:GREEN} style={{padding:"4px 12px",fontSize:12}}>{s?"Edit":"Assign"}</Btn>
                  </div>
                  {s?.notes&&<div style={{background:"#1a1a1a",borderRadius:8,padding:"6px 10px",fontSize:11,color:MUTED,marginTop:6}}>{s.notes}</div>}
                </div>);
              })}
            </Card>
            {editStrain&&<Card style={{border:`1px solid ${GREEN}44`}}>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:10}}>ASSIGN — {editStrain}</div>
              <Lbl>Strain Profile</Lbl>
              <Sel value={strainProfile} onChange={v=>{setStrainProfile(v);const p=STRAIN_PROFILES.find(s=>s.name===v);if(p&&v!=="Custom/Unknown")setStrainNotes(p.notes);}} options={STRAIN_PROFILES.map(s=>s.name)}/>
              <div style={{marginTop:10}}/><Lbl>Custom Name</Lbl><Inp value={strainCustomName} onChange={setStrainCustomName} type="text" placeholder="e.g. Blue Dream #3"/>
              <div style={{marginTop:10}}/><Lbl>Notes</Lbl>
              <textarea value={strainNotes} onChange={e=>setStrainNotes(e.target.value)} style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:WHITE,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box",minHeight:60,resize:"vertical"}}/>
              <div style={{marginTop:10,display:"flex",gap:8}}>
                <Btn onClick={saveStrain} style={{flex:1}}>Save</Btn>
                <Btn onClick={()=>setEditStrain(null)} color={MUTED} style={{flex:1}}>Cancel</Btn>
              </div>
            </Card>}
          </div>
        )}

        {tab==="Flip/Harvest"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:8}}>SET FLIP DATE</div>
              <Lbl>Table</Lbl><Sel value={flipTable} onChange={setFlipTable} options={TABLES}/>
              <div style={{marginTop:10}}/><Lbl>Flip Date (MM/DD/YYYY)</Lbl><Inp value={flipDate} onChange={setFlipDate} type="text" placeholder="05/20/2026"/>
              <div style={{marginTop:10}}/><Lbl>Total Flower Days</Lbl><Inp value={flipTotalDays} onChange={setFlipTotalDays} placeholder="63"/>
              <div style={{marginTop:10}}/><Lbl>Strain</Lbl><Inp value={flipStrain} onChange={setFlipStrain} type="text" placeholder="Optional"/>
              <div style={{marginTop:12}}/><Btn onClick={saveFlip} style={{width:"100%"}}>Save Flip Date</Btn>
            </Card>

            {Object.keys(flipData).length>0&&<Card>
              <Lbl>Active Tables</Lbl>
              {Object.entries(flipData).map(([tbl,d])=>{
                const wk=weekOfFlower(d.flipDate),dth=daysToHarvest(d.flipDate,d.totalDays),pct=wk?Math.min(100,Math.round((wk/Math.ceil(d.totalDays/7))*100)):0;
                return(<div key={tbl} style={{borderBottom:`1px solid ${BORDER}`,padding:"10px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div><span style={{fontWeight:700}}>{tbl}</span>{d.strain&&<span style={{color:MUTED,fontSize:12,marginLeft:8}}>{d.strain}</span>}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <Pill label={`Wk ${wk}`} color={wk>6?PURPLE:wk>3?WARN:GREEN}/>
                      <button onClick={()=>deleteFlip(tbl)} style={{background:"none",border:"none",color:DANGER,fontSize:18,cursor:"pointer"}}>×</button>
                    </div>
                  </div>
                  <div style={{background:"#1a1a1a",borderRadius:4,height:5,marginBottom:4}}>
                    <div style={{background:wk>6?PURPLE:wk>3?WARN:GREEN,borderRadius:4,height:5,width:`${pct}%`}}/>
                  </div>
                  <span style={{color:dth<=7?DANGER:dth<=14?WARN:MUTED,fontSize:11,fontWeight:dth<=14?700:400}}>{dth<=0?"🌿 Harvest Now":`${dth}d to harvest`}</span>
                </div>);
              })}
            </Card>}

            <Card>
              <div style={{color:PURPLE,fontSize:12,fontWeight:600,marginBottom:8}}>LOG HARVEST</div>
              <Lbl>Table</Lbl><Sel value={hTable} onChange={setHTable} options={TABLES}/>
              <div style={{marginTop:10}}/>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}><Lbl>Wet (lbs)</Lbl><Inp value={hWet} onChange={setHWet} placeholder="0"/></div>
                <div style={{flex:1}}><Lbl>Dry (lbs)</Lbl><Inp value={hDry} onChange={setHDry} placeholder="0"/></div>
              </div>
              <div style={{marginTop:10}}/><Lbl>Table Sq Ft</Lbl><Inp value={hSqft} onChange={setHSqft} placeholder="32"/>
              <div style={{marginTop:10}}/><Lbl>Notes</Lbl><Inp value={hNotes} onChange={setHNotes} type="text" placeholder="Optional"/>
              <div style={{marginTop:12}}/><Btn onClick={addHarvest} color={PURPLE} style={{width:"100%"}}>Log Harvest</Btn>
            </Card>

            {harvestLogs.length>0&&<Card>
              <Lbl>Harvest History</Lbl>
              {harvestLogs.map(h=>(
                <div key={h.id} style={{borderBottom:`1px solid ${BORDER}`,padding:"10px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontWeight:700}}>{h.table_name}</span>
                    <span style={{color:MUTED,fontSize:11}}>{h.date}</span>
                  </div>
                  {h.strain&&<div style={{color:MUTED,fontSize:12,marginBottom:4}}>{h.strain}</div>}
                  <div style={{display:"flex",gap:12}}>
                    {h.wet_weight&&<div><div style={{color:MUTED,fontSize:10}}>WET</div><div style={{fontWeight:700,color:BLUE}}>{h.wet_weight} lbs</div></div>}
                    {h.dry_weight&&<div><div style={{color:MUTED,fontSize:10}}>DRY</div><div style={{fontWeight:700,color:GREEN}}>{h.dry_weight} lbs</div></div>}
                    {h.yield_per_sqft&&<div><div style={{color:MUTED,fontSize:10}}>LBS/SQFT</div><div style={{fontWeight:700,color:PURPLE}}>{h.yield_per_sqft}</div></div>}
                  </div>
                  {h.notes&&<div style={{color:MUTED,fontSize:11,marginTop:4}}>{h.notes}</div>}
                </div>
              ))}
            </Card>}
          </div>
        )}

        {tab==="Grow Log"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <Lbl>Table</Lbl><Sel value={logTable} onChange={setLogTable} options={["All Tables",...TABLES]}/>
              <div style={{marginTop:10}}/><Lbl>Type</Lbl>
              <Sel value={logType} onChange={setLogType} options={["General","Defoliation","Training/LST","Irrigation Change","Pest/Disease","Nutrient","Environmental","Flip Date","Harvest"]}/>
              <div style={{marginTop:10}}/><Lbl>Notes *</Lbl>
              <textarea value={logNote} onChange={e=>setLogNote(e.target.value)} placeholder="Describe what you observed or did..." style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:WHITE,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box",minHeight:80,resize:"vertical"}}/>
              <div style={{marginTop:10}}/><Btn onClick={addGrowLog} style={{width:"100%"}}>Add Entry</Btn>
            </Card>
            {growLogs.map(log=>(
              <Card key={log.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:13}}>{log.table_name}</span>
                    <span style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:20,padding:"1px 8px",fontSize:11,color:MUTED}}>{log.type}</span>
                  </div>
                  <span style={{color:MUTED,fontSize:11}}>{log.date}</span>
                </div>
                <div style={{fontSize:13}}>{log.note}</div>
              </Card>
            ))}
          </div>
        )}

        {tab==="IPM"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["All","Pest","Pathogen","Deficiency"].map(f=><button key={f} onClick={()=>setIpmFilter(f)} style={{background:ipmFilter===f?GREEN:"#1a1a1a",color:ipmFilter===f?"#000":WHITE,border:`1px solid ${ipmFilter===f?GREEN:BORDER}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{f}</button>)}
            </div>
            {IPM_DATA.filter(d=>ipmFilter==="All"||d.type===ipmFilter).map(d=>(
              <Card key={d.pest}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontWeight:700,fontSize:14}}>{d.pest}</span>
                  <Pill label={d.type} color={d.type==="Pest"?WARN:d.type==="Pathogen"?DANGER:BLUE}/>
                </div>
                <div style={{marginBottom:6}}><div style={{color:MUTED,fontSize:10,fontWeight:600}}>SYMPTOMS</div><div style={{fontSize:12}}>{d.symptoms}</div></div>
                <div style={{marginBottom:6}}><div style={{color:MUTED,fontSize:10,fontWeight:600}}>PRODUCTS</div>{d.products.map(p=><div key={p} style={{fontSize:12,color:GREEN}}>• {p}</div>)}</div>
                <div style={{background:"#1a1a1a",borderRadius:8,padding:"8px 10px",fontSize:11,color:MUTED}}>{d.notes}</div>
              </Card>
            ))}
          </div>
        )}

        {tab==="AI Diag"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:6}}>AI PLANT DIAGNOSIS</div>
              <div style={{color:MUTED,fontSize:12,marginBottom:10}}>Describe symptoms. AI cross-references: {stage} · {temp}°F · {rh}% · VPD {vpd}</div>
              <Lbl>Symptoms</Lbl>
              <textarea value={diagText} onChange={e=>setDiagText(e.target.value)} placeholder="e.g. Table 3 — yellowing lower leaves, brown spots on tips..." style={{background:"#1a1a1a",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:WHITE,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box",minHeight:100,resize:"vertical"}}/>
              <div style={{marginTop:10}}/>
              <Btn onClick={runDiagnosis} disabled={diagLoading||!diagText} style={{width:"100%"}}>{diagLoading?"Analyzing...":"Run Diagnosis →"}</Btn>
            </Card>
            {diagResult&&<Card><div style={{color:GREEN,fontSize:12,fontWeight:600,marginBottom:8}}>DIAGNOSIS</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{diagResult}</div></Card>}
            <Card style={{background:"#111"}}><div style={{color:MUTED,fontSize:11}}>⚠️ AI diagnosis is decision-support only. Always verify in person.</div></Card>
          </div>
        )}

      </div>
    </div>
  );
}

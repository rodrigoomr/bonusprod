import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import * as db from "./storage.js";
import * as XLSX from "xlsx";
import "./styles.css";

// ═══════════════════════════════════════════════════════════════
// BonusProd — Meta em pontos + Produção real = Acabamento
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = "v10.0";

const genId = () => Math.random().toString(36).substr(2, 9);
const getMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// CORRIGIDO: usa data local (não UTC) para evitar D+1 em fusos negativos como BRT
const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const dateToStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const formatCurrency = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
const formatDate = (d) => { const p = d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const monthLabel = (mk) => { const [y, m] = mk.split("-"); const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return `${months[parseInt(m) - 1]}/${y}`; };
const getUserSectorIds = (u) => { if (u.sectorIds && Array.isArray(u.sectorIds)) return u.sectorIds; if (u.sectorId) return [u.sectorId]; return []; };
// Cor por faixa de % da meta: <50 vermelho, 50-99 amarelo, >=100 verde
const pctBadge = (pct) => pct >= 100 ? "green" : pct >= 50 ? "yellow" : "red";
const pctColor = (pct) => pct >= 100 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)";
// Conta dias úteis (seg-sex) do mês atual
const getWorkingDaysInMonth = (year, month) => {
  let count = 0;
  const last = new Date(year, month, 0).getDate();
  for(let d=1; d<=last; d++){
    const dow = new Date(year, month-1, d).getDay();
    if(dow !== 0 && dow !== 6) count++;
  }
  return count;
};
const getCurrentMonthWorkingDays = () => { const d=new Date(); return getWorkingDaysInMonth(d.getFullYear(), d.getMonth()+1); };

const Icons = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  production: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3"/></svg>,
  ranking: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6-7 6 7"/><path d="M6 15l6 7 6-7"/></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>,
  sectors: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="6" height="14" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="10" width="6" height="11" rx="1"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  history: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  logs: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  fire: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c0 4-4 6-4 10a4 4 0 108 0c0-4-4-6-4-10z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  refresh: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
};

// ── Stats: meta é em PONTOS por colaborador ──
function computeEmployeeStats(users, sectors, production, config) {
  const mk = getMonthKey(); const today = getToday();
  const finalId = config.finalSectorId || 's1';
  return users.filter(u => u.role === "employee").map(u => {
    const sids = getUserSectorIds(u);
    const uSectors = sectors.filter(s => sids.includes(s.id));
    const mp = production.filter(p => p.userId === u.id && p.date.startsWith(mk));
    const tp = production.filter(p => p.userId === u.id && p.date === today);
    // Pontos: soma de (qty * pontos do setor) para cada lançamento
    let points = 0; let todayPoints = 0;
    mp.forEach(p => { const sec = sectors.find(s => s.id === p.sectorId); points += p.quantity * (sec?.pointsPerUnit || 0); });
    tp.forEach(p => { const sec = sectors.find(s => s.id === p.sectorId); todayPoints += p.quantity * (sec?.pointsPerUnit || 0); });
    // Produção real (só Acabamento / setor final)
    const realProdMonth = mp.filter(p => p.sectorId === finalId).reduce((s,p) => s+p.quantity, 0);
    const realProdToday = tp.filter(p => p.sectorId === finalId).reduce((s,p) => s+p.quantity, 0);
    // Qtd total lançada (todos os setores, para detalhamento)
    const totalQty = mp.reduce((s, p) => s + p.quantity, 0);
    const todayQty = tp.reduce((s, p) => s + p.quantity, 0);
    // Extintores "trabalhados" para este colaborador:
    // - se trabalha no setor final, conta só a produção do setor final
    // - se não trabalha no final, conta a soma das unidades nos setores que atua
    const worksFinal = sids.includes(finalId);
    const extintoresMonth = worksFinal ? realProdMonth : totalQty;
    const extintoresToday = worksFinal ? realProdToday : todayQty;
    // Meta em PONTOS
    const goal = u.pointsGoal || 500;
    const pct = Math.round((points / goal) * 100);
    const metGoal = pct >= (config.minGoalPercent || 100);
    // Bônus: sempre calcula valor (para exibição), mas marca se atingiu meta
    const bonusValue = points * config.pointValue;
    const bonus = metGoal ? bonusValue : 0;
    const perf = pct >= 100 ? "high" : pct >= 50 ? "med" : "low";
    // Breakdown por setor
    const sectorBreakdown = uSectors.map(sec => {
      const sp = mp.filter(p => p.sectorId === sec.id);
      const sq = sp.reduce((s, p) => s + p.quantity, 0);
      return { ...sec, qty: sq, pts: sq * sec.pointsPerUnit };
    });
    return { ...u, sectorIds: sids, sectors: uSectors, sectorBreakdown, sectorNames: uSectors.map(s => s.name).join(", "),
      totalQty, todayQty, points, todayPoints, goal, pct, metGoal, bonus, bonusValue, perf, realProdMonth, realProdToday, extintoresMonth, extintoresToday, worksFinal };
  });
}
function useEmployeeStats(users, sectors, production, config) { return useMemo(() => computeEmployeeStats(users, sectors, production, config), [users, sectors, production, config]); }

// ══════════════════════════════════════════════════════════════
export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); const [sectors, setSectors] = useState([]);
  const [production, setProduction] = useState([]); const [config, setConfig] = useState({ pointValue: 0.5, minGoalPercent: 100, finalSectorId: 's1' });
  const [history, setHistory] = useState([]); const [logs, setLogs] = useState([]);
  const [page, setPage] = useState("dashboard"); const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const loadAll = useCallback(async () => {
    const [u,s,p,c,h,l] = await Promise.all([db.getUsers(),db.getSectors(),db.getProduction(),db.getConfig(),db.getHistory(),db.getLogs()]);
    setUsers(u); setSectors(s); setProduction(p); setConfig(c); setHistory(h); setLogs(l); setLoading(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const t=setInterval(loadAll, 30000); return ()=>clearInterval(t); }, [loadAll]);

  const addLogEntry = useCallback(async (action, details) => {
    const entry = { id:genId(), userId:currentUser?.id, userName:currentUser?.name, action, details };
    await db.addLog(entry); setLogs(prev => [{ ...entry, timestamp:new Date().toISOString() }, ...prev].slice(0,200));
  }, [currentUser]);

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><div style={{ marginTop:16,color:"var(--text-muted)" }}>Conectando ao servidor...</div></div>;
  if (!currentUser) return <LoginScreen users={users} onLogin={u => { setCurrentUser(u); setPage("dashboard"); }} />;

  const isAdmin = currentUser.role === "admin";
  const userSectorNames = sectors.filter(s => getUserSectorIds(currentUser).includes(s.id)).map(s => s.name).join(", ") || "Colaborador";
  const navItems = isAdmin
    ? [{id:"dashboard",label:"Dashboard",icon:Icons.dashboard,section:"Principal"},{id:"production",label:"Lançar Produção",icon:Icons.production,section:"Principal"},{id:"ranking",label:"Ranking",icon:Icons.ranking,section:"Principal"},{id:"reports",label:"Relatórios",icon:Icons.reports,section:"Principal"},{id:"users",label:"Usuários",icon:Icons.users,section:"Gestão"},{id:"sectors",label:"Setores",icon:Icons.sectors,section:"Gestão"},{id:"history",label:"Histórico",icon:Icons.history,section:"Gestão"},{id:"settings",label:"Configurações",icon:Icons.settings,section:"Gestão"},{id:"logs",label:"Logs",icon:Icons.logs,section:"Gestão"}]
    : [{id:"dashboard",label:"Minha Produção",icon:Icons.dashboard,section:"Principal"},{id:"ranking",label:"Ranking",icon:Icons.ranking,section:"Principal"},{id:"myproduction",label:"Meus Lançamentos",icon:Icons.production,section:"Principal"},{id:"history",label:"Histórico",icon:Icons.history,section:"Principal"}];
  const pageLabels = Object.fromEntries(navItems.map(n=>[n.id,n.label]));

  return (
    <div className="app">
      {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen?"open":""}`}>
        <div className="sidebar-brand"><div className="brand-icon">{Icons.fire}</div><div><h1>BonusProd</h1><small>Gestão de Bonificação</small></div></div>
        <nav className="sidebar-nav">{navItems.map((item,i)=>(<div key={item.id}>{(i===0||navItems[i-1].section!==item.section)&&<div className="nav-section">{item.section}</div>}<div className={`nav-item ${page===item.id?"active":""}`} onClick={()=>{setPage(item.id);setSidebarOpen(false);loadAll();}}>{item.icon}{item.label}</div></div>))}</nav>
        <div className="sidebar-footer"><div className="user-badge"><div className="user-avatar">{currentUser.name.charAt(0)}</div><div className="user-info"><div className="user-name">{currentUser.name}</div><div className="user-role">{isAdmin?"Administrador":userSectorNames}</div></div><button className="btn-logout" onClick={()=>setShowChangePwd(true)} title="Alterar Senha" style={{marginRight:4}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></button><button className="btn-logout" onClick={()=>setCurrentUser(null)} title="Sair">{Icons.logout}</button></div><div style={{textAlign:"center",fontSize:10,color:"var(--text-muted)",marginTop:10,fontFamily:"'Space Mono',monospace"}}>BonusProd {APP_VERSION}</div></div>
      </aside>
      <main className="main">
        <div className="topbar"><div style={{display:"flex",alignItems:"center",gap:12}}><button className="mobile-menu-btn" onClick={()=>setSidebarOpen(true)}>{Icons.menu}</button><h2>{pageLabels[page]||"Dashboard"}</h2></div>
          <div style={{display:"flex",alignItems:"center",gap:16}}><button className="btn btn-secondary btn-sm" onClick={loadAll} title="Atualizar">{Icons.refresh} Atualizar</button><div className="topbar-date">{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div></div>
        <div className="content fade-in" key={page}>
          {page==="dashboard"&&(isAdmin?<AdminDashboard users={users} sectors={sectors} production={production} config={config}/>:<EmployeeDashboard user={currentUser} sectors={sectors} production={production} config={config}/>)}
          {page==="production"&&isAdmin&&<ProductionPage users={users} sectors={sectors} production={production} setProduction={setProduction} addLog={addLogEntry}/>}
          {page==="ranking"&&<RankingPage users={users} sectors={sectors} production={production} config={config} isAdmin={isAdmin}/>}
          {page==="myproduction"&&!isAdmin&&<MyProductionPage currentUser={currentUser} sectors={sectors} production={production}/>}
          {page==="reports"&&isAdmin&&<ReportsPage users={users} sectors={sectors} production={production} config={config}/>}
          {page==="users"&&isAdmin&&<UsersPage users={users} setUsers={setUsers} sectors={sectors} addLog={addLogEntry}/>}
          {page==="sectors"&&isAdmin&&<SectorsPage sectors={sectors} setSectors={setSectors} addLog={addLogEntry}/>}
          {page==="history"&&<HistoryPage history={history} setHistory={setHistory} users={users} sectors={sectors} production={production} config={config} addLog={addLogEntry} isAdmin={isAdmin} currentUser={currentUser}/>}
          {page==="settings"&&isAdmin&&<SettingsPage config={config} setConfig={setConfig} sectors={sectors} addLog={addLogEntry}/>}
          {page==="logs"&&isAdmin&&<LogsPage logs={logs}/>}
        </div>
      </main>
      {showChangePwd && <ChangePasswordModal currentUser={currentUser} setCurrentUser={setCurrentUser} setUsers={setUsers} onClose={()=>setShowChangePwd(false)} addLog={addLogEntry}/>}
    </div>
  );
}

function ChangePasswordModal({ currentUser, setCurrentUser, setUsers, onClose, addLog }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError("");
    if (currentPwd !== currentUser.password) { setError("Senha atual incorreta."); return; }
    if (newPwd.length < 4) { setError("A nova senha deve ter no mínimo 4 caracteres."); return; }
    if (newPwd !== confirmPwd) { setError("A nova senha e a confirmação não coincidem."); return; }
    if (newPwd === currentPwd) { setError("A nova senha deve ser diferente da atual."); return; }
    const updated = { ...currentUser, password: newPwd };
    const saved = await db.upsertUser(updated);
    if (saved) {
      setCurrentUser(saved);
      setUsers(prev => prev.map(u => u.id === saved.id ? saved : u));
      addLog("Alteração de Senha", `${currentUser.name} alterou sua senha`);
      setSuccess(true);
    } else {
      setError("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">Alterar Senha</span>
          <button className="modal-close" onClick={onClose}>{Icons.close}</button>
        </div>
        {success ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ fontSize: 48, marginBottom: 12, color: "var(--success)" }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--success)", marginBottom: 16 }}>Senha alterada com sucesso!</div>
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Senha Atual</label>
              <input className="form-input" type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="Digite sua senha atual" />
            </div>
            <div className="form-group">
              <label className="form-label">Nova Senha</label>
              <input className="form-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 4 caracteres" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar Nova Senha</label>
              <input className="form-input" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Repita a nova senha" onKeyDown={e => e.key === "Enter" && handleSave()} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Salvar Nova Senha</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const [login, setLogin] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const handleSubmit = () => { const user = users.find(u=>u.login===login&&u.password===password); if(user) onLogin(user); else setError("Login ou senha incorretos."); };
  return (<div className="login-container"><div className="login-card fade-in">
    <div className="login-logo"><div className="logo-circle">{Icons.fire}</div><h1>BonusProd</h1><p>Sistema de Gestão de Bonificação</p></div>
    {error&&<div className="login-error">{error}</div>}
    <div><div className="form-group"><label className="form-label">Login</label><input className="form-input" value={login} onChange={e=>{setLogin(e.target.value);setError("");}} placeholder="Seu login" autoComplete="username"/></div>
    <div className="form-group"><label className="form-label">Senha</label><input className="form-input" type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder="Sua senha" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/></div>
    <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={handleSubmit}>Entrar</button></div>
    <div style={{textAlign:"center",fontSize:11,color:"var(--text-muted)",marginTop:20,fontFamily:"'Space Mono',monospace"}}>BonusProd {APP_VERSION}</div>
  </div></div>);
}

// ── ADMIN DASHBOARD ──
function AdminDashboard({ users, sectors, production, config }) {
  const stats = useEmployeeStats(users, sectors, production, config);
  const [detailEmp,setDetailEmp] = useState(null);
  const finalId = config.finalSectorId || 's1';
  const finalSector = sectors.find(s => s.id === finalId);
  // Filtro de período
  const now = new Date();
  const defaultFrom = dateToStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = getToday();
  const [periodFrom,setPeriodFrom] = useState(defaultFrom);
  const [periodTo,setPeriodTo] = useState(defaultTo);
  const mk = getMonthKey();
  const setQuick = (type) => {
    const t = new Date();
    if(type==="mes"){setPeriodFrom(dateToStr(new Date(t.getFullYear(),t.getMonth(),1)));setPeriodTo(getToday());}
    else if(type==="anterior"){const pm=new Date(t.getFullYear(),t.getMonth()-1,1);setPeriodFrom(dateToStr(pm));setPeriodTo(dateToStr(new Date(t.getFullYear(),t.getMonth(),0)));}
    else if(type==="7dias"){const wa=new Date();wa.setDate(t.getDate()-6);setPeriodFrom(dateToStr(wa));setPeriodTo(getToday());}
    else if(type==="hoje"){setPeriodFrom(getToday());setPeriodTo(getToday());}
  };
  // Dias úteis
  const autoWorkingDays = getCurrentMonthWorkingDays();
  const workingDays = config.workingDays && config.workingDays > 0 ? config.workingDays : autoWorkingDays;
  let elapsedWorkDays = 0;
  for(let d=1; d<=now.getDate(); d++){const dt=new Date(now.getFullYear(),now.getMonth(),d);const dow=dt.getDay();if(dow!==0 && dow!==6) elapsedWorkDays++;}
  // Produção filtrada pelo período
  const periodProd = useMemo(()=>production.filter(p=>p.date>=periodFrom && p.date<=periodTo),[production,periodFrom,periodTo]);
  const realProdPeriod = periodProd.filter(p=>p.sectorId===finalId).reduce((s,p)=>s+p.quantity,0);
  const realProdToday = production.filter(p=>p.date===getToday()&&p.sectorId===finalId).reduce((s,p)=>s+p.quantity,0);
  const totalBonusValue = stats.reduce((s,e)=>s+e.bonusValue,0);
  const totalBonusPaid = stats.reduce((s,e)=>s+e.bonus,0);
  const metGoalCount = stats.filter(e=>e.metGoal).length;
  const belowGoal = stats.filter(e=>!e.metGoal);
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const dailyData = useMemo(()=>{const mp=periodProd.filter(p=>p.sectorId===finalId);const map={};mp.forEach(p=>{map[p.date]=(map[p.date]||0)+p.quantity;});return Object.entries(map).sort().map(([date,qty])=>{const[y,m,d]=date.split("-");return{date:`${d} ${months[parseInt(m)-1]}`,qty};});},[periodProd,finalId]);
  const sectorData = useMemo(()=>sectors.map(s=>({name:s.name,qty:periodProd.filter(p=>p.sectorId===s.id).reduce((sum,p)=>sum+p.quantity,0),isFinal:s.id===finalId})),[sectors,periodProd,finalId]);
  const sorted = [...stats].sort((a,b)=>b.points-a.points);
  return (
    <div>
      {/* Filtro de período */}
      <div className="card" style={{marginBottom:16,padding:"12px 16px"}}>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:13,marginRight:8}}>Período:</span>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("hoje")}>Hoje</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("7dias")}>7 dias</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("mes")}>Este mês</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("anterior")}>Mês anterior</button>
          <input className="form-input" type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={{width:140,padding:"4px 8px",fontSize:12}}/>
          <span style={{color:"var(--text-muted)"}}>até</span>
          <input className="form-input" type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={{width:140,padding:"4px 8px",fontSize:12}}/>
        </div>
      </div>
      {/* Barra de dias úteis */}
      <div className="card" style={{marginBottom:20,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
          <div><span style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Dias Úteis</span><div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--accent)"}}>{workingDays}</div></div>
          <div><span style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Decorridos</span><div className="mono" style={{fontSize:20,fontWeight:700}}>{elapsedWorkDays}</div></div>
          <div><span style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Restantes</span><div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--success)"}}>{Math.max(0,workingDays-elapsedWorkDays)}</div></div>
          <div><span style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Média/Dia</span><div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--blue)"}}>{elapsedWorkDays>0?(realProdPeriod/elapsedWorkDays).toFixed(1):0}</div></div>
        </div>
        <div style={{fontSize:11,color:"var(--text-muted)",fontStyle:"italic"}}>{config.workingDays&&config.workingDays>0?"Manual":"Auto (seg-sex)"}</div>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Produção Hoje ({finalSector?.name||"Final"})</div><div className="stat-value">{realProdToday}</div><div className="stat-sub">extintores hoje</div></div>
        <div className="stat-card green"><div className="stat-label">Produção Período</div><div className="stat-value">{realProdPeriod}</div><div className="stat-sub">{formatDate(periodFrom)} — {formatDate(periodTo)}</div></div>
        <div className="stat-card blue"><div className="stat-label">Bônus (meta atingida)</div><div className="stat-value" style={{fontSize:22}}>{formatCurrency(totalBonusPaid)}</div><div className="stat-sub">Projetado: {formatCurrency(totalBonusValue)}</div></div>
        <div className="stat-card purple"><div className="stat-label">Bateram Meta</div><div className="stat-value">{metGoalCount}/{stats.length}</div><div className="stat-sub">colaboradores</div></div>
      </div>
      <div className="grid-2" style={{marginBottom:24}}>
        <div className="card"><div className="card-header"><span className="card-title">Produção Finalizada/Dia</span></div>
          {dailyData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/><XAxis dataKey="date" tick={{fill:"#8B8FA3",fontSize:11}}/><YAxis tick={{fill:"#8B8FA3",fontSize:11}}/><Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/><Bar dataKey="qty" name="Finalizados" fill="#E8651A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<EmptyState text="Sem dados"/>}
        </div>
        <div className="card"><div className="card-header"><span className="card-title">Lançamentos por Setor</span></div>
          {sectorData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={sectorData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/><XAxis dataKey="name" tick={{fill:"#8B8FA3",fontSize:10}} angle={-15} textAnchor="end" height={60}/><YAxis tick={{fill:"#8B8FA3",fontSize:11}}/><Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/><Bar dataKey="qty" name="Quantidade" radius={[4,4,0,0]}>{sectorData.map((entry,i)=><Cell key={i} fill={entry.isFinal?"#E8651A":"#3B82F6"}/>)}</Bar></BarChart></ResponsiveContainer>:<EmptyState text="Sem dados"/>}
        </div>
      </div>
      <div className="grid-2">
        <div className="card"><div className="card-header"><span className="card-title">Top 10 — Pontos</span><span style={{fontSize:11,color:"var(--text-muted)"}}>Clique para detalhes</span></div><div className="table-wrapper"><table><thead><tr><th>#</th><th>Colaborador</th><th>Extintores</th><th>Pontos</th><th>Meta</th><th>%</th><th>Bônus</th></tr></thead><tbody>
          {sorted.slice(0,10).map((e,i)=><tr key={e.id} style={{cursor:"pointer"}} onClick={()=>setDetailEmp(e)}><td><div className={`rank-medal ${i<3?`rank-${i+1}`:"rank-default"}`}>{i+1}</div></td><td style={{fontWeight:600,color:"var(--accent)"}}>{e.name}</td><td className="mono">{e.extintoresMonth}</td><td className="mono accent">{e.points}</td><td className="mono">{e.goal}</td><td><span className={`badge ${pctBadge(e.pct)}`}>{e.pct}%</span></td><td className="mono" style={{color:e.metGoal?"var(--success)":"var(--warning)"}}>{formatCurrency(e.bonusValue)}{e.metGoal?"":" *"}</td></tr>)}
        </tbody></table></div><div style={{fontSize:11,color:"var(--text-muted)",padding:"8px 12px"}}>* Bônus projetado (meta não atingida)</div></div>
        <div className="card"><div className="card-header"><span className="card-title">Alertas — Abaixo da Meta</span><span className="badge red">{belowGoal.length}</span></div>
          {belowGoal.length>0?<div className="alert-list">{belowGoal.map(e=><div key={e.id} className="alert-item" style={{cursor:"pointer"}} onClick={()=>setDetailEmp(e)}><div><div style={{fontWeight:600,fontSize:14}}>{e.name}</div><div style={{fontSize:12,color:"var(--text-muted)"}}>{e.sectorNames}</div></div><div style={{textAlign:"right"}}><div className="mono" style={{color:pctColor(e.pct)}}>{e.points}/{e.goal} pts ({e.pct}%)</div><div style={{fontSize:11,color:"var(--text-muted)"}}>Bônus proj: {formatCurrency(e.bonusValue)}</div></div></div>)}</div>
          :<div style={{padding:30,textAlign:"center",color:"var(--success)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{Icons.check} Todos na meta!</div>}
        </div>
      </div>
      {detailEmp && <EmployeeDetailModal emp={detailEmp} sectors={sectors} production={production} config={config} onClose={()=>setDetailEmp(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// EMPLOYEE DETAIL MODAL — dashboard completo de um colaborador
// ══════════════════════════════════════════════════════════════
function EmployeeDetailModal({ emp, sectors, production, config, onClose }) {
  const mk = getMonthKey();
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  // Toda produção do colaborador
  const allProd = production.filter(p=>p.userId===emp.id);
  const monthProd = allProd.filter(p=>p.date.startsWith(mk));

  // Pontos e quantidades agregados
  let totalPoints = 0; let totalQty = 0;
  monthProd.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId); totalPoints += p.quantity*(sec?.pointsPerUnit||0); totalQty += p.quantity;});
  const goal = emp.pointsGoal || 500;
  const pct = Math.round((totalPoints/goal)*100);
  const metGoal = pct >= (config.minGoalPercent||100);
  const bonus = metGoal ? totalPoints*config.pointValue : 0;
  const pc = pct>=100?"var(--success)":pct>=70?"var(--warning)":"var(--danger)";

  // Setor com mais produção
  const bySector = {};
  monthProd.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId); if(!sec) return; if(!bySector[sec.id]) bySector[sec.id]={...sec,qty:0,pts:0,days:new Set()}; bySector[sec.id].qty += p.quantity; bySector[sec.id].pts += p.quantity*sec.pointsPerUnit; bySector[sec.id].days.add(p.date);});
  const sectorList = Object.values(bySector).map(s=>({...s,days:s.days.size})).sort((a,b)=>b.pts-a.pts);
  const topSector = sectorList[0];

  // Produção diária (qtd e pontos por dia)
  const byDay = {};
  monthProd.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId);if(!byDay[p.date])byDay[p.date]={date:p.date,qty:0,pts:0};byDay[p.date].qty+=p.quantity;byDay[p.date].pts+=p.quantity*(sec?.pointsPerUnit||0);});
  const dailyData = Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const[y,m,day]=d.date.split("-");return{...d,label:`${day} ${months[parseInt(m)-1]}`};});

  // Estatísticas
  const daysWorked = Object.keys(byDay).length;
  const avgPtsDay = daysWorked > 0 ? Math.round(totalPoints/daysWorked) : 0;
  const avgQtyDay = daysWorked > 0 ? (totalQty/daysWorked).toFixed(1) : 0;
  const bestDay = dailyData.length > 0 ? dailyData.reduce((a,b)=>b.pts>a.pts?b:a) : null;

  // Histórico dos últimos lançamentos
  const recentEntries = [...monthProd].sort((a,b)=>(b.date+(b.createdAt||"")).localeCompare(a.date+(a.createdAt||""))).slice(0,15);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-in" onClick={e=>e.stopPropagation()} style={{maxWidth:900,width:"95vw",maxHeight:"92vh"}}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{emp.name}</span>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>{emp.sectorNames} • Meta: {goal} pts • {monthLabel(mk)}</div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icons.close}</button>
        </div>

        {/* Stats principais */}
        <div className="stats-grid" style={{marginBottom:20}}>
          <div className="stat-card"><div className="stat-label">Pontos</div><div className="stat-value accent" style={{fontSize:24}}>{totalPoints}</div><div className="stat-sub">de {goal}</div></div>
          <div className="stat-card green"><div className="stat-label">Extintores</div><div className="stat-value" style={{fontSize:24}}>{emp.extintoresMonth}</div><div className="stat-sub">{emp.worksFinal?"finalizados":"trabalhados"}</div></div>
          <div className="stat-card blue"><div className="stat-label">Bônus</div><div className="stat-value" style={{fontSize:20}}>{formatCurrency(bonus)}</div><div className="stat-sub">{metGoal?"✓ Meta atingida":"Abaixo da meta"}</div></div>
          <div className="stat-card purple"><div className="stat-label">% da Meta</div><div className="stat-value" style={{color:pc,fontSize:24}}>{pct}%</div><div className="stat-sub">{daysWorked} dias trabalhados</div></div>
        </div>

        {/* Progresso */}
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Progresso da Meta</span></div>
          <div style={{background:"#1a1d2e",borderRadius:10,height:20,marginBottom:8,overflow:"hidden",border:"1px solid #2A2E3F"}}>
            <div style={{width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:10,background:pct>=100?"linear-gradient(90deg,#22C55E,#16A34A)":pct>=50?"linear-gradient(90deg,#EAB308,#F59E0B)":"linear-gradient(90deg,#EF4444,#DC2626)",transition:"width 0.5s",minWidth:pct>0?"8px":"0"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text-muted)"}}>
            <span>{totalPoints} pontos</span><span>Faltam {Math.max(0,goal-totalPoints)} pts</span><span>Meta: {goal}</span>
          </div>
        </div>

        {/* Indicadores secundários */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {/* DESTAQUE: Média extintores por dia */}
          <div className="card" style={{padding:18,background:"linear-gradient(135deg,#E8651A22,#E8651A11)",border:"1px solid #E8651A44"}}>
            <div style={{fontSize:11,color:"var(--accent)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:8}}>Média Extintores / Dia</div>
            <div style={{fontSize:28,fontWeight:800,color:"var(--accent)"}} className="mono">{daysWorked>0?(emp.extintoresMonth/daysWorked).toFixed(1):"0"}</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>{emp.extintoresMonth} extintores em {daysWorked} dias</div>
          </div>
          {/* DESTAQUE: Média pontos por dia */}
          <div className="card" style={{padding:18,background:"linear-gradient(135deg,#3B82F622,#3B82F611)",border:"1px solid #3B82F644"}}>
            <div style={{fontSize:11,color:"#3B82F6",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:8}}>Média Pontos / Dia</div>
            <div style={{fontSize:28,fontWeight:800,color:"#3B82F6"}} className="mono">{avgPtsDay}</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>{avgQtyDay} unidades por dia</div>
          </div>
        </div>
        <div className="grid-3" style={{marginBottom:20}}>
          <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Setor Top</div><div style={{fontSize:16,fontWeight:700}}>{topSector?.name||"—"}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{topSector?topSector.pts+" pts • "+topSector.qty+" un":""}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Melhor Dia</div><div style={{fontSize:16,fontWeight:700}} className="mono">{bestDay?bestDay.pts+" pts":"—"}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{bestDay?bestDay.label:""}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Bônus {emp.metGoal?"✓":"(proj.)"}</div><div style={{fontSize:16,fontWeight:700,color:emp.metGoal?"var(--success)":"var(--warning)"}} className="mono">{formatCurrency(emp.bonusValue)}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{emp.metGoal?"Meta atingida":"Faltam "+(emp.goal-totalPoints)+" pts"}</div></div>
        </div>

        {/* Gráfico de produção diária — pontos */}
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Pontos por Dia</span></div>
          {dailyData.length>0 ? <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/>
              <XAxis dataKey="label" tick={{fill:"#8B8FA3",fontSize:11}}/>
              <YAxis tick={{fill:"#8B8FA3",fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/>
              <Bar dataKey="pts" name="Pontos" fill="#E8651A" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer> : <EmptyState text="Sem produção"/>}
        </div>

        {/* Gráfico de produção diária — quantidade */}
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Unidades por Dia</span></div>
          {dailyData.length>0 ? <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/>
              <XAxis dataKey="label" tick={{fill:"#8B8FA3",fontSize:11}}/>
              <YAxis tick={{fill:"#8B8FA3",fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/>
              <Bar dataKey="qty" name="Unidades" fill="#3B82F6" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer> : <EmptyState text="Sem produção"/>}
        </div>

        {/* Detalhamento por setor */}
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Produção por Setor</span></div>
          <div className="table-wrapper"><table>
            <thead><tr><th>Setor</th><th>Unidades</th><th>Pts/Un</th><th>Pontos</th><th>Dias Atuados</th><th>% do Total</th></tr></thead>
            <tbody>
              {sectorList.length===0 ? <tr><td colSpan={6} style={{textAlign:"center",color:"var(--text-muted)",padding:20}}>Sem produção neste mês</td></tr>
              : sectorList.map(s=><tr key={s.id}>
                <td style={{fontWeight:600}}>{s.name}{s.isFinal?<span className="badge green" style={{marginLeft:8,fontSize:10}}>★ Final</span>:""}</td>
                <td className="mono">{s.qty}</td>
                <td className="mono">{s.pointsPerUnit}</td>
                <td className="mono accent">{s.pts}</td>
                <td className="mono">{s.days}</td>
                <td className="mono">{totalPoints>0?Math.round((s.pts/totalPoints)*100):0}%</td>
              </tr>)}
            </tbody>
          </table></div>
        </div>

        {/* Lançamentos recentes */}
        <div className="card">
          <div className="card-header"><span className="card-title">Últimos Lançamentos</span><span className="badge blue">{recentEntries.length}</span></div>
          <div className="table-wrapper"><table>
            <thead><tr><th>Data</th><th>Setor</th><th>Quantidade</th><th>Pontos</th></tr></thead>
            <tbody>
              {recentEntries.length===0 ? <tr><td colSpan={4} style={{textAlign:"center",color:"var(--text-muted)",padding:20}}>Sem lançamentos</td></tr>
              : recentEntries.map(p=>{const sec=sectors.find(s=>s.id===p.sectorId);return(
                <tr key={p.id}>
                  <td className="mono" style={{fontSize:12}}>{formatDate(p.date)}</td>
                  <td>{sec?.name||"—"}</td>
                  <td className="mono">{p.quantity}</td>
                  <td className="mono accent">{p.quantity*(sec?.pointsPerUnit||0)}</td>
                </tr>);})}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}

// ── EMPLOYEE DASHBOARD ──
function EmployeeDashboard({ user, sectors, production, config }) {
  const mk = getMonthKey(); const sids = getUserSectorIds(user);
  const finalId = config.finalSectorId || 's1';
  const worksFinal = sids.includes(finalId);
  const uSectors = sectors.filter(s=>sids.includes(s.id));
  const mp = production.filter(p=>p.userId===user.id&&p.date.startsWith(mk));
  let points = 0; mp.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId); points+=p.quantity*(sec?.pointsPerUnit||0);});
  const goal = user.pointsGoal || 500;
  const pct = Math.round((points/goal)*100);
  const metGoal = pct >= (config.minGoalPercent||100);
  const bonus = metGoal ? points*config.pointValue : 0;
  // Extintores: igual à lógica do admin (final se trabalha no setor final, senão total)
  const totalQty = mp.reduce((s,p)=>s+p.quantity,0);
  const finalQty = mp.filter(p=>p.sectorId===finalId).reduce((s,p)=>s+p.quantity,0);
  const extintores = worksFinal ? finalQty : totalQty;
  const sectorBreakdown = uSectors.map(sec=>{const sp=mp.filter(p=>p.sectorId===sec.id);const sq=sp.reduce((s,p)=>s+p.quantity,0);return{...sec,qty:sq,pts:sq*sec.pointsPerUnit};});
  const dailyData = useMemo(()=>{const map={};mp.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId);if(!map[p.date])map[p.date]={date:p.date,qty:0,pts:0};map[p.date].qty+=p.quantity;map[p.date].pts+=p.quantity*(sec?.pointsPerUnit||0);});const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const[y,m,day]=d.date.split("-");return{...d,label:`${day} ${months[parseInt(m)-1]}`};});},[mp,sectors]);
  const pc = pctColor(pct);
  const bonusValue = points * config.pointValue;
  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Meus Pontos</div><div className="stat-value accent">{points}</div><div className="stat-sub">de {goal} (meta)</div></div>
        <div className="stat-card green"><div className="stat-label">Extintores</div><div className="stat-value">{extintores}</div><div className="stat-sub">{worksFinal?"finalizados":"trabalhados"} no mês</div></div>
        <div className="stat-card blue"><div className="stat-label">Bônus {metGoal?"✓":"(projetado)"}</div><div className="stat-value" style={{fontSize:22,color:metGoal?"var(--success)":"var(--warning)"}}>{formatCurrency(bonusValue)}</div><div className="stat-sub">{metGoal?"Meta atingida":"Meta não atingida ainda"}</div></div>
        <div className="stat-card purple"><div className="stat-label">Percentual</div><div className="stat-value" style={{color:pc}}>{pct}%</div><div className="stat-sub">da meta em pontos</div></div>
      </div>
      <div style={{marginBottom:24}}><div className="card"><div className="card-header"><span className="card-title">Progresso da Meta ({points}/{goal} pontos)</span></div>
        <div style={{background:"#1a1d2e",borderRadius:10,height:22,marginBottom:8,overflow:"hidden",border:"1px solid #2A2E3F"}}><div style={{width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:10,background:pct>=100?"linear-gradient(90deg,#22C55E,#16A34A)":pct>=50?"linear-gradient(90deg,#EAB308,#F59E0B)":"linear-gradient(90deg,#EF4444,#DC2626)",transition:"width 0.5s",minWidth:pct>0?"8px":"0"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text-muted)"}}><span>{points} pontos</span><span>Meta: {goal} pontos</span></div>
      </div></div>
      {/* Detalhamento por setor */}
      <div className="card" style={{marginBottom:24}}><div className="card-header"><span className="card-title">Pontos por Setor</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>{sectorBreakdown.map(sec=>(<div key={sec.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"var(--bg-input)",borderRadius:8}}>
          <div><span style={{fontWeight:600,fontSize:14}}>{sec.name}</span><span style={{fontSize:12,color:"var(--text-muted)",marginLeft:8}}>{sec.pointsPerUnit} pts/un</span></div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}><span className="mono" style={{fontSize:13}}>{sec.qty} un</span><span className="mono accent" style={{fontWeight:700}}>{sec.pts} pts</span></div>
        </div>))}</div>
      </div>
      <div className="grid-2">
        <div className="card"><div className="card-header"><span className="card-title">Evolução Diária</span></div>
          {dailyData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/><XAxis dataKey="label" tick={{fill:"#8B8FA3",fontSize:11}}/><YAxis tick={{fill:"#8B8FA3",fontSize:11}}/><Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/><Bar dataKey="pts" name="Pontos" fill="#E8651A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<EmptyState text="Sem produção"/>}
        </div>
        <div className="card"><div className="card-header"><span className="card-title">Simulação</span></div><SimulationWidget currentPts={points} goal={goal} config={config}/></div>
      </div>
    </div>
  );
}

function SimulationWidget({ currentPts, goal, config }) {
  const [simPts, setSimPts] = useState(currentPts); useEffect(()=>setSimPts(currentPts),[currentPts]);
  const pct = Math.round((simPts/goal)*100); const met = pct>=(config.minGoalPercent||100); const val = met?simPts*config.pointValue:0;
  return (<div><div className="form-group"><label className="form-label">Simular total de pontos</label><input className="form-input" type="number" min={0} value={simPts} onChange={e=>setSimPts(Math.max(0,parseInt(e.target.value)||0))}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}><div className="sim-box"><div className="sim-label">% DA META</div><div className="sim-value" style={{color:met?"var(--success)":"var(--danger)"}}>{pct}%</div></div><div className="sim-box"><div className="sim-label">BÔNUS</div><div className="sim-value" style={{color:met?"var(--success)":"var(--danger)"}}>{formatCurrency(val)}</div></div></div>
    <div style={{marginTop:12,textAlign:"center",fontSize:12,color:met?"var(--success)":"var(--text-muted)"}}>{met?"✓ Meta atingida!":`Faltam ${Math.max(0,goal-simPts)} pontos`}</div></div>);
}

// ── PRODUCTION PAGE (com importação Excel) ──
function ProductionPage({ users, sectors, production, setProduction, addLog }) {
  const [selUser,setSelUser] = useState(""); const [selSector,setSelSector] = useState("");
  const [qty,setQty] = useState(""); const [date,setDate] = useState(getToday());
  const [importModal,setImportModal] = useState(false);
  const [editEntry,setEditEntry] = useState(null);
  // Filtros da listagem (intervalo + colaborador + setor)
  const [filterFrom,setFilterFrom] = useState(getToday());
  const [filterTo,setFilterTo] = useState(getToday());
  const [filterUser,setFilterUser] = useState("");
  const [filterSector,setFilterSector] = useState("");
  const employees = users.filter(u=>u.role==="employee");
  const avail = useMemo(()=>{if(!selUser) return [];const u=users.find(x=>x.id===selUser);return sectors.filter(s=>getUserSectorIds(u).includes(s.id));},[selUser,users,sectors]);
  useEffect(()=>{setSelSector(avail.length===1?avail[0].id:"");},[avail]);
  const handleAdd = async ()=>{if(!selUser||!selSector||!qty||parseInt(qty)<=0) return;const q=parseInt(qty);const user=users.find(u=>u.id===selUser);const sector=sectors.find(s=>s.id===selSector);
    const entry={id:genId(),userId:selUser,sectorId:selSector,quantity:q,date};const result=await db.addProduction(entry);
    if(result){setProduction(prev=>[result,...prev]);addLog("Lançamento",`${user?.name} (${sector?.name}): ${q} un → ${q*(sector?.pointsPerUnit||0)} pts`);setQty("");}};
  // Lista filtrada por intervalo + colaborador + setor
  const filteredEntries = useMemo(()=>{
    return production
      .filter(p=>p.date>=filterFrom && p.date<=filterTo)
      .filter(p=>!filterUser || p.userId===filterUser)
      .filter(p=>!filterSector || p.sectorId===filterSector)
      .sort((a,b)=>(b.date+(b.createdAt||"")).localeCompare(a.date+(a.createdAt||"")));
  },[production,filterFrom,filterTo,filterUser,filterSector]);
  const filteredTotal = filteredEntries.reduce((s,e)=>s+e.quantity,0);
  const filteredPoints = filteredEntries.reduce((s,e)=>{const sec=sectors.find(x=>x.id===e.sectorId);return s+e.quantity*(sec?.pointsPerUnit||0);},0);
  const handleDelete = async (id)=>{const e=production.find(p=>p.id===id);const u=users.find(x=>x.id===e?.userId);const s=sectors.find(x=>x.id===e?.sectorId);
    await db.deleteProduction(id);setProduction(prev=>prev.filter(p=>p.id!==id));addLog("Exclusão",`${u?.name} (${s?.name}) — ${e?.quantity} un`);};
  const handleEditSave = async (updated)=>{
    const old = production.find(p=>p.id===updated.id);
    const result = await db.updateProduction(updated);
    if(result){
      setProduction(prev=>prev.map(p=>p.id===result.id?result:p));
      const u=users.find(x=>x.id===result.userId); const s=sectors.find(x=>x.id===result.sectorId);
      addLog("Edição Lançamento",`${u?.name} (${s?.name}): ${old?.quantity}→${result.quantity} un em ${formatDate(result.date)}`);
    }
    setEditEntry(null);
  };
  // Atalhos rápidos de período (usa data local, não UTC)
  const setQuickRange = (type)=>{const t=new Date();const yest=new Date();yest.setDate(t.getDate()-1);const weekAgo=new Date();weekAgo.setDate(t.getDate()-6);const monthStart=new Date(t.getFullYear(),t.getMonth(),1);
    if(type==="hoje"){setFilterFrom(getToday());setFilterTo(getToday());}
    else if(type==="ontem"){const y=dateToStr(yest);setFilterFrom(y);setFilterTo(y);}
    else if(type==="7dias"){setFilterFrom(dateToStr(weekAgo));setFilterTo(getToday());}
    else if(type==="mes"){setFilterFrom(dateToStr(monthStart));setFilterTo(getToday());}};
  return (
    <div>
      <div className="card" style={{marginBottom:24}}><div className="card-header"><span className="card-title">Novo Lançamento</span>
        <button className="btn btn-secondary btn-sm" onClick={()=>setImportModal(true)}>{Icons.production} Importar Planilha</button></div>
        <div className="production-form-v2">
          <div className="form-group" style={{margin:0}}><label className="form-label">Colaborador</label><select className="form-select" value={selUser} onChange={e=>setSelUser(e.target.value)}>
            <option value="">Selecione...</option>{employees.map(u=>{const names=sectors.filter(s=>getUserSectorIds(u).includes(s.id)).map(s=>s.name).join(", ");return<option key={u.id} value={u.id}>{u.name} — {names}</option>;})}</select></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Setor</label><select className="form-select" value={selSector} onChange={e=>setSelSector(e.target.value)} disabled={!selUser||avail.length<=1}>
            {avail.length===0&&<option value="">Selecione colaborador</option>}{avail.length===1&&<option value={avail[0].id}>{avail[0].name}</option>}
            {avail.length>1&&<><option value="">Selecione setor...</option>{avail.map(s=><option key={s.id} value={s.id}>{s.name} ({s.pointsPerUnit} pts/un)</option>)}</>}</select></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Quantidade</label><input className="form-input" type="number" min={1} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" onKeyDown={e=>e.key==="Enter"&&handleAdd()}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Data</label><input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <button className="btn btn-primary" onClick={handleAdd} style={{alignSelf:"end"}}>Lançar</button>
        </div></div>

      <div className="card" style={{marginBottom:24}}><div className="card-header"><span className="card-title">Filtrar Lançamentos</span></div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuickRange("hoje")}>Hoje</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuickRange("ontem")}>Ontem</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuickRange("7dias")}>Últimos 7 dias</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuickRange("mes")}>Este mês</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.5fr 1.5fr",gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">De</label><input className="form-input" type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Até</label><input className="form-input" type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Colaborador</label><select className="form-select" value={filterUser} onChange={e=>setFilterUser(e.target.value)}><option value="">Todos</option>{employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Setor</label><select className="form-select" value={filterSector} onChange={e=>setFilterSector(e.target.value)}><option value="">Todos</option>{sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
      </div>

      <div className="card"><div className="card-header"><span className="card-title">Lançamentos — {formatDate(filterFrom)} {filterFrom!==filterTo?` até ${formatDate(filterTo)}`:""}</span>
        <div style={{display:"flex",gap:8}}><span className="badge blue">{filteredEntries.length} registros</span><span className="badge green">{filteredTotal} un</span><span className="badge yellow">{filteredPoints} pts</span></div></div>
        <div className="table-wrapper"><table><thead><tr><th>Data</th><th>Colaborador</th><th>Setor</th><th>Qtd</th><th>Pontos</th><th>Ações</th></tr></thead><tbody>
          {filteredEntries.length===0?<tr><td colSpan={6} style={{textAlign:"center",color:"var(--text-muted)",padding:30}}>Nenhum lançamento no período</td></tr>
          :filteredEntries.map(e=>{const u=users.find(x=>x.id===e.userId);const s=sectors.find(x=>x.id===e.sectorId);return(
            <tr key={e.id}><td className="mono" style={{fontSize:12}}>{formatDate(e.date)}</td><td style={{fontWeight:600}}>{u?.name||"—"}</td><td>{s?.name||"—"}</td><td className="mono">{e.quantity}</td><td className="mono accent">{e.quantity*(s?.pointsPerUnit||0)}</td><td><div style={{display:"flex",gap:6}}><button className="btn btn-secondary btn-sm" onClick={()=>setEditEntry(e)}>Editar</button><button className="btn btn-danger btn-sm" onClick={()=>handleDelete(e.id)}>Excluir</button></div></td></tr>);})}</tbody></table></div></div>
      {importModal&&<ExcelImportModal users={users} sectors={sectors} setProduction={setProduction} addLog={addLog} onClose={()=>setImportModal(false)}/>}
      {editEntry&&<EditProductionModal entry={editEntry} users={users} sectors={sectors} onSave={handleEditSave} onClose={()=>setEditEntry(null)}/>}
    </div>);
}

function EditProductionModal({ entry, users, sectors, onSave, onClose }) {
  const [form,setForm] = useState({ id:entry.id, userId:entry.userId, sectorId:entry.sectorId, quantity:entry.quantity, date:entry.date });
  const user = users.find(u=>u.id===form.userId);
  const availSectors = user ? sectors.filter(s=>getUserSectorIds(user).includes(s.id)) : [];
  // Ao mudar colaborador, resetar setor se necessário
  useEffect(()=>{
    if(form.userId && user){
      const has = getUserSectorIds(user).includes(form.sectorId);
      if(!has && availSectors.length>0) setForm(f=>({...f,sectorId:availSectors[0].id}));
    }
    // eslint-disable-next-line
  },[form.userId]);
  const sector = sectors.find(s=>s.id===form.sectorId);
  const pts = form.quantity * (sector?.pointsPerUnit || 0);
  const handleSubmit = ()=>{
    if(!form.userId||!form.sectorId||!form.quantity||parseInt(form.quantity)<=0) return;
    onSave({...form, quantity:parseInt(form.quantity)});
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-in" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Editar Lançamento</span>
          <button className="modal-close" onClick={onClose}>{Icons.close}</button>
        </div>
        <div className="form-group">
          <label className="form-label">Colaborador</label>
          <select className="form-select" value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}>
            {users.filter(u=>u.role==="employee").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Setor</label>
          <select className="form-select" value={form.sectorId} onChange={e=>setForm({...form,sectorId:e.target.value})}>
            {availSectors.map(s=><option key={s.id} value={s.id}>{s.name} ({s.pointsPerUnit} pts/un)</option>)}
          </select>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Quantidade</label>
            <input className="form-input" type="number" min={1} value={form.quantity} onChange={e=>setForm({...form,quantity:parseInt(e.target.value)||0})}/>
          </div>
          <div className="form-group">
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          </div>
        </div>
        <div style={{padding:12,background:"var(--bg-input)",borderRadius:8,textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>PONTOS RESULTANTES</div>
          <div className="mono accent" style={{fontSize:22,fontWeight:700}}>{pts}</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ExcelImportModal({ users, sectors, setProduction, addLog, onClose }) {
  const [rows,setRows] = useState([]);
  const [errors,setErrors] = useState([]);
  const [importing,setImporting] = useState(false);
  const [done,setDone] = useState(false);
  const [importCount,setImportCount] = useState(0);
  const fileRef = { current: null };

  const handleFile = (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt)=>{
      try {
        const wb = XLSX.read(evt.target.result, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, {defval:""});
        processRows(json);
      } catch(err) { setErrors(["Erro ao ler arquivo: "+err.message]); }
    };
    reader.readAsArrayBuffer(file);
  };

  const processRows = (json)=>{
    const errs = []; const parsed = [];
    const employees = users.filter(u=>u.role==="employee");
    json.forEach((row,i)=>{
      const lineNum = i+2; // +2 porque linha 1 é cabeçalho
      // Buscar colaborador por nome (case insensitive, parcial)
      const nameVal = String(row['colaborador']||row['Colaborador']||row['COLABORADOR']||row['nome']||row['Nome']||row['NOME']||"").trim();
      const sectorVal = String(row['setor']||row['Setor']||row['SETOR']||"").trim();
      const qtyVal = parseInt(row['quantidade']||row['Quantidade']||row['QUANTIDADE']||row['qtd']||row['Qtd']||row['QTD']||0);
      let dateVal = row['data']||row['Data']||row['DATA']||"";

      if(!nameVal){errs.push(`Linha ${lineNum}: colaborador vazio`);return;}
      if(!qtyVal||qtyVal<=0){errs.push(`Linha ${lineNum}: quantidade inválida`);return;}

      // Match colaborador
      const emp = employees.find(u=>u.name.toLowerCase()===nameVal.toLowerCase()) || employees.find(u=>u.name.toLowerCase().includes(nameVal.toLowerCase()));
      if(!emp){errs.push(`Linha ${lineNum}: colaborador "${nameVal}" não encontrado`);return;}

      // Match setor
      let sec = null;
      if(sectorVal){
        sec = sectors.find(s=>s.name.toLowerCase()===sectorVal.toLowerCase()) || sectors.find(s=>s.name.toLowerCase().includes(sectorVal.toLowerCase()));
        if(!sec){errs.push(`Linha ${lineNum}: setor "${sectorVal}" não encontrado`);return;}
        if(!getUserSectorIds(emp).includes(sec.id)){errs.push(`Linha ${lineNum}: ${emp.name} não pertence ao setor "${sec.name}"`);return;}
      } else {
        // Se não informou setor, usar o primeiro do colaborador
        const sids = getUserSectorIds(emp);
        if(sids.length===1){sec=sectors.find(s=>s.id===sids[0]);}
        else{errs.push(`Linha ${lineNum}: ${emp.name} tem múltiplos setores, especifique o setor`);return;}
      }

      // Date handling
      let dateStr = "";
      if(dateVal instanceof Date){dateStr = dateVal.toISOString().split("T")[0];}
      else if(typeof dateVal === "string" && dateVal){
        // Try DD/MM/YYYY or YYYY-MM-DD
        if(dateVal.includes("/")){const p=dateVal.split("/");if(p.length===3) dateStr=`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;}
        else if(dateVal.includes("-")){dateStr=dateVal;}
      }
      if(!dateStr){dateStr=getToday();}

      parsed.push({userName:emp.name,sectorName:sec.name,userId:emp.id,sectorId:sec.id,quantity:qtyVal,date:dateStr,pts:qtyVal*sec.pointsPerUnit});
    });
    setRows(parsed); setErrors(errs);
  };

  const handleImport = async ()=>{
    setImporting(true); let count=0;
    for(const row of rows){
      const entry={id:genId(),userId:row.userId,sectorId:row.sectorId,quantity:row.quantity,date:row.date};
      const result = await db.addProduction(entry);
      if(result){setProduction(prev=>[result,...prev]);count++;}
    }
    addLog("Importação Excel",`${count} lançamentos importados`);
    setImportCount(count); setDone(true); setImporting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal fade-in modal-wide" onClick={e=>e.stopPropagation()} style={{maxWidth:750}}>
      <div className="modal-header"><span className="modal-title">Importar Planilha Excel</span><button className="modal-close" onClick={onClose}>{Icons.close}</button></div>

      {done ? (
        <div style={{textAlign:"center",padding:30}}>
          <div style={{fontSize:48,marginBottom:12}}>✓</div>
          <div style={{fontSize:18,fontWeight:700,color:"var(--success)",marginBottom:8}}>{importCount} lançamentos importados!</div>
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      ) : (<>
        <div style={{marginBottom:20}}>
          <div style={{padding:16,background:"var(--bg-input)",borderRadius:8,marginBottom:16}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:8}}>Formato da planilha:</div>
            <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.8}}>
              A planilha deve ter as seguintes colunas (a primeira linha deve ser o cabeçalho):<br/>
              <span className="mono" style={{color:"var(--accent)"}}>Colaborador</span> — nome do colaborador (obrigatório)<br/>
              <span className="mono" style={{color:"var(--accent)"}}>Setor</span> — nome do setor (obrigatório se tiver múltiplos setores)<br/>
              <span className="mono" style={{color:"var(--accent)"}}>Quantidade</span> — número de unidades (obrigatório)<br/>
              <span className="mono" style={{color:"var(--accent)"}}>Data</span> — formato DD/MM/AAAA (opcional, usa hoje se vazio)
            </div>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{marginBottom:16}} />
        </div>

        {errors.length>0&&<div style={{marginBottom:16,padding:12,background:"var(--danger-bg)",borderRadius:8,maxHeight:120,overflowY:"auto"}}>
          <div style={{fontWeight:600,fontSize:12,color:"var(--danger)",marginBottom:4}}>Avisos ({errors.length}):</div>
          {errors.map((e,i)=><div key={i} style={{fontSize:12,color:"var(--danger)"}}>{e}</div>)}
        </div>}

        {rows.length>0&&(<>
          <div style={{marginBottom:12,fontSize:14}}><span className="badge green">{rows.length} lançamentos prontos para importar</span></div>
          <div className="table-wrapper" style={{maxHeight:300,overflowY:"auto"}}><table><thead><tr><th>Colaborador</th><th>Setor</th><th>Qtd</th><th>Pontos</th><th>Data</th></tr></thead><tbody>
            {rows.map((r,i)=><tr key={i}><td style={{fontWeight:600}}>{r.userName}</td><td>{r.sectorName}</td><td className="mono">{r.quantity}</td><td className="mono accent">{r.pts}</td><td className="mono" style={{fontSize:12}}>{formatDate(r.date)}</td></tr>)}
          </tbody></table></div>
        </>)}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          {rows.length>0&&<button className="btn btn-primary" onClick={handleImport} disabled={importing}>{importing?`Importando...`:`Importar ${rows.length} lançamentos`}</button>}
        </div>
      </>)}
    </div></div>
  );
}

// ── RANKING (por pontos, meta em pontos) ──
function RankingPage({ users, sectors, production, config, isAdmin }) {
  const [tab,setTab] = useState("geral"); const stats = useEmployeeStats(users,sectors,production,config);
  const [detailEmp,setDetailEmp] = useState(null);
  const sorted = [...stats].sort((a,b)=>b.points-a.points);
  return (<div>
    <div className="tabs"><button className={`tab ${tab==="geral"?"active":""}`} onClick={()=>setTab("geral")}>Ranking Geral</button>
      {sectors.map(s=><button key={s.id} className={`tab ${tab===s.id?"active":""}`} onClick={()=>setTab(s.id)}>{s.name}</button>)}</div>
    <div className="card"><div className="card-header"><span className="card-title">Clique no colaborador para ver detalhes</span></div><div className="table-wrapper"><table><thead><tr><th>#</th><th>Colaborador</th><th>Setores</th><th>Extintores</th><th>Pontos</th><th>Meta</th><th>%</th>{isAdmin&&<th>Bônus</th>}<th>Desemp.</th></tr></thead><tbody>
      {(tab==="geral"?sorted:sorted.filter(e=>getUserSectorIds(e).includes(tab))).map((e,i)=>(
        <tr key={e.id} style={{cursor:"pointer"}} onClick={()=>setDetailEmp(e)}><td><div className={`rank-medal ${i<3?`rank-${i+1}`:"rank-default"}`}>{i+1}</div></td><td style={{fontWeight:600,color:"var(--accent)"}}>{e.name}</td><td style={{fontSize:12,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.sectorNames}</td><td className="mono">{e.extintoresMonth}</td><td className="mono accent">{e.points}</td><td className="mono">{e.goal}</td><td><span className={`badge ${pctBadge(e.pct)}`}>{e.pct}%</span></td>{isAdmin&&<td className="mono" style={{color:e.metGoal?"var(--success)":"var(--warning)"}}>{formatCurrency(e.bonusValue)}{e.metGoal?"":" *"}</td>}<td><div className="perf-indicator"><span className={`perf-dot perf-${e.perf}`}/>{e.perf==="high"?"Alto":e.perf==="med"?"Médio":"Baixo"}</div></td></tr>))}</tbody></table></div>{isAdmin&&<div style={{fontSize:11,color:"var(--text-muted)",padding:"8px 12px"}}>* Bônus projetado (meta não atingida)</div>}</div>
    {detailEmp && <EmployeeDetailModal emp={detailEmp} sectors={sectors} production={production} config={config} onClose={()=>setDetailEmp(null)} />}
  </div>);
}

// ── USERS (com campo meta em pontos + edição em lote) ──
function UsersPage({ users, setUsers, sectors, addLog }) {
  const [modal,setModal] = useState(null);
  const [batchModal,setBatchModal] = useState(false);
  const handleSave = async (d)=>{const saved=await db.upsertUser({...d,id:d.id||genId()});if(saved){if(d.id){setUsers(prev=>prev.map(u=>u.id===saved.id?saved:u));addLog("Edição",`${saved.name}`);}else{setUsers(prev=>[...prev,saved]);addLog("Novo Usuário",`${saved.name} (${saved.role})`);}};setModal(null);};
  const handleDelete = async (id)=>{const u=users.find(x=>x.id===id);await db.deleteUser(id);setUsers(prev=>prev.filter(x=>x.id!==id));addLog("Exclusão",`${u?.name}`);};
  return (<div><div className="card"><div className="card-header"><span className="card-title">Usuários ({users.length})</span>
    <div style={{display:"flex",gap:8}}><button className="btn btn-secondary btn-sm" onClick={()=>setBatchModal(true)}>Editar Metas em Lote</button><button className="btn btn-primary btn-sm" onClick={()=>setModal("add")}>+ Novo</button></div></div>
    <div className="table-wrapper"><table><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Setores</th><th>Meta (pts)</th><th>Ações</th></tr></thead><tbody>
      {users.map(u=>{const ids=getUserSectorIds(u);const names=sectors.filter(s=>ids.includes(s.id)).map(s=>s.name);return(
        <tr key={u.id}><td style={{fontWeight:600}}>{u.name}</td><td className="mono" style={{color:"var(--text-muted)"}}>{u.login}</td>
          <td><span className={`badge ${u.role==="admin"?"yellow":"blue"}`}>{u.role==="admin"?"Admin":"Colaborador"}</span></td>
          <td><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{names.length>0?names.map(n=><span key={n} className="badge blue" style={{fontSize:10}}>{n}</span>):<span style={{color:"var(--text-muted)",fontSize:12}}>—</span>}</div></td>
          <td className="mono">{u.role==="employee"?u.pointsGoal||500:"—"}</td>
          <td><div style={{display:"flex",gap:8}}><button className="btn btn-secondary btn-sm" onClick={()=>setModal(u)}>Editar</button>{u.id!=="u0"&&<button className="btn btn-danger btn-sm" onClick={()=>handleDelete(u.id)}>Excluir</button>}</div></td></tr>);})}
    </tbody></table></div></div>
    {modal&&<Modal title={modal==="add"?"Novo Usuário":"Editar Usuário"} onClose={()=>setModal(null)}><UserForm user={modal==="add"?null:modal} sectors={sectors} onSave={handleSave} onClose={()=>setModal(null)}/></Modal>}
    {batchModal&&<BatchGoalModal users={users} setUsers={setUsers} addLog={addLog} onClose={()=>setBatchModal(false)}/>}
  </div>);
}

function BatchGoalModal({ users, setUsers, addLog, onClose }) {
  const employees = users.filter(u=>u.role==="employee");
  const [goals,setGoals] = useState(()=>Object.fromEntries(employees.map(e=>[e.id, e.pointsGoal||500])));
  const [globalVal,setGlobalVal] = useState("");
  const [saving,setSaving] = useState(false);

  const applyGlobal = ()=>{if(!globalVal) return; const v=parseInt(globalVal); if(v>0){const ng={};employees.forEach(e=>{ng[e.id]=v;});setGoals(ng);}};
  const handleSave = async ()=>{
    setSaving(true);
    const updates = employees.filter(e=>(goals[e.id]||500)!==(e.pointsGoal||500));
    for(const emp of updates){
      const saved = await db.upsertUser({...emp, pointsGoal: goals[emp.id]||500});
      if(saved) setUsers(prev=>prev.map(u=>u.id===saved.id?saved:u));
    }
    addLog("Meta em Lote",`${updates.length} colaboradores atualizados`);
    setSaving(false); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal fade-in modal-wide" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><span className="modal-title">Editar Metas em Lote</span><button className="modal-close" onClick={onClose}>{Icons.close}</button></div>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:20,padding:"12px 16px",background:"var(--bg-input)",borderRadius:8}}>
        <div style={{flex:1}}><label className="form-label">Aplicar meta para todos</label><input className="form-input" type="number" min={1} value={globalVal} onChange={e=>setGlobalVal(e.target.value)} placeholder="Ex: 600"/></div>
        <button className="btn btn-secondary btn-sm" onClick={applyGlobal}>Aplicar a Todos</button>
      </div>
      <div className="table-wrapper"><table><thead><tr><th>Colaborador</th><th>Meta Atual</th><th>Nova Meta (pts)</th></tr></thead><tbody>
        {employees.map(e=>(<tr key={e.id}><td style={{fontWeight:600}}>{e.name}</td><td className="mono" style={{color:"var(--text-muted)"}}>{e.pointsGoal||500}</td>
          <td><input className="form-input" type="number" min={1} style={{width:120}} value={goals[e.id]||""} onChange={ev=>setGoals(prev=>({...prev,[e.id]:parseInt(ev.target.value)||0}))}/></td></tr>))}
      </tbody></table></div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?"Salvando...":"Salvar Metas"}</button></div>
    </div></div>
  );
}

function UserForm({ user, sectors, onSave, onClose }) {
  const [form,setForm] = useState({name:user?.name||"",login:user?.login||"",password:user?.password||"",role:user?.role||"employee",sectorIds:user?getUserSectorIds(user):[],pointsGoal:user?.pointsGoal||500});
  const toggle = sid=>setForm(prev=>({...prev,sectorIds:prev.sectorIds.includes(sid)?prev.sectorIds.filter(id=>id!==sid):[...prev.sectorIds,sid]}));
  const handleSubmit = ()=>{if(!form.name||!form.login||!form.password) return;if(form.role==="employee"&&form.sectorIds.length===0) return;onSave({...form,id:user?.id});};
  return (<>
    <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
    <div className="grid-2"><div className="form-group"><label className="form-label">Login</label><input className="form-input" value={form.login} onChange={e=>setForm({...form,login:e.target.value})}/></div>
      <div className="form-group"><label className="form-label">Senha</label><input className="form-input" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div></div>
    <div className="grid-2">
      <div className="form-group"><label className="form-label">Perfil</label><select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="employee">Colaborador</option><option value="admin">Administrador</option></select></div>
      {form.role==="employee"&&<div className="form-group"><label className="form-label">Meta em Pontos</label><input className="form-input" type="number" min={1} value={form.pointsGoal} onChange={e=>setForm({...form,pointsGoal:parseInt(e.target.value)||100})}/></div>}
    </div>
    {form.role==="employee"&&<div className="form-group"><label className="form-label">Setores (selecione um ou mais)</label>
      <div className="sector-checkboxes">{sectors.map(s=>{const chk=form.sectorIds.includes(s.id);return(
        <label key={s.id} className={`sector-checkbox ${chk?"checked":""}`} onClick={()=>toggle(s.id)}>
          <div className={`checkbox-box ${chk?"checked":""}`}>{chk&&Icons.check}</div>
          <div><div style={{fontWeight:600,fontSize:13}}>{s.name}{s.isFinal?" ★":""}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s.pointsPerUnit} pts/un{s.isFinal?" (setor final)":""}</div></div>
        </label>);})}</div></div>}
    <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit}>Salvar</button></div></>);
}

// ── SECTORS (sem meta, com flag "setor final") ──
function SectorsPage({ sectors, setSectors, addLog }) {
  const [modal,setModal] = useState(null);
  const [batchModal,setBatchModal] = useState(false);
  const handleSave = async (d)=>{const saved=await db.upsertSector({...d,id:d.id||genId()});if(saved){if(d.id){setSectors(prev=>prev.map(s=>s.id===saved.id?saved:s));addLog("Edição Setor",`${saved.name}`);}else{setSectors(prev=>[...prev,saved]);addLog("Novo Setor",`${saved.name}`);}}setModal(null);};
  const handleDelete = async (id)=>{const s=sectors.find(x=>x.id===id);await db.deleteSector(id);setSectors(prev=>prev.filter(x=>x.id!==id));addLog("Exclusão Setor",`${s?.name}`);};
  return (<div><div className="card"><div className="card-header"><span className="card-title">Setores ({sectors.length})</span>
    <div style={{display:"flex",gap:8}}><button className="btn btn-secondary btn-sm" onClick={()=>setBatchModal(true)}>Editar Pontos em Lote</button><button className="btn btn-primary btn-sm" onClick={()=>setModal("add")}>+ Novo</button></div></div>
    <div className="table-wrapper"><table><thead><tr><th>Setor</th><th>Pontos/Un</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>
      {sectors.map(s=><tr key={s.id}><td style={{fontWeight:600}}>{s.name}</td><td className="mono accent">{s.pointsPerUnit}</td><td>{s.isFinal?<span className="badge green">★ Setor Final</span>:<span className="badge blue">Intermediário</span>}</td><td><div style={{display:"flex",gap:8}}><button className="btn btn-secondary btn-sm" onClick={()=>setModal(s)}>Editar</button><button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id)}>Excluir</button></div></td></tr>)}
    </tbody></table></div></div>
    {modal&&<Modal title={modal==="add"?"Novo Setor":"Editar Setor"} onClose={()=>setModal(null)}><SectorForm sector={modal==="add"?null:modal} onSave={handleSave} onClose={()=>setModal(null)}/></Modal>}
    {batchModal&&<BatchSectorPointsModal sectors={sectors} setSectors={setSectors} addLog={addLog} onClose={()=>setBatchModal(false)}/>}
  </div>);
}

function BatchSectorPointsModal({ sectors, setSectors, addLog, onClose }) {
  const [points,setPoints] = useState(()=>Object.fromEntries(sectors.map(s=>[s.id, s.pointsPerUnit])));
  const [globalVal,setGlobalVal] = useState("");
  const [saving,setSaving] = useState(false);
  const applyGlobal = ()=>{if(!globalVal) return; const v=parseFloat(globalVal); if(v>=0){const n={};sectors.forEach(s=>{n[s.id]=v;});setPoints(n);}};
  const handleSave = async ()=>{
    setSaving(true);
    const updates = sectors.filter(s=>parseFloat(points[s.id])!==parseFloat(s.pointsPerUnit));
    for(const sec of updates){
      const saved = await db.upsertSector({...sec, pointsPerUnit: parseFloat(points[sec.id])||0});
      if(saved) setSectors(prev=>prev.map(s=>s.id===saved.id?saved:s));
    }
    addLog("Pontos em Lote",`${updates.length} setores atualizados`);
    setSaving(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal fade-in modal-wide" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><span className="modal-title">Editar Pontos dos Setores em Lote</span><button className="modal-close" onClick={onClose}>{Icons.close}</button></div>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:20,padding:"12px 16px",background:"var(--bg-input)",borderRadius:8}}>
        <div style={{flex:1}}><label className="form-label">Aplicar pontos para todos</label><input className="form-input" type="number" step="0.5" min={0} value={globalVal} onChange={e=>setGlobalVal(e.target.value)} placeholder="Ex: 2.5"/></div>
        <button className="btn btn-secondary btn-sm" onClick={applyGlobal}>Aplicar a Todos</button>
      </div>
      <div className="table-wrapper"><table><thead><tr><th>Setor</th><th>Pontos Atuais</th><th>Novos Pontos/Un</th></tr></thead><tbody>
        {sectors.map(s=>(<tr key={s.id}><td style={{fontWeight:600}}>{s.name}{s.isFinal?<span className="badge green" style={{marginLeft:6,fontSize:9}}>★</span>:""}</td><td className="mono" style={{color:"var(--text-muted)"}}>{s.pointsPerUnit}</td>
          <td><input className="form-input" type="number" step="0.5" min={0} style={{width:120}} value={points[s.id]??""} onChange={ev=>setPoints(prev=>({...prev,[s.id]:ev.target.value}))}/></td></tr>))}
      </tbody></table></div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></div>
    </div></div>
  );
}

function SectorForm({ sector, onSave, onClose }) {
  const [form,setForm] = useState({name:sector?.name||"",pointsPerUnit:sector?.pointsPerUnit||1,isFinal:sector?.isFinal||false});
  return (<><div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
    <div className="grid-2">
      <div className="form-group"><label className="form-label">Pontos/Unidade</label><input className="form-input" type="number" step="0.5" min={0} value={form.pointsPerUnit} onChange={e=>setForm({...form,pointsPerUnit:parseFloat(e.target.value)||0})}/></div>
      <div className="form-group"><label className="form-label">Setor Final?</label><select className="form-select" value={form.isFinal?"sim":"nao"} onChange={e=>setForm({...form,isFinal:e.target.value==="sim"})}><option value="nao">Não (intermediário)</option><option value="sim">Sim (produção real)</option></select>
        <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Setor final define a contagem real de extintores finalizados</div></div>
    </div>
    <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>{if(form.name)onSave({...form,id:sector?.id})}}>Salvar</button></div></>);
}

function HistoryPage({ history, setHistory, users, sectors, production, config, addLog, isAdmin, currentUser }) {
  const mk=getMonthKey();const[viewMonth,setViewMonth]=useState(null);
  const handleClose = async ()=>{const stats=computeEmployeeStats(users,sectors,production,config);const entry={id:genId(),monthKey:mk,pointValue:config.pointValue,employees:stats.map(e=>({userId:e.id,name:e.name,sectors:e.sectorNames,points:e.points,goal:e.goal,bonus:e.bonus,pct:e.pct,metGoal:e.metGoal}))};
    await db.addHistory(entry);setHistory(prev=>[{...entry,closedAt:new Date().toISOString()},...prev]);addLog("Fechamento",`Mês ${monthLabel(mk)}`);};
  return (<div>
    {isAdmin&&<div className="card" style={{marginBottom:24}}><div className="card-header"><span className="card-title">Fechamento — {monthLabel(mk)}</span><button className="btn btn-primary btn-sm" onClick={handleClose}>Fechar Mês</button></div><p style={{fontSize:13,color:"var(--text-muted)"}}>Armazena produção e bonificação no histórico.</p></div>}
    <div className="card"><div className="card-header"><span className="card-title">Meses Fechados</span></div>
      {history.length===0?<EmptyState text="Nenhum histórico"/>
      :<div className="table-wrapper"><table><thead><tr><th>Mês</th><th>Fechado</th><th>Colab.</th><th>Bônus Total</th><th></th></tr></thead><tbody>
        {history.map(h=>{const total=h.employees.reduce((s,e)=>s+e.bonus,0);return(<tr key={h.id}><td style={{fontWeight:600}}>{monthLabel(h.monthKey)}</td><td style={{color:"var(--text-muted)"}}>{new Date(h.closedAt).toLocaleDateString("pt-BR")}</td><td>{h.employees.length}</td><td className="mono" style={{color:"var(--success)"}}>{formatCurrency(total)}</td><td><button className="btn btn-secondary btn-sm" onClick={()=>setViewMonth(h)}>Ver</button></td></tr>);})}</tbody></table></div>}</div>
    {viewMonth&&<Modal title={`Detalhes — ${monthLabel(viewMonth.monthKey)}`} onClose={()=>setViewMonth(null)} wide>
      <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>Valor do ponto: {formatCurrency(viewMonth.pointValue)}</div>
      <div className="table-wrapper"><table><thead><tr><th>Colaborador</th><th>Setores</th><th>Pontos</th><th>Meta</th><th>%</th><th>Bônus</th></tr></thead><tbody>
        {(isAdmin?viewMonth.employees:viewMonth.employees.filter(e=>e.userId===currentUser.id)).map((e,i)=>(
          <tr key={i}><td style={{fontWeight:600}}>{e.name}</td><td style={{fontSize:12}}>{e.sectors||"—"}</td><td className="mono accent">{e.points}</td><td className="mono">{e.goal}</td><td><span className={`badge ${pctBadge(e.pct)}`}>{e.pct}%</span></td><td className="mono" style={{color:e.metGoal?"var(--success)":"var(--text-muted)"}}>{formatCurrency(e.bonus)}</td></tr>))}</tbody></table></div></Modal>}</div>);
}

// ── SETTINGS (com seletor de setor final) ──
function SettingsPage({ config, setConfig, sectors, addLog }) {
  const [pv,setPv]=useState(config.pointValue);const [mg,setMg]=useState(config.minGoalPercent);const [fs,setFs]=useState(config.finalSectorId||'s1');
  const [wd,setWd]=useState(config.workingDays||0);
  const auto = getCurrentMonthWorkingDays();
  const handleSave = async ()=>{const newConf={pointValue:pv,minGoalPercent:mg,finalSectorId:fs,workingDays:wd};await db.saveConfig(newConf);setConfig(newConf);
    addLog("Config","Configurações atualizadas");};
  return (<div><div className="card" style={{maxWidth:600}}><div className="card-header"><span className="card-title">Configurações Globais</span></div>
    <div className="form-group"><label className="form-label">Valor do Ponto (R$)</label><input className="form-input" type="number" step="0.01" min={0} value={pv} onChange={e=>setPv(parseFloat(e.target.value)||0)}/><div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Cada ponto vale {formatCurrency(pv)}</div></div>
    <div className="form-group"><label className="form-label">Meta Mínima (%)</label><input className="form-input" type="number" min={0} max={200} value={mg} onChange={e=>setMg(parseInt(e.target.value)||0)}/><div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Colaboradores precisam atingir {mg}% da meta em pontos</div></div>
    <div className="form-group"><label className="form-label">Setor Final (produção real)</label><select className="form-select" value={fs} onChange={e=>setFs(e.target.value)}>{sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Apenas este setor conta como produção finalizada de extintores</div></div>
    <div className="form-group"><label className="form-label">Dias Úteis do Mês</label><div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input className="form-input" type="number" min={0} max={31} value={wd} onChange={e=>setWd(parseInt(e.target.value)||0)} style={{flex:1}}/>
      <button className="btn btn-secondary btn-sm" onClick={()=>setWd(0)}>Usar Auto</button>
      <button className="btn btn-secondary btn-sm" onClick={()=>setWd(auto)}>Aplicar Auto ({auto})</button>
    </div><div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Cálculo automático (seg-sex): {auto} dias. Use 0 para usar o cálculo automático, ou defina manualmente para considerar feriados.</div></div>
    <button className="btn btn-primary" onClick={handleSave}>Salvar</button></div></div>);
}

// ══════════════════════════════════════════════════════════════
// REPORTS PAGE — relatórios com filtro de período
// ══════════════════════════════════════════════════════════════
function ReportsPage({ users, sectors, production, config }) {
  const [tab,setTab] = useState("colaborador"); // colaborador | setor | individual
  const today = getToday();
  const monthStart = (()=>{const d=new Date();return dateToStr(new Date(d.getFullYear(),d.getMonth(),1));})();
  const [from,setFrom] = useState(monthStart);
  const [to,setTo] = useState(today);
  const [selEmp,setSelEmp] = useState("");
  const [detailEmp,setDetailEmp] = useState(null);

  const setQuick = (type)=>{const t=new Date();
    if(type==="hoje"){setFrom(today);setTo(today);}
    else if(type==="7"){const w=new Date();w.setDate(t.getDate()-6);setFrom(dateToStr(w));setTo(today);}
    else if(type==="mes"){setFrom(dateToStr(new Date(t.getFullYear(),t.getMonth(),1)));setTo(today);}
    else if(type==="mesant"){const a=new Date(t.getFullYear(),t.getMonth()-1,1);const u=new Date(t.getFullYear(),t.getMonth(),0);setFrom(dateToStr(a));setTo(dateToStr(u));}};

  // Filtra produção pelo período
  const periodProd = useMemo(()=>production.filter(p=>p.date>=from && p.date<=to),[production,from,to]);

  // Conta dias úteis decorridos no período (seg-sex)
  const periodWorkingDays = useMemo(()=>{
    const start=new Date(from+"T00:00:00"); const end=new Date(to+"T00:00:00");
    let count=0; const d=new Date(start);
    while(d<=end){const dow=d.getDay();if(dow!==0 && dow!==6) count++;d.setDate(d.getDate()+1);}
    return count;
  },[from,to]);

  // Produção por colaborador
  const byEmployee = useMemo(()=>{
    const employees = users.filter(u=>u.role==="employee");
    return employees.map(emp=>{
      const ep = periodProd.filter(p=>p.userId===emp.id);
      const days = new Set(ep.map(p=>p.date)).size;
      let pts=0,qty=0,finalQty=0;
      const finalId = config.finalSectorId||'s1';
      ep.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId); pts+=p.quantity*(sec?.pointsPerUnit||0); qty+=p.quantity; if(p.sectorId===finalId) finalQty+=p.quantity;});
      const sids = getUserSectorIds(emp);
      const worksFinal = sids.includes(finalId);
      const extintores = worksFinal ? finalQty : qty;
      return { id:emp.id, name:emp.name, sectors:sectors.filter(s=>sids.includes(s.id)).map(s=>s.name).join(", "),
        days, qty, pts, extintores, avgPts:days>0?Math.round(pts/days):0, avgQty:days>0?(qty/days).toFixed(1):0, raw:emp };
    }).sort((a,b)=>b.pts-a.pts);
  },[users,periodProd,sectors,config]);

  // Produção por setor
  const bySector = useMemo(()=>{
    return sectors.map(sec=>{
      const sp = periodProd.filter(p=>p.sectorId===sec.id);
      const qty = sp.reduce((s,p)=>s+p.quantity,0);
      const pts = qty*sec.pointsPerUnit;
      const days = new Set(sp.map(p=>p.date)).size;
      const colabs = new Set(sp.map(p=>p.userId)).size;
      return { ...sec, qty, pts, days, colabs, avgQty:days>0?(qty/days).toFixed(1):0 };
    }).sort((a,b)=>b.qty-a.qty);
  },[sectors,periodProd]);

  // Totais
  const totalQty = byEmployee.reduce((s,e)=>s+e.qty,0);
  const totalPts = byEmployee.reduce((s,e)=>s+e.pts,0);

  // Exportar para Excel
  const exportExcel = ()=>{
    const wb = XLSX.utils.book_new();
    if(tab==="colaborador"){
      const data = byEmployee.map(e=>({Colaborador:e.name,Setores:e.sectors,"Dias Trabalhados":e.days,"Quantidade":e.qty,"Pontos":e.pts,"Média Pts/Dia":e.avgPts,"Média Un/Dia":e.avgQty,"Extintores":e.extintores}));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb,ws,"Por Colaborador");
    } else if(tab==="setor"){
      const data = bySector.map(s=>({Setor:s.name,"Tipo":s.isFinal?"Final":"Intermediário","Pts/Un":s.pointsPerUnit,"Quantidade":s.qty,"Pontos":s.pts,"Dias Ativos":s.days,"Colaboradores":s.colabs,"Média Un/Dia":s.avgQty}));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb,ws,"Por Setor");
    }
    XLSX.writeFile(wb,`relatorio_${tab}_${from}_a_${to}.xlsx`);
  };

  return (
    <div>
      {/* Filtros de período */}
      <div className="card" style={{marginBottom:24}}>
        <div className="card-header"><span className="card-title">Período do Relatório</span></div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("hoje")}>Hoje</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("7")}>Últimos 7 dias</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("mes")}>Este mês</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("mesant")}>Mês anterior</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">De</label><input className="form-input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Até</label><input className="form-input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"var(--bg-input)",borderRadius:8,display:"flex",gap:24,flexWrap:"wrap",fontSize:13}}>
          <div><span style={{color:"var(--text-muted)"}}>Período:</span> <strong>{formatDate(from)} a {formatDate(to)}</strong></div>
          <div><span style={{color:"var(--text-muted)"}}>Dias úteis:</span> <strong className="mono">{periodWorkingDays}</strong></div>
          <div><span style={{color:"var(--text-muted)"}}>Total un:</span> <strong className="mono accent">{totalQty}</strong></div>
          <div><span style={{color:"var(--text-muted)"}}>Total pts:</span> <strong className="mono accent">{totalPts}</strong></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab==="colaborador"?"active":""}`} onClick={()=>setTab("colaborador")}>Por Colaborador</button>
        <button className={`tab ${tab==="setor"?"active":""}`} onClick={()=>setTab("setor")}>Por Setor</button>
        <button className={`tab ${tab==="individual"?"active":""}`} onClick={()=>setTab("individual")}>Individual</button>
      </div>

      {/* Por colaborador */}
      {tab==="colaborador" && (<>
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Produção por Colaborador</span><button className="btn btn-secondary btn-sm" onClick={exportExcel}>Exportar Excel</button></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byEmployee.slice(0,15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/>
              <XAxis dataKey="name" tick={{fill:"#8B8FA3",fontSize:10}} angle={-25} textAnchor="end" height={70}/>
              <YAxis tick={{fill:"#8B8FA3",fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/>
              <Bar dataKey="pts" name="Pontos" fill="#E8651A" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="table-wrapper"><table>
            <thead><tr><th>#</th><th>Colaborador</th><th>Setores</th><th>Dias Trab.</th><th>Qtd</th><th>Pontos</th><th>Méd Pts/Dia</th><th>Méd Un/Dia</th><th>Extintores</th></tr></thead>
            <tbody>
              {byEmployee.length===0?<tr><td colSpan={9} style={{textAlign:"center",color:"var(--text-muted)",padding:30}}>Sem dados no período</td></tr>
              :byEmployee.map((e,i)=>(
                <tr key={e.id} style={{cursor:"pointer"}} onClick={()=>{setDetailEmp(e.raw);}}>
                  <td><div className={`rank-medal ${i<3?`rank-${i+1}`:"rank-default"}`}>{i+1}</div></td>
                  <td style={{fontWeight:600,color:"var(--accent)"}}>{e.name}</td>
                  <td style={{fontSize:12,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.sectors}</td>
                  <td className="mono">{e.days}</td>
                  <td className="mono">{e.qty}</td>
                  <td className="mono accent">{e.pts}</td>
                  <td className="mono">{e.avgPts}</td>
                  <td className="mono">{e.avgQty}</td>
                  <td className="mono">{e.extintores}</td>
                </tr>))}
            </tbody>
          </table></div>
        </div>
      </>)}

      {/* Por setor */}
      {tab==="setor" && (<>
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Produção por Setor</span><button className="btn btn-secondary btn-sm" onClick={exportExcel}>Exportar Excel</button></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bySector}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/>
              <XAxis dataKey="name" tick={{fill:"#8B8FA3",fontSize:10}} angle={-15} textAnchor="end" height={60}/>
              <YAxis tick={{fill:"#8B8FA3",fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/>
              <Bar dataKey="qty" name="Quantidade" radius={[4,4,0,0]}>{bySector.map((entry,i)=><Cell key={i} fill={entry.isFinal?"#E8651A":"#3B82F6"}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="table-wrapper"><table>
            <thead><tr><th>Setor</th><th>Tipo</th><th>Pts/Un</th><th>Quantidade</th><th>Pontos</th><th>Dias Ativos</th><th>Colaboradores</th><th>Média Un/Dia</th></tr></thead>
            <tbody>
              {bySector.length===0?<tr><td colSpan={8} style={{textAlign:"center",color:"var(--text-muted)",padding:30}}>Sem dados</td></tr>
              :bySector.map(s=>(
                <tr key={s.id}>
                  <td style={{fontWeight:600}}>{s.name}</td>
                  <td>{s.isFinal?<span className="badge green">★ Final</span>:<span className="badge blue">Intermediário</span>}</td>
                  <td className="mono">{s.pointsPerUnit}</td>
                  <td className="mono">{s.qty}</td>
                  <td className="mono accent">{s.pts}</td>
                  <td className="mono">{s.days}</td>
                  <td className="mono">{s.colabs}</td>
                  <td className="mono">{s.avgQty}</td>
                </tr>))}
            </tbody>
          </table></div>
        </div>
      </>)}

      {/* Individual */}
      {tab==="individual" && (<>
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">Selecionar Colaborador</span></div>
          <select className="form-select" value={selEmp} onChange={e=>setSelEmp(e.target.value)}>
            <option value="">Escolha um colaborador...</option>
            {users.filter(u=>u.role==="employee").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {selEmp && <IndividualReport empId={selEmp} users={users} sectors={sectors} production={periodProd} config={config} from={from} to={to} periodWorkingDays={periodWorkingDays}/>}
      </>)}

      {detailEmp && <EmployeeDetailModal emp={(()=>{const stats=computeEmployeeStats(users,sectors,production,config);return stats.find(s=>s.id===detailEmp.id)||detailEmp;})()} sectors={sectors} production={production} config={config} onClose={()=>setDetailEmp(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INDIVIDUAL REPORT — relatório individualizado completo
// ══════════════════════════════════════════════════════════════
function IndividualReport({ empId, users, sectors, production, config, from, to, periodWorkingDays }) {
  const emp = users.find(u=>u.id===empId);
  if(!emp) return null;
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const sids = getUserSectorIds(emp);
  const finalId = config.finalSectorId || 's1';
  const worksFinal = sids.includes(finalId);
  const ep = production.filter(p=>p.userId===emp.id);

  let totalPts=0, totalQty=0, finalQty=0;
  ep.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId); totalPts += p.quantity*(sec?.pointsPerUnit||0); totalQty += p.quantity; if(p.sectorId===finalId) finalQty += p.quantity;});
  const extintores = worksFinal ? finalQty : totalQty;
  const goal = emp.pointsGoal || 500;
  const pct = Math.round((totalPts/goal)*100);
  const metGoal = pct >= (config.minGoalPercent||100);
  const bonus = metGoal ? totalPts*config.pointValue : 0;
  const pc = pct>=100?"var(--success)":pct>=70?"var(--warning)":"var(--danger)";

  // Por setor
  const bySector = sids.map(id=>{const sec=sectors.find(s=>s.id===id);if(!sec) return null; const sp=ep.filter(p=>p.sectorId===id);const qty=sp.reduce((s,p)=>s+p.quantity,0);const pts=qty*sec.pointsPerUnit;const days=new Set(sp.map(p=>p.date)).size;return {...sec,qty,pts,days};}).filter(Boolean).sort((a,b)=>b.pts-a.pts);
  const topSector = bySector[0];

  // Diário
  const byDay = {};
  ep.forEach(p=>{const sec=sectors.find(s=>s.id===p.sectorId);if(!byDay[p.date])byDay[p.date]={date:p.date,qty:0,pts:0};byDay[p.date].qty+=p.quantity;byDay[p.date].pts+=p.quantity*(sec?.pointsPerUnit||0);});
  const dailyData = Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const[y,m,day]=d.date.split("-");return{...d,label:`${day} ${months[parseInt(m)-1]}`};});
  const daysWorked = dailyData.length;
  const avgPtsDay = daysWorked > 0 ? Math.round(totalPts/daysWorked) : 0;
  const avgQtyDay = daysWorked > 0 ? (totalQty/daysWorked).toFixed(1) : 0;
  // Média por dia útil do período (mesmo que não tenha trabalhado)
  const avgPtsWorkDay = periodWorkingDays > 0 ? Math.round(totalPts/periodWorkingDays) : 0;
  const bestDay = dailyData.length > 0 ? dailyData.reduce((a,b)=>b.pts>a.pts?b:a) : null;

  // Exportar
  const exportExcel = ()=>{
    const wb = XLSX.utils.book_new();
    const resumo = [
      {Campo:"Colaborador",Valor:emp.name},
      {Campo:"Setores",Valor:bySector.map(s=>s.name).join(", ")},
      {Campo:"Período",Valor:`${formatDate(from)} a ${formatDate(to)}`},
      {Campo:"Dias Úteis no Período",Valor:periodWorkingDays},
      {Campo:"Dias Trabalhados",Valor:daysWorked},
      {Campo:"Total de Pontos",Valor:totalPts},
      {Campo:"Meta",Valor:goal},
      {Campo:"% Atingido",Valor:`${pct}%`},
      {Campo:"Bônus",Valor:formatCurrency(bonus)},
      {Campo:"Extintores",Valor:extintores},
      {Campo:"Média Pts/Dia Trabalhado",Valor:avgPtsDay},
      {Campo:"Média Un/Dia Trabalhado",Valor:avgQtyDay},
      {Campo:"Média Pts/Dia Útil",Valor:avgPtsWorkDay},
    ];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(resumo),"Resumo");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(bySector.map(s=>({Setor:s.name,Quantidade:s.qty,"Pts/Un":s.pointsPerUnit,Pontos:s.pts,Dias:s.days}))),"Por Setor");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(dailyData.map(d=>({Data:formatDate(d.date),Unidades:d.qty,Pontos:d.pts}))),"Diário");
    XLSX.writeFile(wb,`relatorio_${emp.name.replace(/ /g,"_")}_${from}_a_${to}.xlsx`);
  };

  return (
    <div>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><div><span className="card-title">{emp.name}</span><div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>{bySector.map(s=>s.name).join(", ")} • {formatDate(from)} a {formatDate(to)}</div></div><button className="btn btn-secondary btn-sm" onClick={exportExcel}>Exportar Excel</button></div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Pontos</div><div className="stat-value accent" style={{fontSize:24}}>{totalPts}</div><div className="stat-sub">de {goal}</div></div>
        <div className="stat-card green"><div className="stat-label">Extintores</div><div className="stat-value" style={{fontSize:24}}>{extintores}</div><div className="stat-sub">{worksFinal?"finalizados":"trabalhados"}</div></div>
        <div className="stat-card blue"><div className="stat-label">Bônus</div><div className="stat-value" style={{fontSize:20}}>{formatCurrency(bonus)}</div><div className="stat-sub">{metGoal?"✓ Meta atingida":"Abaixo da meta"}</div></div>
        <div className="stat-card purple"><div className="stat-label">% da Meta</div><div className="stat-value" style={{color:pc,fontSize:24}}>{pct}%</div><div className="stat-sub">{daysWorked}/{periodWorkingDays} dias úteis</div></div>
      </div>

      {/* Médias */}
      <div className="grid-3" style={{marginBottom:20}}>
        <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Setor Top</div><div style={{fontSize:16,fontWeight:700}}>{topSector?.name||"—"}</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{topSector?topSector.pts+" pts • "+topSector.qty+" un":""}</div></div>
        <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Média/Dia Trabalhado</div><div style={{fontSize:16,fontWeight:700}} className="mono">{avgPtsDay} pts</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{avgQtyDay} un por dia</div></div>
        <div className="card" style={{padding:14}}><div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Média/Dia Útil</div><div style={{fontSize:16,fontWeight:700}} className="mono">{avgPtsWorkDay} pts</div><div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{periodWorkingDays} dias úteis no período</div></div>
      </div>

      {bestDay && <div className="card" style={{marginBottom:20,padding:14,background:"linear-gradient(135deg,var(--accent-glow),transparent)"}}>
        <div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Melhor Dia do Período</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:18,fontWeight:700}}>{bestDay.label}</div>
          <div style={{display:"flex",gap:20}}><div className="mono accent" style={{fontSize:18,fontWeight:700}}>{bestDay.pts} pts</div><div className="mono" style={{fontSize:18,fontWeight:700}}>{bestDay.qty} un</div></div>
        </div>
      </div>}

      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><span className="card-title">Pontos por Dia</span></div>
        {dailyData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/><XAxis dataKey="label" tick={{fill:"#8B8FA3",fontSize:11}}/><YAxis tick={{fill:"#8B8FA3",fontSize:11}}/><Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/><Bar dataKey="pts" name="Pontos" fill="#E8651A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<EmptyState text="Sem produção"/>}
      </div>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><span className="card-title">Unidades por Dia</span></div>
        {dailyData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3F"/><XAxis dataKey="label" tick={{fill:"#8B8FA3",fontSize:11}}/><YAxis tick={{fill:"#8B8FA3",fontSize:11}}/><Tooltip contentStyle={{background:"#1C1F2E",border:"1px solid #2A2E3F",borderRadius:8}}/><Bar dataKey="qty" name="Unidades" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<EmptyState text="Sem produção"/>}
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><span className="card-title">Produção por Setor</span></div>
        <div className="table-wrapper"><table>
          <thead><tr><th>Setor</th><th>Unidades</th><th>Pts/Un</th><th>Pontos</th><th>Dias Atuados</th><th>% do Total</th></tr></thead>
          <tbody>
            {bySector.length===0?<tr><td colSpan={6} style={{textAlign:"center",color:"var(--text-muted)",padding:20}}>Sem produção</td></tr>
            :bySector.map(s=><tr key={s.id}>
              <td style={{fontWeight:600}}>{s.name}{s.isFinal?<span className="badge green" style={{marginLeft:8,fontSize:10}}>★ Final</span>:""}</td>
              <td className="mono">{s.qty}</td>
              <td className="mono">{s.pointsPerUnit}</td>
              <td className="mono accent">{s.pts}</td>
              <td className="mono">{s.days}</td>
              <td className="mono">{totalPts>0?Math.round((s.pts/totalPts)*100):0}%</td>
            </tr>)}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

// ── MEU HISTÓRICO DE PRODUÇÃO (colaborador) ──
function MyProductionPage({ currentUser, sectors, production }) {
  const mk = getMonthKey();
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const now = new Date();
  const defaultFrom = dateToStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const [filterFrom,setFilterFrom] = useState(defaultFrom);
  const [filterTo,setFilterTo] = useState(getToday());
  const setQuick = (type) => {
    const t = new Date();
    if(type==="mes"){setFilterFrom(dateToStr(new Date(t.getFullYear(),t.getMonth(),1)));setFilterTo(getToday());}
    else if(type==="anterior"){const pm=new Date(t.getFullYear(),t.getMonth()-1,1);setFilterFrom(dateToStr(pm));setFilterTo(dateToStr(new Date(t.getFullYear(),t.getMonth(),0)));}
    else if(type==="7dias"){const wa=new Date();wa.setDate(t.getDate()-6);setFilterFrom(dateToStr(wa));setFilterTo(getToday());}
    else if(type==="hoje"){setFilterFrom(getToday());setFilterTo(getToday());}
  };
  const myProd = useMemo(()=>production
    .filter(p=>p.userId===currentUser.id && p.date>=filterFrom && p.date<=filterTo)
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||"").localeCompare(a.createdAt||""))
  ,[production,currentUser.id,filterFrom,filterTo]);
  const totalQty = myProd.reduce((s,p)=>s+p.quantity,0);
  const totalPts = myProd.reduce((s,p)=>{const sec=sectors.find(x=>x.id===p.sectorId);return s+p.quantity*(sec?.pointsPerUnit||0);},0);
  const daysWorked = new Set(myProd.map(p=>p.date)).size;
  return (
    <div>
      <div className="card" style={{marginBottom:16,padding:"12px 16px"}}>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:13,marginRight:8}}>Período:</span>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("hoje")}>Hoje</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("7dias")}>7 dias</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("mes")}>Este mês</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setQuick("anterior")}>Mês anterior</button>
          <input className="form-input" type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} style={{width:140,padding:"4px 8px",fontSize:12}}/>
          <span style={{color:"var(--text-muted)"}}>até</span>
          <input className="form-input" type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} style={{width:140,padding:"4px 8px",fontSize:12}}/>
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <span className="badge blue">{myProd.length} lançamentos</span>
          <span className="badge green">{totalQty} unidades</span>
          <span className="badge yellow">{totalPts} pontos</span>
          <span className="badge purple">{daysWorked} dias trabalhados</span>
        </div>
      </div>
      <div className="card"><div className="card-header"><span className="card-title">Meus Lançamentos</span></div>
        <div className="table-wrapper"><table><thead><tr><th>Data</th><th>Setor</th><th>Quantidade</th><th>Pontos</th></tr></thead><tbody>
          {myProd.length===0?<tr><td colSpan={4} style={{textAlign:"center",color:"var(--text-muted)",padding:30}}>Nenhum lançamento no período</td></tr>
          :myProd.map(p=>{const sec=sectors.find(x=>x.id===p.sectorId);return(
            <tr key={p.id}><td className="mono" style={{fontSize:12}}>{formatDate(p.date)}</td><td>{sec?.name||"—"}</td><td className="mono">{p.quantity}</td><td className="mono accent">{p.quantity*(sec?.pointsPerUnit||0)}</td></tr>);})}
        </tbody></table></div></div>
    </div>
  );
}

function LogsPage({ logs }) {
  return (<div className="card"><div className="card-header"><span className="card-title">Registro de Atividades</span><span className="badge blue">{logs.length}</span></div>
    <div className="table-wrapper"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>
      {logs.length===0?<tr><td colSpan={4}><EmptyState text="Nenhum log"/></td></tr>
      :logs.slice(0,100).map(l=><tr key={l.id}><td className="mono" style={{fontSize:12,color:"var(--text-muted)"}}>{new Date(l.timestamp).toLocaleString("pt-BR")}</td><td style={{fontWeight:500}}>{l.userName||"—"}</td><td><span className="badge blue">{l.action}</span></td><td style={{fontSize:13,color:"var(--text-secondary)",maxWidth:300,overflow:"hidden",textOverflow:"ellipsis"}}>{l.details}</td></tr>)}</tbody></table></div></div>);
}

function Modal({ title, onClose, children, wide }) {
  return (<div className="modal-overlay" onClick={onClose}><div className={`modal fade-in ${wide?"modal-wide":""}`} onClick={e=>e.stopPropagation()}><div className="modal-header"><span className="modal-title">{title}</span><button className="modal-close" onClick={onClose}>{Icons.close}</button></div>{children}</div></div>);
}
function EmptyState({ text }) { return <div style={{padding:40,textAlign:"center",color:"var(--text-muted)"}}>{text}</div>; }

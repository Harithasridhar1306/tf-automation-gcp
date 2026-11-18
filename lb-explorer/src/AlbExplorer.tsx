import { useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2,
  ChevronRight, CircleHelp, Cloud, Code2, Globe2, Layers3, Network, Play,
  RotateCcw, Route, Server, Shield, Sparkles, Terminal, XCircle, Zap
} from 'lucide-react'
import './alb.css'

type Mode = 'global' | 'regional'
type Tab = 'journey' | 'traffic' | 'debug' | 'quiz'
type StepId = 'client' | 'forwarding' | 'proxy' | 'urlmap' | 'backend' | 'neg' | 'endpoint'

const steps: { id: StepId; title: string; eyebrow: string; icon: typeof Cloud; short: string; what: string; why: string; failure: string; check: string }[] = [
  { id:'client', title:'Client & DNS', eyebrow:'01 · REQUEST ORIGIN', icon:Cloud, short:'Browser / API caller', what:'The client resolves the application hostname to the load balancer frontend IP, then opens an HTTP or HTTPS connection to that IP and port.', why:'DNS gets the client to the frontend VIP. DNS is not a forwarding rule and does not choose a backend.', failure:'The hostname resolves to an old IP, the wrong VIP, or no address.', check:'Compare the DNS A/AAAA record with the frontend IP configured on the forwarding rule.' },
  { id:'forwarding', title:'Forwarding rule', eyebrow:'02 · FRONTEND MATCH', icon:Network, short:'IP address · protocol · port', what:'The forwarding rule matches the destination IP address, IP protocol and port (or port range). It references the target proxy for this Application Load Balancer.', why:'It is the frontend entry point. It does not inspect URL paths and it does not point directly to a NEG or VM.', failure:'Wrong frontend IP, port, protocol, load-balancing scheme, or target proxy.', check:'Inspect the forwarding rule and verify its IP, ports, protocol, scheme and target proxy.' },
  { id:'proxy', title:'Target HTTPS proxy', eyebrow:'03 · PROXY & TLS', icon:Shield, short:'TLS termination · URL map reference', what:'The target HTTPS proxy handles the client-side TLS connection and references the URL map. For HTTP, the corresponding target HTTP proxy is used.', why:'This is where HTTPS certificates and TLS policy are associated. Backend-side encryption is a separate connection and configuration.', failure:'Certificate missing/expired, hostname mismatch, wrong proxy target, or TLS negotiation failure.', check:'Inspect the target HTTPS proxy, attached certificate or certificate map, TLS policy and URL map reference.' },
  { id:'urlmap', title:'URL map', eyebrow:'04 · LAYER 7 ROUTING', icon:Route, short:'Host · path · header · route rules', what:'The URL map evaluates the HTTP request attributes, such as host and path, and selects a backend service (or backend bucket where supported).', why:'This is the Layer 7 decision point. For example, /api/* can route to an API backend while /web/* routes to a web backend.', failure:'A host rule, path matcher, route rule or default service sends the request somewhere unexpected.', check:'Inspect hostRules, pathMatchers, routeRules, priorities and the defaultService. Test the Host header and exact path.' },
  { id:'backend', title:'Backend service', eyebrow:'05 · BACKEND POLICY', icon:Layers3, short:'Protocol · health · balancing policy', what:'The backend service connects the URL map to backend groups and defines backend protocol, timeout, health-check association, balancing mode and traffic policies.', why:'It determines which eligible backend group serves the request and how traffic is distributed. Health checks are associated here; they are not a request-path hop.', failure:'No healthy backends, wrong serving port, incorrect protocol, or incompatible backend configuration.', check:'Review backend membership, health status, protocol, named/serving port, balancing mode and timeout.' },
  { id:'neg', title:'Network Endpoint Group', eyebrow:'06 · ENDPOINT DISCOVERY', icon:Network, short:'Group of reachable endpoints', what:'A NEG represents one or more network endpoints. The backend service references the NEG, and the load balancer uses its endpoints as backend destinations.', why:'A NEG is the endpoint abstraction. Depending on NEG type, endpoints can represent VM IP:port pairs, GKE pod endpoints, serverless services, and more.', failure:'NEG has no endpoints, stale endpoints, wrong port, or endpoints are not reachable.', check:'Inspect NEG type, zone, endpoint list, port and backend-service attachment.' },
  { id:'endpoint', title:'Backend workload', eyebrow:'07 · APPLICATION', icon:Server, short:'VM · GKE pod · supported endpoint', what:'The selected endpoint receives the backend-side request on its serving port, processes it and returns a response through the load-balancing proxy.', why:'This is where the application actually runs. A healthy network path does not guarantee that the application returns a successful response.', failure:'Process is down, listener is on another port, app returns 5xx, or response exceeds the timeout.', check:'Check the application listener, logs, readiness, response code and backend-side connectivity.' }
]

const scenarios = [
  { id:'firewall', title:'Backend firewall blocks proxy traffic', symptom:'The frontend is reachable, but requests fail to reach a regional external ALB backend.', point:'Backend connection', diagnosis:'For a regional external ALB, Envoy establishes a separate backend connection using a source IP from the proxy-only subnet. The backend does not see the LB frontend VIP as the TCP source of that proxied connection.', fix:'Allow the proxy-only subnet CIDR to reach the backend serving port. Also allow the documented health-check probe ranges to reach the health-check port.' },
  { id:'health', title:'All backends are unhealthy', symptom:'The backend service reports UNHEALTHY and clients receive errors such as 502/503.', point:'Health-check path', diagnosis:'Health checks are separate probes associated with the backend service. A probe can fail even when the application works from your laptop or from another VM.', fix:'Verify health-check protocol, port, path, expected response, application listener and firewall access for the documented probe source ranges.' },
  { id:'route', title:'Request reaches the wrong backend', symptom:'The LB responds, but /api or a particular hostname reaches the web service instead.', point:'URL map', diagnosis:'The host rule, path matcher, route-rule priority or default service is selecting a different backend service than expected.', fix:'Inspect the request Host header and path, then trace hostRules → pathMatchers / routeRules → selected backend service.' },
  { id:'tls', title:'HTTPS certificate error', symptom:'The browser reports a certificate warning or TLS handshake failure before the application responds.', point:'Target HTTPS proxy', diagnosis:'Client-side TLS is negotiated with the target HTTPS proxy. The request may never reach the URL map or backend if this handshake fails.', fix:'Check DNS, SNI/hostname coverage, certificate attachment and status, certificate map, and SSL policy.' },
  { id:'backend', title:'Application is slow or returns 5xx', symptom:'The backend is healthy, but users see intermittent 500/502/504 responses.', point:'Backend workload', diagnosis:'The network path may be working while the application is overloaded, resetting connections, returning errors or exceeding the backend service timeout.', fix:'Correlate request logs with application logs, inspect CPU/concurrency, listener port, response codes and backend service timeout.' }
]

const quiz = [
  { q:'What does the forwarding rule reference in a proxy-based Application Load Balancer?', options:['A NEG directly','A target proxy','A health check','A backend VM'], answer:1, why:'The forwarding rule matches the frontend IP, protocol and port, then directs traffic to the configured target proxy. The URL map and backend service select the backend.' },
  { q:'Which component makes host- and path-based routing decisions?', options:['Forwarding rule','NEG','URL map','Health check'], answer:2, why:'The URL map evaluates request attributes such as host and path and selects a backend service.' },
  { q:'For a regional external ALB, what source range should the backend firewall allow for proxy-to-backend traffic?', options:['Only the frontend VIP','The client public IP','The proxy-only subnet CIDR','The DNS resolver IP'], answer:2, why:'Regional external ALB Envoy proxies use addresses from the proxy-only subnet when opening backend connections. Health-check probe ranges are a separate firewall requirement.' },
  { q:'Is a health check another hop in the user request path?', options:['Yes, before the URL map','Yes, between NEG and VM','No, it is a separate probe','Only for HTTPS'], answer:2, why:'Health checks run separately. Their results influence backend eligibility, but a user request does not travel through the health-check resource.' }
]

const apiBackends = ['api-01 · zone-a','api-02 · zone-b','api-03 · zone-c']
const webBackends = ['web-01 · zone-a','web-02 · zone-b']
type RequestLog = { id:number; path:string; backend:string; status:string; mode:Mode; time:string }

function App() {
  const [mode,setMode] = useState<Mode>('regional')
  const [tab,setTab] = useState<Tab>('journey')
  const [active,setActive] = useState<StepId>('forwarding')
  const [path,setPath] = useState('/api/orders')
  const [host,setHost] = useState('shop.example.com')
  const [policy,setPolicy] = useState('ROUND_ROBIN')
  const [affinity,setAffinity] = useState('NONE')
  const [cookieTtl,setCookieTtl] = useState(3600)
  const [logs,setLogs] = useState<RequestLog[]>([])
  const [counter,setCounter] = useState(0)
  const [apiCursor,setApiCursor] = useState(0)
  const [webCursor,setWebCursor] = useState(0)
  const [failed,setFailed] = useState<string[]>([])
  const [scenario,setScenario] = useState('firewall')
  const [showDiagnosis,setShowDiagnosis] = useState(false)
  const [quizAnswers,setQuizAnswers] = useState<Record<number,number>>({})
  const [quizSubmitted,setQuizSubmitted] = useState(false)
  const [journeyIndex,setJourneyIndex] = useState(0)

  const selected = steps.find(s=>s.id===active) ?? steps[1]
  const selectedScenario = scenarios.find(s=>s.id===scenario) ?? scenarios[0]
  const apiHealthy = apiBackends.filter(b=>!failed.includes(b))
  const webHealthy = webBackends.filter(b=>!failed.includes(b))
  const routedPool = path.startsWith('/api') ? apiHealthy : webHealthy
  const currentPool = routedPool.length ? routedPool : (path.startsWith('/api') ? apiBackends : webBackends)
  const activeStepIndex = steps.findIndex(s=>s.id===active)
  const quizScore = quiz.reduce((n,q,i)=>n+(quizAnswers[i]===q.answer?1:0),0)

  const routeInfo = useMemo(()=> path.startsWith('/api')
    ? {service:'api-backend-service',neg:'api-neg',pool:apiBackends}
    : {service:'web-backend-service',neg:'web-neg',pool:webBackends},[path])

  function sendRequest() {
    const n = counter + 1
    const pool = path.startsWith('/api') ? apiBackends.filter(b=>!failed.includes(b)) : webBackends.filter(b=>!failed.includes(b))
    const usable = pool.length ? pool : (path.startsWith('/api') ? apiBackends : webBackends)
    const cursor = path.startsWith('/api') ? apiCursor : webCursor
    const backend = policy === 'ROUND_ROBIN' ? usable[cursor % usable.length] : usable[(host.length + path.length + (affinity==='NONE'?n:host.length)) % usable.length]
    if(path.startsWith('/api')) setApiCursor(apiCursor+1); else setWebCursor(webCursor+1)
    setCounter(n)
    const status = pool.length ? '200 OK' : '503 · no healthy endpoints'
    const entry:RequestLog = {id:n,path,backend:pool.length?backend:'No eligible backend',status,mode,time:new Date().toLocaleTimeString()}
    setLogs(prev=>[entry,...prev].slice(0,8))
    setActive('endpoint')
  }

  function toggleBackend(name:string) {
    setFailed(prev=>prev.includes(name)?prev.filter(x=>x!==name):[...prev,name])
  }

  function resetLab() {
    setFailed([]); setLogs([]); setCounter(0); setApiCursor(0); setWebCursor(0)
  }

  return <div className="alb-app">
    <header className="alb-header">
      <a className="alb-brand" href="./index.html"><span className="alb-brand-icon"><Network size={19}/></span><span>cloudlab <small>APPLICATION LOAD BALANCER SCHOOL</small></span></a>
      <div className="alb-header-right"><span className="alb-live"><i/> SIMULATED ENVIRONMENT</span><a href="https://github.com/Harithasridhar1306/tf-automation-gcp" target="_blank" rel="noreferrer">SOURCE <Code2 size={13}/></a></div>
    </header>
    <main className="alb-main">
      <section className="alb-hero">
        <div className="alb-kicker"><Sparkles size={13}/> LEARN THE REQUEST. UNDERSTAND THE PROXY. DEBUG THE PATH.</div>
        <h1>Application Load Balancer <em>Explorer</em></h1>
        <p>A hands-on visual guide to Google Cloud Application Load Balancers. Trace the request, inspect every resource, simulate traffic, and troubleshoot the failures that actually happen in cloud networking.</p>
        <div className="alb-hero-meta"><span><Activity size={13}/> 7 request stages</span><span><Zap size={13}/> Interactive labs</span><span><BookOpen size={13}/> Knowledge checks</span><span><Shield size={13}/> No cloud credentials needed</span></div>
      </section>

      <section className="alb-mode-switch">
        <div><b>Choose the proxy architecture</b><small>The request lifecycle is similar, but the proxy fleet and backend firewall source differ.</small></div>
        <div className="alb-mode-options">
          <button className={mode==='global'?'active':''} onClick={()=>setMode('global')}><Globe2 size={15}/> Global external <small>GFE fleet</small></button>
          <button className={mode==='regional'?'active':''} onClick={()=>setMode('regional')}><Route size={15}/> Regional external <small>Envoy + proxy-only subnet</small></button>
        </div>
      </section>

      <nav className="alb-tabs">
        <button className={tab==='journey'?'active':''} onClick={()=>setTab('journey')}><Network size={15}/> Guided journey</button>
        <button className={tab==='traffic'?'active':''} onClick={()=>setTab('traffic')}><Activity size={15}/> Traffic lab</button>
        <button className={tab==='debug'?'active':''} onClick={()=>setTab('debug')}><Shield size={15}/> Break & debug</button>
        <button className={tab==='quiz'?'active':''} onClick={()=>setTab('quiz')}><BookOpen size={15}/> Knowledge check</button>
      </nav>

      {tab==='journey' && <section className="alb-section">
        <div className="alb-section-head"><div><div className="alb-eyebrow">01 / REQUEST LIFECYCLE</div><h2>Follow one request, hop by hop</h2><p>Select any component to see what it does, why it exists and what to inspect when it breaks.</p></div><span className="alb-chip"><i/> {mode==='regional'?'REGIONAL · ENVOY':'GLOBAL · GFE'}</span></div>
        <div className="alb-journey-grid">
          <div className="alb-flow-card">
            <div className="alb-card-top"><span>REQUEST PATH</span><span>HTTPS · TCP 443</span></div>
            <div className="alb-flow">
              {steps.map((s,i)=>{const Icon=s.icon;return <div className="alb-flow-item" key={s.id}>
                <button className={'alb-node '+(active===s.id?'selected':'')} onClick={()=>setActive(s.id)}>
                  <span className="alb-node-icon"><Icon size={18}/></span><span><b>{s.title}</b><small>{s.short}</small></span><ChevronRight size={15}/>
                </button>
                {i<steps.length-1 && <div className="alb-flow-connector"><span/><ArrowDown size={13}/><span/></div>}
              </div>})}
            </div>
            <div className="alb-side-lanes">
              <div className="alb-side-lane health-lane"><span className="lane-icon"><Activity size={15}/></span><span><b>Health checks run separately</b><small>Backend service → probe → backend endpoint. Not a user-request hop.</small></span><span className="lane-tag">SIDE CHANNEL</span></div>
              {mode==='regional' && <div className="alb-side-lane proxy-lane"><span className="lane-icon"><Network size={15}/></span><span><b>Proxy-only subnet</b><small>Provides source IPs for Envoy → backend connections. Not a router or a packet hop.</small></span><span className="lane-tag">BACKEND SOURCE</span></div>}
            </div>
          </div>
          <aside className="alb-inspector">
            <div className="alb-inspector-top">{selected.eyebrow}<span>STEP {String(activeStepIndex+1).padStart(2,'0')} / 07</span></div>
            <div className="alb-inspector-icon">{(()=>{const I=selected.icon;return <I size={22}/>})()}</div>
            <h3>{selected.title}</h3><p className="alb-inspector-sub">{selected.short}</p>
            <div className="alb-detail"><label>WHAT HAPPENS</label><p>{selected.what}</p></div>
            <div className="alb-detail"><label>WHY IT EXISTS</label><p>{selected.why}</p></div>
            <div className="alb-detail alb-warning"><label><XCircle size={13}/> COMMON FAILURE</label><p>{selected.failure}</p></div>
            <div className="alb-detail alb-check"><label><CheckCircle2 size={13}/> FIRST CHECK</label><p>{selected.check}</p></div>
            <div className="alb-inspector-actions"><button onClick={()=>setActive(steps[(activeStepIndex+steps.length-1)%steps.length].id)}><ArrowLeft size={14}/> Previous</button><button onClick={()=>setActive(steps[(activeStepIndex+1)%steps.length].id)}>Next <ArrowRight size={14}/></button></div>
          </aside>
        </div>
        <div className="alb-architecture-note"><CircleHelp size={17}/><p><b>Remember the two connections:</b> the client connects to the frontend VIP and the proxy handles that connection. The proxy then opens a separate backend connection. For a regional external ALB, that backend connection uses a source IP from the proxy-only subnet. The frontend VIP is not the backend connection's source IP.</p></div>
      </section>}

      {tab==='traffic' && <section className="alb-section">
        <div className="alb-section-head"><div><div className="alb-eyebrow">02 / REQUEST SIMULATOR</div><h2>Send traffic through the architecture</h2><p>Change the request path, choose a backend policy, and see which endpoint receives the request.</p></div><span className="alb-chip">SIMULATION · NO GCP RESOURCES</span></div>
        <div className="alb-traffic-grid">
          <div className="alb-traffic-main">
            <div className="alb-controls">
              <label>HOST<input value={host} onChange={e=>setHost(e.target.value)} /></label>
              <label>REQUEST PATH<select value={path} onChange={e=>setPath(e.target.value)}><option value="/api/orders">/api/orders</option><option value="/api/products">/api/products</option><option value="/web/home">/web/home</option><option value="/web/pricing">/web/pricing</option></select></label>
              <label>BACKEND POLICY<select value={policy} onChange={e=>setPolicy(e.target.value)}><option value="ROUND_ROBIN">ROUND_ROBIN · sequential</option><option value="CONSISTENT_HASH">CONSISTENT_HASH · hash key</option></select></label>
              <label>SESSION AFFINITY<select value={affinity} onChange={e=>setAffinity(e.target.value)}><option value="NONE">None</option><option value="GENERATED_COOKIE">Generated cookie</option><option value="CLIENT_IP">Client IP</option></select></label>
            </div>
            {affinity==='GENERATED_COOKIE' && <div className="alb-cookie-control"><div><b>Generated cookie TTL</b><small>{cookieTtl===0?'Session cookie':cookieTtl+' seconds'} · simplified illustration</small></div><input type="range" min="0" max="604800" step="300" value={cookieTtl} onChange={e=>setCookieTtl(Number(e.target.value))}/><code>{mode==='global'?'GCLB':'GCILB'}=demo-session; Path=/{cookieTtl?'; Max-Age='+cookieTtl:''}</code></div>}
            <div className="alb-send-row"><button className="alb-primary" onClick={sendRequest}><Play size={15} fill="currentColor"/> Send request</button><button className="alb-secondary" onClick={()=>{for(let i=0;i<5;i++) sendRequest()}}>Send 5 requests</button><button className="alb-ghost" onClick={resetLab}><RotateCcw size={14}/> Reset lab</button></div>
            <div className="alb-packet-track">
              <div className="alb-packet-track-head"><b>LIVE REQUEST TRACE</b><span>REQUEST #{String(counter).padStart(3,'0')}</span></div>
              <div className="alb-track-nodes">
                {['Client','Forwarding rule',mode==='global'?'GFE proxy':'Envoy proxy','URL map','Backend service','NEG','Endpoint'].map((n,i)=><div className="alb-track-node" key={n}><span>{i+1}</span><b>{n}</b>{i!==6&&<ArrowRight size={13}/>}</div>)}
              </div>
              <div className="alb-track-caption"><span><i/> Client-side connection</span><span><i/> Proxy-to-backend connection</span></div>
            </div>
            <div className="alb-request-log"><div className="alb-log-head"><b>REQUEST LOG</b><span>{logs.length} recent · {counter} total</span></div>{logs.length===0?<div className="alb-empty">No requests yet. Send a request to start the trace.</div>:logs.map(log=><div className="alb-log-row" key={log.id}><span>#{String(log.id).padStart(3,'0')}</span><b>{log.path}</b><span>{log.backend}</span><strong className={log.status.startsWith('200')?'ok':'bad'}>{log.status}</strong></div>)}</div>
          </div>
          <aside className="alb-backend-panel">
            <div className="alb-panel-title"><Server size={16}/> BACKEND POOL</div>
            <p className="alb-muted">Toggle endpoints to simulate backend failure. Requests will only select healthy endpoints.</p>
            <div className="alb-pool-group"><b>API NEG · {apiHealthy.length}/{apiBackends.length} healthy</b>{apiBackends.map(b=><button key={b} className={'alb-backend-row '+(failed.includes(b)?'down':'')} onClick={()=>toggleBackend(b)}><i/><span>{b}</span><small>{failed.includes(b)?'DOWN':'HEALTHY'}</small></button>)}</div>
            <div className="alb-pool-group"><b>WEB NEG · {webHealthy.length}/{webBackends.length} healthy</b>{webBackends.map(b=><button key={b} className={'alb-backend-row '+(failed.includes(b)?'down':'')} onClick={()=>toggleBackend(b)}><i/><span>{b}</span><small>{failed.includes(b)?'DOWN':'HEALTHY'}</small></button>)}</div>
            <div className="alb-policy-note"><Zap size={15}/><p><b>{policy}</b><br/>{policy==='ROUND_ROBIN'?'Cycles through eligible endpoints in this simplified demo.':'Uses a repeatable hash of the request inputs in this simplified demo.'} Real backend selection also depends on locality, balancing mode, health, capacity and product support.</p></div>
            <div className="alb-route-result"><label>URL MAP DECISION</label><b>{routeInfo.service}</b><small>{routeInfo.neg} · {routeInfo.pool.length} configured endpoints</small></div>
          </aside>
        </div>
      </section>}

      {tab==='debug' && <section className="alb-section">
        <div className="alb-section-head"><div><div className="alb-eyebrow">03 / INCIDENT WORKBENCH</div><h2>Break it. Find the fault. Fix it.</h2><p>Pick an incident, inspect the symptoms and reveal a structured troubleshooting path.</p></div><span className="alb-chip">5 SCENARIOS</span></div>
        <div className="alb-debug-grid">
          <div className="alb-scenario-list">{scenarios.map(s=><button key={s.id} className={scenario===s.id?'active':''} onClick={()=>{setScenario(s.id);setShowDiagnosis(false)}}><span>0{scenarios.indexOf(s)+1}</span><b>{s.title}</b><ChevronRight size={15}/></button>)}</div>
          <div className="alb-incident">
            <div className="alb-incident-kicker"><span className="incident-pulse"/> SIMULATED INCIDENT · {selectedScenario.point.toUpperCase()}</div>
            <h3>{selectedScenario.title}</h3>
            <div className="alb-symptom"><label>OBSERVED SYMPTOM</label><p>{selectedScenario.symptom}</p></div>
            <div className="alb-fault-line"><span>CLIENT</span><i/><span>FRONTEND</span><i/><span>PROXY</span><i/><span>URL MAP</span><i/><span>BACKEND</span></div>
            <div className="alb-incident-hint"><CircleHelp size={16}/><p>Before revealing the answer, identify which connection or resource is most likely responsible. Is it the frontend, proxy, routing layer, backend path or separate health-check path?</p></div>
            <button className="alb-primary" onClick={()=>setShowDiagnosis(!showDiagnosis)}>{showDiagnosis?'Hide troubleshooting notes':'Reveal diagnosis & fix'} <ArrowRight size={14}/></button>
            {showDiagnosis && <div className="alb-diagnosis"><div><label>WHY IT HAPPENS</label><p>{selectedScenario.diagnosis}</p></div><div><label>WHAT TO CHECK / FIX</label><p>{selectedScenario.fix}</p></div></div>}
          </div>
        </div>
      </section>}

      {tab==='quiz' && <section className="alb-section">
        <div className="alb-section-head"><div><div className="alb-eyebrow">04 / KNOWLEDGE CHECK</div><h2>Can you trace the architecture?</h2><p>Four questions based on the concepts in this lab. Choose an answer, submit and review the explanations.</p></div><span className="alb-chip">{quizScore} / {quiz.length} CORRECT</span></div>
        <div className="alb-quiz-list">{quiz.map((q,i)=><div className="alb-question" key={q.q}><div className="alb-question-kicker">QUESTION 0{i+1}</div><h3>{q.q}</h3><div className="alb-options">{q.options.map((o,j)=><button key={o} disabled={quizSubmitted} className={(quizSubmitted&&j===q.answer?'correct ':'')+(quizAnswers[i]===j?'chosen':'')} onClick={()=>setQuizAnswers(prev=>({...prev,[i]:j}))}><span>{String.fromCharCode(65+j)}</span>{o}{quizSubmitted&&j===q.answer&&<Check size={15}/>}</button>)}</div>{quizSubmitted&&<div className="alb-why"><CheckCircle2 size={15}/><p>{q.why}</p></div>}</div>)}</div>
        <div className="alb-quiz-actions"><button className="alb-primary" onClick={()=>setQuizSubmitted(true)} disabled={Object.keys(quizAnswers).length!==quiz.length}>Submit answers</button><button className="alb-secondary" onClick={()=>{setQuizAnswers({});setQuizSubmitted(false)}}>Try again</button>{quizSubmitted&&<b className="alb-score">Your score: {quizScore}/{quiz.length}</b>}</div>
      </section>}

      <footer className="alb-footer"><span>GCP ALB EXPLORER · LEARN THE RESOURCE CHAIN, NOT JUST THE ACRONYMS.</span><span>CONCEPTUAL SIMULATOR · NOT CONNECTED TO A LIVE GCP PROJECT</span></footer>
    </main>
  </div>
}

export default App

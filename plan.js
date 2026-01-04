// Render a plan detail view based on ?id=<planId>
document.addEventListener('DOMContentLoaded', function(){
  function qs(name){ return new URLSearchParams(location.search).get(name); }
  const id = Number(qs('id')) || null;
  const main = document.getElementById('mainContent');
  if(!main){ return; }

  const plans = (window.getPlans || function(){ return JSON.parse(localStorage.getItem('jobPlans')||'[]')})();
  const plan = plans.find(p=>Number(p.id)===id);
  if(!plan){
    main.innerHTML = `<div class="card">Plan not found. <a href="index.html">Back to dashboard</a></div>`;
    return;
  }

  // migrate older project data stored in plan.applications into plan.projects (if they look like projects)
  if(Array.isArray(plan.applications) && plan.applications.length>0){
    const first = plan.applications[0];
    if(first && (first.github !== undefined || first.live !== undefined || first.description !== undefined)){
      // treat existing entries as projects
      plan.projects = plan.projects || [];
      plan.projects = plan.projects.concat(plan.applications);
      plan.applications = plan.applications = plan.applications.filter(a=>false); // clear old applications
      savePlanChanges();
    }
  }
  plan.projects = plan.projects || [];
  plan.applications = plan.applications || [];
  plan.worklog = plan.worklog || [];

  // helper to format date
  function fmtDate(d){ if(!d) return ''; try{ const dt=new Date(d); return dt.toLocaleDateString(); }catch(e){return d} }

  // calculate progress from steps checked stored in plan._checked (map of stepIndex->bool and substep states)
  function computeProgress(pl){
    let total=0, done=0;
    (pl.steps||[]).forEach((s,si)=>{
      if(s.text) { total+=1; if(pl._checked && pl._checked[`s_${si}`]) done+=1; }
      (s.subs||[]).forEach((ss,ssi)=>{ total+=1; if(pl._checked && pl._checked[`s_${si}_ss_${ssi}`]) done+=1; });
    });
    return total? Math.round((done/total)*100):0;
  }

  function savePlanChanges(){
    const all = window.getPlans();
    const idx = all.findIndex(x=>x.id===plan.id);
    if(idx>=0){ all[idx]=plan; window.savePlans(all); window.updateCounts(); window.renderActivePlans(); }
  }

  // build HTML (header with icons and tabs)
  const timelineIcon = '<svg class="meta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="#eef2ff"/><path d="M12 6a1 1 0 011 1v4h3a1 1 0 110 2h-4a1 1 0 01-1-1V7a1 1 0 011-1z" fill="#6b46ff"/></svg>';
  const calendarIcon = '<svg class="meta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" fill="#fff" stroke="#e6edf7"/><path d="M16 3v4M8 3v4" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/></svg>';

  main.innerHTML = `
    <div style="margin-bottom:18px"><a class="back-link" href="index.html">← Back to Dashboard</a></div>
  <div class="card plan-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <div class="title-row">
            <h2 style="margin:0">${escapeHtml(plan.role)}</h2>
            <span class="badge ${plan.completed? 'completed':''}">${plan.completed? 'Completed':'Active'}</span>
          </div>
          <div class="company" style="color:#6b7280;margin-top:4px">${escapeHtml(plan.company)}</div>
          <div class="meta" style="margin-top:10px">
            <div class="meta-item">${timelineIcon}<span>Timeline: ${escapeHtml(plan.timeline||'')}</span></div>
            <div class="meta-item">${calendarIcon}<span>Start: ${fmtDate(plan.startDate)}</span></div>
            <div class="meta-item">${calendarIcon}<span>Target: ${fmtDate(plan.targetDate)}</span></div>
          </div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="progress-row">
          <div class="progress-label">Overall Progress</div>
          <div class="progress-percent" id="progressPercent">0%</div>
        </div>
        <div class="progress" style="margin-top:8px"><div id="progressBar" class="fill" style="width:0%"></div></div>
      </div>
      <div class="actions">
        <button id="markCompleteBtn" class="btn mark-complete"><span class="btn-icon">✔</span><span class="btn-label">${plan.completed? 'Mark Active':'Mark Complete'}</span></button>
        <button id="deleteBtn" class="btn delete"><span class="btn-icon">🗑</span><span class="btn-label">Delete</span></button>
      </div>
    </div>

    <div style="margin-top:18px">
      <div class="tabs">
        <button class="tab active" data-tab="roadmap">Roadmap</button>
        <button class="tab" data-tab="workflow">Workflow</button>
        <button class="tab" data-tab="applications">Applications</button>
      </div>
      <div id="tabContent" class="card" style="margin-top:12px">
        <!-- tab content injected here -->
      </div>
    </div>
  `;

  // render steps (for roadmap tab)
  let roadmapList = null;
  function renderRoadmap(){
    const tabContent = document.getElementById('tabContent');
    tabContent.innerHTML = `<h4>Learning Roadmap</h4><div id="roadmapList"></div>`;
    roadmapList = document.getElementById('roadmapList');
    roadmapList.innerHTML = '';
    (plan.steps||[]).forEach((s,si)=>{
      const row = document.createElement('div');
      row.className = 'roadmap-row';

      // left: chevron, checkbox, label
      const left = document.createElement('div'); left.className = 'roadmap-left';
      const exp = document.createElement('button'); exp.className = 'chev-btn'; exp.setAttribute('aria-label','Toggle step'); exp.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l6-6-6-6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.className='step-checkbox'; chk.checked = !!(plan._checked && plan._checked[`s_${si}`]);
      chk.addEventListener('change', function(){ plan._checked = plan._checked||{}; plan._checked[`s_${si}`] = chk.checked; savePlanChanges(); updateProgress(); });
      const text = document.createElement('div'); text.className='step-label'; text.textContent = s.text || '';
      left.appendChild(exp); left.appendChild(chk); left.appendChild(text);

      // right: projects button
      const right = document.createElement('div'); right.className = 'roadmap-right';
      const proj = document.createElement('button'); proj.className='btn btn-primary projects-btn'; proj.setAttribute('type','button');
      // inline small code icon svg + label
      proj.innerHTML = '<span class="proj-icon">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 18l6-6-6-6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/><path d="M8 6l-6 6 6 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/></svg>' +
        '</span><span class="proj-label">Projects</span>';
      right.appendChild(proj);

  // projects panel (hidden by default)
      const projectsPanel = document.createElement('div');
      projectsPanel.className = 'projects-panel';
      projectsPanel.style.display = 'none';
      projectsPanel.style.marginTop = '8px';
      projectsPanel.style.padding = '12px';
      projectsPanel.style.borderRadius = '8px';
      projectsPanel.style.background = '#f8fafc';

      // header inside panel
      const projHeader = document.createElement('div'); projHeader.textContent = `Projects for ${s.text || ''}`; projHeader.style.fontWeight = '600'; projHeader.style.marginBottom = '10px';
      projectsPanel.appendChild(projHeader);

      // list of existing projects for this step
      const projList = document.createElement('div'); projList.className = 'project-list'; projList.style.marginBottom = '10px';
      projectsPanel.appendChild(projList);

      // add project button
      const addProjBtn = document.createElement('button'); addProjBtn.className = 'btn add-project-pill'; addProjBtn.textContent = '+ Add Project'; addProjBtn.style.marginLeft='auto'; addProjBtn.style.display='block';
      projectsPanel.appendChild(addProjBtn);

      // project form (hidden)
      const projForm = document.createElement('div'); projForm.className = 'project-form'; projForm.style.display = 'none'; projForm.style.marginTop = '8px';
      projForm.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <input class="proj-name" placeholder="Project name" />
          <input class="proj-desc" placeholder="Project description" />
          <input class="proj-git" placeholder="GitHub URL (optional)" />
          <input class="proj-live" placeholder="Live URL (optional)" />
          <div style="display:flex;gap:8px">
            <button class="btn proj-add" style="background:#10b981;color:#fff">Add</button>
            <button class="btn proj-cancel" style="background:#e6eefc">Cancel</button>
          </div>
        </div>
      `;
      projectsPanel.appendChild(projForm);

      // function to render project list (project entries stored in plan.projects)
      function renderProjectList(){
        projList.innerHTML = '';
        const apps = (plan.projects||[]).filter(a=>a.stepIndex===si);
        if(apps.length===0){
          const p = document.createElement('div'); p.className='no-projects'; p.textContent = 'No projects yet. Add your first project!'; projList.appendChild(p);
        } else {
          apps.forEach(ap => {
            const card = document.createElement('div'); card.className='project-card'; card.style.padding='10px'; card.style.background='#fff'; card.style.borderRadius='8px'; card.style.marginBottom='8px';
            card.innerHTML = `<div style="font-weight:600">${escapeHtml(ap.name)}</div><div style="font-size:13px;color:#6b7280">${escapeHtml(ap.description||'')}</div>`;
            projList.appendChild(card);
          });
        }
      }

      // wire project button to toggle panel
      proj.addEventListener('click', function(){
        projectsPanel.style.display = projectsPanel.style.display==='none' ? 'block' : 'none';
        renderProjectList();
      });

      // add project pill opens form
      addProjBtn.addEventListener('click', function(){ projForm.style.display='block'; addProjBtn.style.display='none'; });

      // form actions
      projForm.querySelector('.proj-cancel').addEventListener('click', function(){ projForm.style.display='none'; addProjBtn.style.display='block'; });
      projForm.querySelector('.proj-add').addEventListener('click', function(){
        const name = projForm.querySelector('.proj-name').value.trim();
        const desc = projForm.querySelector('.proj-desc').value.trim();
        const git = projForm.querySelector('.proj-git').value.trim();
        const live = projForm.querySelector('.proj-live').value.trim();
        if(!name){ alert('Please enter project name'); return; }
        plan.applications = plan.applications || [];
        plan.applications.push({ id: Date.now(), name, description: desc, github: git, live: live, stepIndex: si, status: 'applied' });
        savePlanChanges();
        renderProjectList();
        projForm.querySelectorAll('input').forEach(i=>i.value='');
        projForm.style.display='none'; addProjBtn.style.display='block';
        if(window.updateCounts) window.updateCounts();
      });

  row.appendChild(left); row.appendChild(right);
  roadmapList.appendChild(row);

      // substeps
      if((s.subs||[]).length){
        const subWrap = document.createElement('div'); subWrap.style.padding='6px 28px 12px 48px';
        s.subs.forEach((ss,ssi)=>{
          const subRow = document.createElement('div'); subRow.style.display='flex'; subRow.style.alignItems='center'; subRow.style.gap='10px'; subRow.style.padding='6px 0';
          const subChk = document.createElement('input'); subChk.type='checkbox'; subChk.checked = !!(plan._checked && plan._checked[`s_${si}_ss_${ssi}`]);
          subChk.addEventListener('change', function(){ plan._checked = plan._checked||{}; plan._checked[`s_${si}_ss_${ssi}`]=subChk.checked; savePlanChanges(); updateProgress(); });
          const subText = document.createElement('div'); subText.textContent = ss;
          subRow.appendChild(subChk); subRow.appendChild(subText);
          subWrap.appendChild(subRow);
        });
        roadmapList.appendChild(subWrap);
      }

      // append projects panel after the row and substeps
      roadmapList.appendChild(projectsPanel);
      
    });
  }

  function updateProgress(){
    const p = computeProgress(plan);
    const bar = document.getElementById('progressBar'); if(bar) bar.style.width = p + '%';
    const pct = document.getElementById('progressPercent'); if(pct) pct.textContent = p + '%';
  }

  // set initial progress on load
  updateProgress();

  // Render Workflow tab: daily work log
  function renderWorkflow(){
    const tabContent = document.getElementById('tabContent');
    const totalHours = (plan.worklog||[]).reduce((s,e)=>s + (Number(e.hours)||0), 0);
    tabContent.innerHTML = `
      <h4>Daily Workflow Tracker</h4>
      <div class="workflow-header">
        <div class="workflow-summary">Total hours logged: <strong class="total-hours">${totalHours.toFixed(1)} hours</strong></div>
        <div class="workflow-actions"><button id="logWorkBtn" class="log-work-btn">+ Log Today's Work</button></div>
      </div>
      <div id="workLogArea" class="worklog-area"></div>
    `;

    const workLogArea = document.getElementById('workLogArea');
    // render current entries
    renderWorklogEntries(workLogArea);

    const logBtn = document.getElementById('logWorkBtn');
    logBtn.addEventListener('click', function(){
      // show inline form
      const form = document.createElement('div'); form.className='worklog-form';
      form.innerHTML = `
        <div class="worklog-form-row">
          <input class="wl-date" type="date" />
          <input class="wl-hours" type="number" placeholder="Hours (e.g., 1.5)" />
          <label class="wl-tasks"><input type="checkbox" class="wl-tasks-checkbox" /> Tasks completed</label>
        </div>
        <textarea class="wl-notes" placeholder="Notes (optional)"></textarea>
        <div class="worklog-form-actions"><button class="btn wl-add">Add</button><button class="btn wl-cancel">Cancel</button></div>
      `;
      workLogArea.prepend(form);
      logBtn.disabled = true;
      form.querySelector('.wl-cancel').addEventListener('click', ()=>{ form.remove(); logBtn.disabled=false; });
      form.querySelector('.wl-add').addEventListener('click', ()=>{
        const date = form.querySelector('.wl-date').value || new Date().toISOString().slice(0,10);
        const hours = form.querySelector('.wl-hours').value || '0';
        const notes = form.querySelector('.wl-notes').value || '';
        const tasksCompleted = !!form.querySelector('.wl-tasks-checkbox').checked;
        if(!hours){ alert('Please enter hours'); return; }
        plan.worklog = plan.worklog || [];
        plan.worklog.push({ id: Date.now(), date, hours: Number(hours), notes, tasksCompleted });
        savePlanChanges();
        renderWorkflow();
      });
    });
  }

  // small helper to render each worklog entry as card
  function renderWorklogEntries(container){
    container.innerHTML = '';
    const entries = plan.worklog || [];
    if(entries.length===0){
      container.innerHTML = '<div class="no-worklog">No workflow entries yet. Start logging your daily progress!</div>';
      return;
    }
    entries.slice().reverse().forEach(en=>{
      const card = document.createElement('div'); card.className='worklog-entry';
      card.innerHTML = `
        <div class="entry-header">
          <div class="entry-left">
            <div class="entry-date"><span class="cal-icon"></span> ${fmtDate(en.date)}</div>
            <div class="entry-hours"><span class="time-icon"></span> ${Number(en.hours)||0} hour${(Number(en.hours)||0)!==1? 's':''}</div>
          </div>
          <div class="entry-actions"><button class="wl-delete" data-id="${en.id}">🗑</button></div>
        </div>
        <div class="entry-body">${escapeHtml(en.notes||'')}</div>
        <div class="entry-tasks">Tasks Completed:<div class="task-badge">${en.tasksCompleted? '<span class="task-yes">yes</span>' : '<span class="task-no">no</span>'}</div></div>
      `;
      container.appendChild(card);
      card.querySelector('.wl-delete').addEventListener('click', function(){
        if(!confirm('Delete this worklog entry?')) return;
        const id = Number(this.getAttribute('data-id'));
        plan.worklog = (plan.worklog||[]).filter(x=>x.id!==id);
        savePlanChanges(); renderWorkflow();
      });
    });
  }

  // Render Applications tab: job applications
  function renderApplications(){
    const tabContent = document.getElementById('tabContent');
    const apps = plan.applications || [];
    const counts = { applied:0, interview:0, offer:0, rejected:0 };
    apps.forEach(a=>{ const s=(a.status||'applied').toLowerCase(); if(counts[s]!==undefined) counts[s]++; });
    tabContent.innerHTML = `
      <h4>Job Applications</h4>
      <div class="applications-header">
        <div class="applications-stats">
          <span class="stat stat-applied"><span class="count">${counts.applied}</span> <span class="label">Applied</span></span>
          <span class="stat stat-interview"><span class="count">${counts.interview}</span> <span class="label">Interview</span></span>
          <span class="stat stat-offer"><span class="count">${counts.offer}</span> <span class="label">Offer</span></span>
          <span class="stat stat-rejected"><span class="count">${counts.rejected}</span> <span class="label">Rejected</span></span>
        </div>
        <div class="log-application-container"><button id="logAppBtn" class="log-application-btn">+ Log Application</button></div>
      </div>
      <div style="margin-top:18px;min-height:120px" id="appsArea">
      </div>
    `;

    const appsArea = document.getElementById('appsArea');
    function renderAppsList(){
      appsArea.innerHTML = '';
      if(apps.length===0){ appsArea.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:28px">No applications logged yet. Start tracking your job applications!</div>'; return; }
      apps.slice().reverse().forEach(a=>{
        const card = document.createElement('div'); card.className='app-card';
        const dateStr = a.date? fmtDate(a.date) : '';

        card.innerHTML = `
          <div class="company-row">
            <div class="company-left">
              <div style="display:flex;gap:8px;align-items:center"><div class="company-name">${escapeHtml(a.company||a.name||'')}</div><span class="status-badge">${escapeHtml((a.status||'Applied').toString())}</span></div>
              <div class="company-sub">${escapeHtml(a.role||'')}</div>
              <div class="meta-line"><span class="cal-icon"></span> Applied on ${escapeHtml(dateStr)}</div>
            </div>
            <div class="status-pills">
              <div>
                <button class="status-btn status-applied" data-id="${a.id}" data-status="applied">Applied</button>
                <button class="status-btn status-interview" data-id="${a.id}" data-status="interview">Interview</button>
                <button class="status-btn status-offer" data-id="${a.id}" data-status="offer">Offer</button>
                <button class="status-btn status-rejected" data-id="${a.id}" data-status="rejected">Rejected</button>
              </div>
              <button class="app-delete" data-id="${a.id}">🗑</button>
            </div>
          </div>
          <div class="notes">${escapeHtml(a.notes||'')}</div>
        `;
        appsArea.appendChild(card);

        // wire status buttons
        card.querySelectorAll('.status-btn').forEach(btn=>{
          btn.addEventListener('click', function(){
            const id = Number(this.getAttribute('data-id'));
            const status = this.getAttribute('data-status');
            const idx = plan.applications.findIndex(x=>x.id===id);
            if(idx>=0){ plan.applications[idx].status = status; savePlanChanges(); renderApplications(); }
          });
        });

        card.querySelector('.app-delete').addEventListener('click', function(){
          if(!confirm('Delete this application?')) return;
          const id = Number(this.getAttribute('data-id'));
          plan.applications = (plan.applications||[]).filter(x=>x.id!==id);
          savePlanChanges(); renderApplications();
        });
      });
    }
    renderAppsList();

    document.getElementById('logAppBtn').addEventListener('click', function(){
      const form = document.createElement('div'); form.style.display='flex'; form.style.flexDirection='column'; form.style.gap='8px';
      const today = new Date().toISOString().slice(0,10);
      form.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <input class="app-company" placeholder="Company (e.g., Google)" style="flex:1" />
          <input class="app-role" placeholder="Position (e.g., Frontend Developer)" style="flex:1" />
        </div>
        <div style="display:flex;gap:12px;margin-top:6px">
          <input class="app-date" type="date" value="${today}" style="flex:0 0 180px" />
          <select class="app-status" style="flex:0 0 160px"><option value="applied">Applied</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="rejected">Rejected</option></select>
        </div>
        <textarea class="app-notes" placeholder="Notes (optional)" style="min-height:80px;margin-top:8px;padding:10px;border-radius:8px;border:1px solid #e6edf7"></textarea>
        <div style="display:flex;gap:8px"><button class="btn app-add" style="background:#10b981;color:#fff">Add Application</button><button class="btn app-cancel" style="background:#e6eefc">Cancel</button></div>
      `;
      appsArea.prepend(form);
      this.disabled = true;
      form.querySelector('.app-cancel').addEventListener('click', ()=>{ form.remove(); this.disabled=false; });
      form.querySelector('.app-add').addEventListener('click', ()=>{
        const company = form.querySelector('.app-company').value.trim();
        const role = form.querySelector('.app-role').value.trim();
        const status = form.querySelector('.app-status').value;
        const date = form.querySelector('.app-date').value || new Date().toISOString().slice(0,10);
        const notes = form.querySelector('.app-notes').value || '';
        if(!company || !role){ alert('Please enter company and role'); return; }
        plan.applications = plan.applications || [];
        plan.applications.push({ id: Date.now(), company, role, status, date, notes });
        savePlanChanges();
        renderApplications();
      });
    });
  }

  // actions
  const markBtn = document.getElementById('markCompleteBtn');
  const delBtn = document.getElementById('deleteBtn');
  markBtn.addEventListener('click', function(){ plan.completed = !plan.completed; savePlanChanges(); markBtn.innerHTML = `<span class="btn-icon">✔</span><span class="btn-label">${plan.completed? 'Mark Active':'Mark Complete'}</span>`; renderHeaderBadge(); });
  delBtn.addEventListener('click', function(){ if(confirm('Delete this plan?')){ const all = window.getPlans(); const idx = all.findIndex(x=>x.id===plan.id); if(idx>=0){ all.splice(idx,1); window.savePlans(all); window.updateCounts(); window.location.href='index.html'; } } });

  function renderHeaderBadge(){ const h2 = document.querySelector('.title-row h2'); if(h2) h2.textContent = escapeHtml(plan.role); const badge = document.querySelector('.title-row .badge'); if(badge) badge.textContent = plan.completed? 'Completed':'Active'; }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }

  renderRoadmap(); updateProgress(); renderHeaderBadge();
  // tab switching
  const tabButtons = document.querySelectorAll('.tab');
  tabButtons.forEach(tb=>{
    tb.addEventListener('click', function(){
      tabButtons.forEach(x=>x.classList.remove('active'));
      this.classList.add('active');
      const which = this.getAttribute('data-tab');
      if(which==='roadmap') renderRoadmap();
      else if(which==='workflow') renderWorkflow();
      else if(which==='applications') renderApplications();
    });
  });
});

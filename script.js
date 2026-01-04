// Minimal interactions for demo dashboard
document.addEventListener('DOMContentLoaded', function(){
  const newPlanBtns = document.querySelectorAll('.new-plan, .new-plan-sidebar');
  const createBtn = document.querySelector('.create-plan');
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const stepsList = document.getElementById('stepsList');
  const addStepBtn = document.getElementById('addStepBtn');
  const planForm = document.getElementById('planForm');
  const cancelBtn = document.getElementById('cancelBtn');

  function openModal(){
    modal.classList.remove('hidden');
    // reset form when opening
    if(planForm) planForm.reset();
    if(stepsList) stepsList.innerHTML = '';
  }
  function closeModal(){
    modal.classList.add('hidden');
  }

  newPlanBtns.forEach(b => b.addEventListener('click', openModal));
  if(createBtn) createBtn.addEventListener('click', openModal);
  if(modalClose) modalClose.addEventListener('click', closeModal);
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // close modal with Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeModal();
  });

  // Steps management
  function createStepElement(stepIndex){
    const card = document.createElement('div');
    card.className = 'step-card';

    const row = document.createElement('div');
    row.className = 'step-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'e.g., Learn React basics';
    input.className = 'step-input';

    const controls = document.createElement('div');
    controls.className = 'step-controls';

    const addSubBtn = document.createElement('button');
    addSubBtn.type = 'button';
    addSubBtn.className = 'btn btn-ghost';
    addSubBtn.textContent = 'Add Sub-step';
    addSubBtn.addEventListener('click', function(){
      const sub = document.createElement('input');
      sub.type = 'text';
      sub.placeholder = 'Sub-step';
      sub.className = 'substep-input';
      subsContainer.appendChild(sub);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function(){
      card.remove();
    });

    controls.appendChild(addSubBtn);
    controls.appendChild(removeBtn);

    row.appendChild(input);
    row.appendChild(controls);

    const subsContainer = document.createElement('div');
    subsContainer.className = 'substeps';

    card.appendChild(row);
    card.appendChild(subsContainer);

    return card;
  }

  if(addStepBtn){
    addStepBtn.addEventListener('click', function(){
      const el = createStepElement();
      stepsList.appendChild(el);
    });
  }

  // roadmap Add Sub-step behaviour — create a new step with one empty sub-step
  const roadmapSubBtn = document.getElementById('roadmapSubBtn');
  if(roadmapSubBtn){
    roadmapSubBtn.addEventListener('click', function(){
      const stepEl = createStepElement();
      // create a substep input inside the step's subs container
      const subInput = document.createElement('input');
      subInput.type = 'text';
      subInput.placeholder = 'Sub-step';
      subInput.className = 'substep-input';
      const subs = stepEl.querySelector('.substeps');
      if(subs) subs.appendChild(subInput);
      stepsList.appendChild(stepEl);
      // ensure modal stays visible and focus the new substep
      subInput.focus();
    });
  }

  // persistence helpers
  function getPlans(){
    try{
      const raw = localStorage.getItem('jobPlans');
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      return [];
    }
  }
  function savePlans(plans){
    localStorage.setItem('jobPlans', JSON.stringify(plans));
  }

  function updateCounts(){
    const plans = getPlans();
    const total = plans.length;
    const completed = plans.filter(p=>p.completed).length;
    const active = plans.filter(p=>!p.completed).length;
    // applications count: sum of plan.applications lengths
    const applications = plans.reduce((acc,p)=>acc + (Array.isArray(p.applications)? p.applications.length:0), 0);
    // update any elements if present
    // update the dashboard stat cards by ID (if present)
    const elActive = document.getElementById('stat-active'); if(elActive) elActive.textContent = active;
    const elCompleted = document.getElementById('stat-completed'); if(elCompleted) elCompleted.textContent = completed;
    const elApplications = document.getElementById('stat-applications'); if(elApplications) elApplications.textContent = applications;
    const elTotal = document.getElementById('stat-total'); if(elTotal) elTotal.textContent = total;

    // sidebar counts (small text)
    const sidebarCounts = document.querySelector('.sidebar .counts');
    if(sidebarCounts){
      sidebarCounts.innerHTML = `<div>${active} active plans</div><div>${completed} completed</div>`;
    }
    const sbActive = document.getElementById('sidebar-count-active'); if(sbActive) sbActive.textContent = `${active} active plans`;
    const sbComp = document.getElementById('sidebar-count-completed'); if(sbComp) sbComp.textContent = `${completed} completed`;
    // update any element with data-count attributes if present
    const activeEls = document.querySelectorAll('[data-count="active-plans"]');
    activeEls.forEach(e=>e.textContent = active);
    const completedEls = document.querySelectorAll('[data-count="completed-plans"]');
    completedEls.forEach(e=>e.textContent = completed);
    // render active plans in sidebar if container exists
    renderActivePlans();
    // render dashboard plan cards
    renderDashboardPlans();
  }

  // render list of active plans in sidebar
  function renderActivePlans(){
    const listContainer = document.getElementById('activePlansList');
    if(!listContainer) return;
    const plans = getPlans();
    listContainer.innerHTML = '';
    plans.forEach(p => {
      const item = document.createElement('a');
      item.className = 'active-plan-item';
      item.href = `plan.html?id=${p.id}`;
      item.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div style='font-size:18px'>🎁</div><div><div class=\"plan-title\">${escapeHtml(p.role || 'Untitled')}</div><div class=\"plan-company\">${escapeHtml(p.company || '')}</div></div></div>`;
      listContainer.appendChild(item);
    });
  }

  // render dashboard cards for plans
  function computePlanProgress(plan){
    let total=0, done=0;
    (plan.steps||[]).forEach((s,si)=>{
      if(s.text) { total+=1; if(plan._checked && plan._checked[`s_${si}`]) done+=1; }
      (s.subs||[]).forEach((ss,ssi)=>{ total+=1; if(plan._checked && plan._checked[`s_${si}_ss_${ssi}`]) done+=1; });
    });
    return total? Math.round((done/total)*100):0;
  }

  function renderDashboardPlans(){
    const container = document.getElementById('plansContainer');
    if(!container) return;
    const plans = getPlans();
    container.innerHTML = '';
    if(plans.length===0){
      container.innerHTML = `<div class="card large-card"><div class="empty-inner"><div class="empty-illustration">◎</div><h2>No job plans yet</h2><p>Create your first job preparation plan to start tracking your progress</p><button class="btn btn-primary create-plan">+ Create Job Plan</button></div></div>`;
      // wire create button in empty state
      const createBtn = container.querySelector('.create-plan');
      if(createBtn) createBtn.addEventListener('click', openModal);
      return;
    }
    plans.forEach(p=>{
      const card = document.createElement('a');
      card.className = 'card plan-card';
      card.href = `plan.html?id=${p.id}`;
      const progress = computePlanProgress(p);
      const appsCount = (Array.isArray(p.applications)? p.applications.length:0);
      card.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="font-weight:700;font-size:16px">${escapeHtml(p.role||'Untitled')}</div>
          <div style="color:#6b7280">${escapeHtml(p.company||'')}</div>
          <div style="margin-top:8px">Progress <span style="float:right">${progress}%</span>
            <div style="background:#eef2f7;border-radius:10px;height:8px;margin-top:8px;overflow:hidden"><div style="height:100%;background:#c7d2fe;width:${progress}%"></div></div>
          </div>
          <div style="display:flex;justify-content:space-between;color:#6b7280;font-size:13px;margin-top:8px">
            <div>${escapeHtml(p.timeline||'')}</div>
            <div>${appsCount} apps</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // small html escape helper
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c];
    });
  }

  // expose helpers to other pages
  window.getPlans = getPlans;
  window.savePlans = savePlans;
  window.renderActivePlans = renderActivePlans;
  window.updateCounts = updateCounts;

  // handle form submit
  if(planForm){
    planForm.addEventListener('submit', function(e){
      e.preventDefault();
      const company = document.getElementById('company').value.trim();
      const role = document.getElementById('role').value.trim();
      const timeline = document.getElementById('timeline').value.trim();
      const startDate = document.getElementById('startDate').value;
      const targetDate = document.getElementById('targetDate').value;
      const roadmap = document.getElementById('roadmap').value.trim();

      const steps = [];
      const stepCards = document.querySelectorAll('.step-card');
      stepCards.forEach(card => {
        const stepInput = card.querySelector('.step-input');
        if(!stepInput) return;
        const stepText = stepInput.value.trim();
        const subs = [];
        const subInputs = card.querySelectorAll('.substep-input');
        subInputs.forEach(si => {
          const t = si.value.trim(); if(t) subs.push(t);
        });
        if(stepText || subs.length) steps.push({text: stepText, subs});
      });

      const plans = getPlans();
      const newPlan = {
        id: Date.now(), company, role, timeline, startDate, targetDate, roadmap, steps, completed:false, applications:[]
      };
      plans.push(newPlan);
      savePlans(plans);
      updateCounts();
      closeModal();
    });
  }

  // init counts on load
  updateCounts();

  // Mobile sidebar open/close handlers
  const mobileMenuBtns = document.querySelectorAll('.mobile-menu-btn');
  const sidebarEl = document.getElementById('sidebar');
  const mobileCloseBtns = document.querySelectorAll('.mobile-sidebar-close');

  function showOverlay(){
    let ov = document.getElementById('mobileOverlay');
    if(!ov){ ov = document.createElement('div'); ov.id = 'mobileOverlay'; document.body.appendChild(ov); }
    ov.classList.add('visible');
    ov.addEventListener('click', closeMobileSidebar);
  }
  function hideOverlay(){ const ov = document.getElementById('mobileOverlay'); if(ov){ ov.classList.remove('visible'); ov.removeEventListener('click', closeMobileSidebar); }}

  function openMobileSidebar(){ if(!sidebarEl) return; sidebarEl.classList.add('open'); showOverlay(); }
  function closeMobileSidebar(){ if(!sidebarEl) return; sidebarEl.classList.remove('open'); hideOverlay(); }

  if(mobileMenuBtns && mobileMenuBtns.length){ mobileMenuBtns.forEach(b=>b.addEventListener('click', openMobileSidebar)); }
  if(mobileCloseBtns && mobileCloseBtns.length){ mobileCloseBtns.forEach(b=>b.addEventListener('click', closeMobileSidebar)); }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeMobileSidebar(); } });
});

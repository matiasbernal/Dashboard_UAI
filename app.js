let MATERIAS = [];

    const RPG = [
      { l: 1, t: "Novato Universitario", xp: 0 },
      { l: 2, t: "Primer Año Sobrevivido", xp: 500 },
      { l: 3, t: "Cursante Regular", xp: 1200 },
      { l: 5, t: "Programador Junior", xp: 2500 },
      { l: 10, t: "Analista en Ascenso", xp: 5000 },
      { l: 15, t: "Arquitecto de Sistemas", xp: 9000 },
      { l: 20, t: "Veterano de la Cursada", xp: 14000 },
      { l: 30, t: "Ingeniero Especialista", xp: 22000 },
      { l: 50, t: "Maestro del Campus", xp: 40000 },
    ];

    let ST = { materias: {}, examenes: [], tasks: [], xp: 0, xpLog: [], pomoSessions: 0, matNotes: {}, lastPomoDate: null, racha: 0, inbox: [], username: null, careerIndex: null };
    function save() { try { localStorage.setItem('uais_v3', JSON.stringify(ST)); } catch (e) { } }
    function load() { try { const s = localStorage.getItem('uais_v3'); if (s) Object.assign(ST, JSON.parse(s)); } catch (e) { } }


function initOnboarding() {
    if (!ST.username || ST.careerIndex === null) {
        // Populate career select
        const sel = document.getElementById('ob-career');
        if (sel && typeof CARRERAS_DB !== 'undefined') {
            sel.innerHTML = '<option value="">Seleccioná tu carrera...</option>' + 
                CARRERAS_DB.map((c, i) => `<option value="${i}">${c.nombre}</option>`).join('');
        }
        document.getElementById('onboarding-modal').style.display = 'flex';
    } else {
        loadCareerPlan();
    }
}

function saveOnboarding() {
    let un = document.getElementById('ob-username').value.trim();
    const ci = document.getElementById('ob-career').value;
    const msg = document.getElementById('ob-msg');
    
    if (!un || !ci) {
        msg.style.display = 'block';
        return;
    }
    
    if (!un.startsWith('@')) un = '@' + un;
    
    ST.username = un;
    ST.careerIndex = parseInt(ci);
    save();
    
    document.getElementById('onboarding-modal').style.display = 'none';
    
    loadCareerPlan();
    
    // Refresh UI
    renderMaterias();
    renderDashStats();
}

function loadCareerPlan() {
    if (ST.careerIndex !== null && typeof CARRERAS_DB !== 'undefined' && CARRERAS_DB[ST.careerIndex]) {
        const cData = CARRERAS_DB[ST.careerIndex];
        MATERIAS = cData.anios.map(a => ({
            year: a.numero + (a.numero===1?'er':a.numero===2?'do':a.numero===3?'er':a.numero===4?'to':a.numero===5?'to':'') + ' Año',
            cuatris: a.cuatris.map(c => ({
                name: c.numero + (c.numero===1?'er':'do') + ' Cuatrimestre',
                subjects: c.subjects
            }))
        }));
    }
}


    /* ── XP & RPG ── */
    function addXP(n, reason) { ST.xp += n; ST.xpLog.unshift({ n, reason }); if (ST.xpLog.length > 50) ST.xpLog.pop(); save(); }
    function curLevel() { let c = RPG[0]; for (const r of RPG) { if (ST.xp >= r.xp) c = r; } return c; }
    function nxtLevel() { for (const r of RPG) { if (r.xp > ST.xp) return r; } return null; }
    function renderXP() {
      const c = curLevel(), nx = nxtLevel();
      const pct = nx ? Math.round((ST.xp - c.xp) / (nx.xp - c.xp) * 100) : 100;
      const xpStr = nx ? ST.xp + ' / ' + nx.xp + ' XP' : ST.xp + ' XP';
      document.getElementById('xp-level-lbl').textContent = 'Nivel ' + c.l;
      document.getElementById('xp-counter').textContent = xpStr;
      document.getElementById('xp-title').textContent = c.t;
      document.getElementById('xp-bar').style.width = pct + '%';
      document.getElementById('rpg-title-big').textContent = c.t;
      document.getElementById('rpg-level-big').textContent = 'Nivel ' + c.l;
      document.getElementById('rpg-xp-cur').textContent = ST.xp + ' XP acumulados';
      document.getElementById('rpg-xp-nxt').textContent = nx ? (nx.xp - ST.xp) + ' XP para nivel ' + nx.l : '¡Nivel máximo!';
      document.getElementById('rpg-bar').style.width = pct + '%';
    }
    function renderRPG() {
      const c = curLevel();
      document.getElementById('levels-grid').innerHTML = RPG.map(r => `
    <div class="level-card${r.l === c.l ? ' current' : ''}">
      <div style="font-size:10px;font-weight:700;color:${r.l <= c.l ? 'var(--gold)' : 'var(--text3)'};margin-bottom:3px">Nivel ${r.l}</div>
      <div style="font-size:12px;font-weight:500;color:${r.l <= c.l ? 'var(--text)' : 'var(--text3)'}">${r.t}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">${r.xp.toLocaleString('es')} XP${r.l === c.l ? ' ← actual' : ''}</div>
    </div>`).join('');
      const log = document.getElementById('xp-log');
      log.innerHTML = ST.xpLog.length
        ? ST.xpLog.slice(0, 12).map(e => `<div class="xp-row"><span style="color:var(--text2)">${e.reason}</span><span class="xp-amt">+${e.n} XP</span></div>`).join('')
        : '<div style="color:var(--text3);font-size:13px;padding:8px">Sin actividad aún. Aprobá materias y completá tareas.</div>';
    }

    /* ── MATERIAS ── */
    let matFilter = 'todas';
    let notaPendingCode = null, notaSelected = null;

    function getMS(code) { return ST.materias[code] || 'pendiente'; }

    function cycleMS(code) {
      const order = { pendiente: 'cursando', cursando: 'aprobada', aprobada: 'final_pendiente', final_pendiente: 'pendiente' };
      const prev = getMS(code), next = order[prev];
      // Si va a aprobada, abrir modal de nota
      if (next === 'aprobada') {
        notaPendingCode = code; notaSelected = null;
        // find subject name
        let sname = code;
        MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => { if (s.code === code) sname = s.name; })));
        document.getElementById('nota-modal-name').textContent = sname;
        document.querySelectorAll('.nota-btn').forEach(b => b.classList.remove('sel'));
        const btn = document.getElementById('nota-confirm-btn'); btn.disabled = true; btn.style.opacity = '0.4';
        document.getElementById('nota-modal').classList.add('open');
        return;
      }
      // Si deja de ser aprobada, limpiar nota
      if (prev === 'aprobada') { delete ST.notas[code]; }
      ST.materias[code] = next;
      save(); renderMaterias(); renderDashStats(); renderXP(); refreshSelects();
    }

    function selectNota(n) {
      notaSelected = n;
      document.querySelectorAll('.nota-btn').forEach(b => b.classList.remove('sel'));
      document.querySelectorAll('.nota-btn')[n - 1].classList.add('sel');
      const btn = document.getElementById('nota-confirm-btn'); btn.disabled = false; btn.style.opacity = '1';
    }

    function confirmNota() {
      if (!notaPendingCode) return;
      if (!ST.notas) ST.notas = {};
      ST.materias[notaPendingCode] = 'aprobada';
      ST.notas[notaPendingCode] = notaSelected;
      addXP(500, 'Materia aprobada: ' + notaPendingCode);
      save(); renderMaterias(); renderDashStats(); renderXP(); refreshSelects();
      // cerrar sin volver a guardar
      notaPendingCode = null; notaSelected = null;
      document.getElementById('nota-modal').classList.remove('open');
    }

    function closeNotaModal() {
      // "Sin nota por ahora" → marca aprobada sin nota
      if (notaPendingCode) {
        if (!ST.notas) ST.notas = {};
        ST.materias[notaPendingCode] = 'aprobada';
        addXP(500, 'Materia aprobada: ' + notaPendingCode);
        save(); renderMaterias(); renderDashStats(); renderXP(); refreshSelects();
      }
      notaPendingCode = null; notaSelected = null;
      document.getElementById('nota-modal').classList.remove('open');
    }

    /* ── SELECTS DE MATERIAS ACTIVAS ── */
    function getActiveSubjects() {
      // Cursando + final_pendiente, ordenadas por año/cuatri
      const result = [];
      MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => {
        const st = getMS(s.code);
        if (st === 'cursando' || st === 'final_pendiente') result.push({ code: s.code, name: s.name, st });
      })));
      return result;
    }

    function refreshSelects() {
      const active = getActiveSubjects();
      const selects = ['ex-m', 'task-mat'];
      selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">— Seleccioná una materia —</option>';
        active.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.name;
          opt.textContent = (s.st === 'final_pendiente' ? '⚠ ' : '') + '[' + s.code + '] ' + s.name;
          sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
      });
      // Aviso si no hay ninguna activa
      ['ex-no-mats', 'task-no-mats'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = active.length ? 'none' : 'block';
      });
    }
    function resetMaterias() { if (confirm('¿Resetear todas las materias y notas?')) { ST.materias = {}; ST.notas = {}; save(); renderMaterias(); renderDashStats(); refreshSelects(); } }
    function renderMaterias() {
      let ap = 0, cu = 0, fp = 0;
      MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => {
        const st = getMS(s.code);
        if (st === 'aprobada') ap++; else if (st === 'cursando') cu++; else if (st === 'final_pendiente') fp++;
      })));
      document.getElementById('mat-prog').style.width = Math.round(ap / 51 * 100) + '%';
      document.getElementById('mat-prog-lbl').textContent = ap + ' / 51 aprobadas';
      const labels = { aprobada: 'Aprobada', cursando: 'Cursando', final_pendiente: 'Final pendiente', pendiente: 'Pendiente' };
      const cont = document.getElementById('materias-container');
      cont.innerHTML = MATERIAS.map(y => {
        const cyear = y.cuatris.map(c => {
          const subs = c.subjects.map(s => {
            const st = getMS(s.code);
            if (matFilter !== 'todas' && st !== matFilter) return '';
            return `<div class="subject-card ${st}" onclick="cycleMS('${s.code}')">
          <div class="subject-card-header"><div class="code">${s.code}</div><div class="subject-card-actions"><button class="subject-btn" onclick="openMatModal('${s.code}', event)">📝 Notas</button></div></div>
          <div class="sname">${s.name}${st === 'aprobada' && ST.notas && ST.notas[s.code] ? `<span class="nota-badge">${ST.notas[s.code]}</span>` : ''}</div>
          <div class="stag stag-${st}">${labels[st]}</div>
        </div>`;
          }).join('');
          if (!subs.trim()) return '';
          return `<div class="cuatri-lbl">${c.name}</div><div class="subjects-grid">${subs}</div>`;
        }).join('');
        if (!cyear.trim()) return '';
        return `<div class="year-hdr">${y.year}</div>${cyear}`;
      }).join('');
    }

    /* ── DASHBOARD STATS ── */
    
function generateMessages() {
    const cont = document.getElementById('dash-messages-container');
    if(!cont) return;
    
    let msgs = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Exams <= 7 days
    ST.examenes.forEach(e => {
        if(!e.f) return;
        const diff = Math.round((new Date(e.f + 'T00:00:00') - today) / 864e5);
        if(diff >= 0 && diff <= 7) {
            msgs.push({
                type: 'exam',
                title: 'Examen Próximo',
                desc: `Faltan ${diff} días para tu examen de ${e.n} (${e.m}).`,
                color: 'var(--red)'
            });
        }
    });
    
    // Tasks: 1 day or overdue (not done)
    ST.tasks.filter(t => !t.done).forEach(t => {
        if(!t.date) return;
        const diff = Math.round((new Date(t.date + 'T00:00:00') - today) / 864e5);
        if(diff === 1) {
            msgs.push({
                type: 'task',
                title: 'Tarea vence mañana',
                desc: `"${t.name}" vence mañana.`,
                color: 'var(--amber)'
            });
        } else if (diff < 0) {
            msgs.push({
                type: 'task',
                title: 'Tarea Vencida',
                desc: `La tarea "${t.name}" está atrasada.`,
                color: 'var(--red)'
            });
        }
    });
    
    // Community Comments on MY publications
    try {
        let items = [];
        const result = localStorage.getItem(COMM_KEY);
        if(result) items = JSON.parse(result);
        
        let totalMyComments = 0;
        let publicationsWithComments = [];
        
        items.forEach(i => {
            if(i.isMine && i.comments && i.comments.length > 0) {
                totalMyComments += i.comments.length;
                publicationsWithComments.push(i.titulo);
            }
        });
        
        if(!ST.seenComments) ST.seenComments = 0;
        if(totalMyComments > ST.seenComments) {
            const news = totalMyComments - ST.seenComments;
            msgs.push({
                type: 'comm',
                title: 'Nuevos Aportes',
                desc: `¡Recibiste ${news} comentarios nuevos en tus publicaciones (${publicationsWithComments[0]}${publicationsWithComments.length > 1 ? ' y más' : ''})!`,
                color: 'var(--blue)'
            });
            // We only update seenComments when they click the message or we could just auto update it. 
            // For now, let's keep it persistent until they click it.
        }
    } catch(e) {}
    
    if(msgs.length === 0) {
        cont.innerHTML = `<div class="msg-item"><div style="font-size:10px;color:var(--green);font-weight:600">Sistema</div><div style="font-size:13px;font-weight:500;color:var(--text);margin-top:2px">Todo al día</div><div style="font-size:11px;color:var(--text2);margin-top:3px">No tenés alertas pendientes. ¡Buen trabajo!</div></div>`;
    } else {
        cont.innerHTML = msgs.map((m, idx) => `<div class="msg-item" ${m.type==='comm' ? `onclick="markCommentsSeen(); goPage('comunidad')"` : ''} style="${m.type==='comm' ? 'cursor:pointer;' : ''}">
          <div style="font-size:10px;color:${m.color};font-weight:600">${m.title}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">${m.desc}</div>
        </div>`).join('');
    }
}

function markCommentsSeen() {
    try {
        let items = [];
        const result = localStorage.getItem(COMM_KEY);
        if(result) items = JSON.parse(result);
        let total = 0;
        items.forEach(i => { if(i.isMine && i.comments) total += i.comments.length; });
        ST.seenComments = total;
        save();
        generateMessages();
    } catch(e) {}
}

function renderDashStats() {
      let ap = 0, cu = 0, fp = 0;
      MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => {
        const st = getMS(s.code);
        if (st === 'aprobada') ap++; else if (st === 'cursando') cu++; else if (st === 'final_pendiente') fp++;
      })));
      document.getElementById('s-aprobadas').textContent = ap;
      document.getElementById('s-cursando').textContent = cu;
      document.getElementById('s-finales').textContent = fp;
      document.getElementById('dash-pct').textContent = Math.round(ap / 51 * 100) + '%';

      // Horas y Racha
      const horas = ((ST.pomoSessions || 0) * 25 / 60).toFixed(1);
      if (document.getElementById('s-horas')) document.getElementById('s-horas').textContent = horas;
      if (document.getElementById('s-racha')) document.getElementById('s-racha').innerHTML = (ST.racha || 0) + ' <span style="font-size:12px">días</span>';

      // Calcular promedio real
      if (!ST.notas) ST.notas = {};
      const notas = Object.values(ST.notas).filter(n => n != null && n > 0);
      if (notas.length) {
        const avg = (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2);
        document.getElementById('s-promedio').textContent = avg;
      } else {
        document.getElementById('s-promedio').textContent = '—';
      }
      generateMessages();
    }

    /* ── EXÁMENES ── */
    function renderExamenes() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const sorted = [...ST.examenes].sort((a, b) => new Date(a.f) - new Date(b.f));
      const upcoming = sorted.filter(e => new Date(e.f + 'T00:00:00') >= today);
      if (upcoming.length) {
        const nx = upcoming[0];
        const diff = Math.round((new Date(nx.f + 'T00:00:00') - today) / 864e5);

      const banner = document.getElementById('exam-alert-banner');
      if (banner && upcoming.length) {
         const nx = upcoming[0];
         const diff = Math.round((new Date(nx.f + 'T00:00:00') - today) / 864e5);
         if (diff <= 3) {
             banner.style.display = 'flex';
             document.getElementById('alert-exam-name').textContent = nx.n + ' (' + nx.m + ')';
             document.getElementById('alert-exam-time').textContent = diff === 0 ? '¡Hoy!' : diff === 1 ? 'Mañana' : 'En ' + diff + ' días';
         } else {
             banner.style.display = 'none';
         }
      } else if (banner) {
         banner.style.display = 'none';
      }

        document.getElementById('eh-title').textContent = nx.n;
        document.getElementById('eh-mat').textContent = nx.m;
        document.getElementById('eh-date-str').textContent = new Date(nx.f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        document.getElementById('eh-date').style.display = 'inline-flex';
        document.getElementById('eh-days').style.display = 'block';
        document.getElementById('eh-count').textContent = diff;
      } else {
        document.getElementById('eh-title').textContent = 'Sin exámenes próximos';
        document.getElementById('eh-mat').textContent = 'Agregá uno abajo';
        document.getElementById('eh-date').style.display = 'none';
        document.getElementById('eh-days').style.display = 'none';
      }
      const cont = document.getElementById('exam-list');
      cont.innerHTML = sorted.length ? '<div class="card">' + sorted.map(e => {
        const diff = Math.round((new Date(e.f + 'T00:00:00') - today) / 864e5);
        const col = diff < 0 ? 'var(--text3)' : diff <= 2 ? 'var(--red)' : diff <= 7 ? 'var(--amber)' : 'var(--green)';
        const lbl = diff < 0 ? 'Pasado' : diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff + ' días';
        const temasHTML = e.temas ? `
      <div class="exam-temas-toggle" onclick="toggleTemas(${e.id})">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4l4 4 4-4"/></svg>
        Ver temas
      </div>
      <div class="exam-temas-body" id="temas-${e.id}" style="display:none">${e.temas.replace(/\n/g, '<br>')}</div>
    `: '';
        return `<div class="exam-row-wrap">
      <div class="exam-row">
        <div class="exam-dot" style="background:${col}"></div>
        <div class="exam-info">
          <div class="exam-rname">${e.n}</div>
          <div class="exam-rmat">${e.m} · ${new Date(e.f + 'T00:00:00').toLocaleDateString('es-AR')}</div>
        </div>
        <div class="exam-count" style="color:${col}">${lbl}</div>
        <button class="btn-icon" onclick="editExamen(${e.id})" style="margin-right:4px;">✏️</button>
        <button class="btn-icon" onclick="rmExamen(${e.id})">✕</button>
      </div>
      ${temasHTML}
    </div>`;
      }).join('') + '</div>' : '<div class="card" style="color:var(--text2)">No hay exámenes cargados aún.</div>';
    }
    function addExamen() {
      const n = document.getElementById('ex-n').value.trim();
      const m = document.getElementById('ex-m').value;
      const f = document.getElementById('ex-f').value;
      if (!n || !f) return;
      const temas = document.getElementById('ex-temas').value.trim();
      ST.examenes.push({ id: Date.now(), n, m: m || 'General', f, temas });
      document.getElementById('ex-n').value = '';
      document.getElementById('ex-m').value = '';
      document.getElementById('ex-f').value = '';
      document.getElementById('ex-temas').value = '';
      save(); renderExamenes();
    }
    function rmExamen(id) { if(confirm('¿Seguro que querés borrar este examen?')) { ST.examenes = ST.examenes.filter(e => e.id !== id); save(); renderExamenes(); } }
    function toggleTemas(id) {
      const body = document.getElementById('temas-' + id);
      const toggle = body.previousElementSibling;
      const open = body.style.display === 'none';
      body.style.display = open ? 'block' : 'none';
      toggle.classList.toggle('open', open);
    }

    /* ── TAREAS ── */
    function taskHTML(t) {
      return `<div class="task-item ${t.prio ? 'task-prio-'+t.prio : ''}">
    <div class="tchk${t.done ? ' done' : ''}" onclick="toggleTask(${t.id})">
      ${t.done ? '<svg width="9" height="9" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' : ''}
    </div>
    <div class="task-body">
      <div class="task-name" style="${t.done ? 'text-decoration:line-through;color:var(--text2)' : ''}">${t.name}</div>
      ${t.mat ? `<div class="task-meta">${t.mat}</div>` : ''}
    </div>
    ${t.date ? `<div class="task-date">${new Date(t.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>` : ''}
    <button class="btn-icon" onclick="editTask(${t.id})" style="margin-right:4px;">✏️</button>
    <button class="btn-icon" onclick="rmTask(${t.id})">✕</button>
  </div>`;
    }
    function renderTasks() {
      const pend = ST.tasks.filter(t => !t.done).sort((a,b) => (a.prio || '2') - (b.prio || '2'));
      const done = ST.tasks.filter(t => t.done);
      document.getElementById('tasks-pending').innerHTML = pend.length ? pend.map(taskHTML).join('') : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sin tareas pendientes</div>';
      document.getElementById('tasks-done').innerHTML = done.length ? done.map(taskHTML).join('') : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sin tareas completadas</div>';
      const dt = document.getElementById('dash-tasks');
      const top = pend.slice(0, 3);
      dt.innerHTML = top.length ? top.map(t => `<div class="task-item ${t.prio ? 'task-prio-'+t.prio : ''}">
    <div class="tchk" onclick="toggleTask(${t.id});goPage('tareas')"></div>
    <div class="task-body"><div class="task-name">${t.name}</div>${t.mat ? `<div class="task-meta">${t.mat}</div>` : ''}</div>
    ${t.date ? `<div class="task-date">${new Date(t.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>` : ''}
  </div>`).join('') : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sin tareas pendientes</div>';
    }
    function addTask() {
      const name = document.getElementById('task-name').value.trim();
      if (!name) return;
      const mat = document.getElementById('task-mat').value; // select
      const date = document.getElementById('task-date').value;
      const prio = document.getElementById('task-prio') ? document.getElementById('task-prio').value : '2';
      ST.tasks.push({ id: Date.now(), name, mat, date, prio, done: false });
      document.getElementById('task-name').value = '';
      document.getElementById('task-mat').value = '';
      document.getElementById('task-date').value = '';
      save(); renderTasks();
    }
    function toggleTask(id) {
      const t = ST.tasks.find(t => t.id === id); if (!t) return;
      t.done = !t.done;
      if (t.done) addXP(20, 'Tarea completada: ' + t.name);
      save(); renderTasks(); renderXP();
    }
    function rmTask(id) { if(confirm('¿Seguro que querés borrar esta tarea?')) { ST.tasks = ST.tasks.filter(t => t.id !== id); save(); renderTasks(); } }

    /* ── CALENDARIO ── */
    let calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
    const CAL_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const CAL_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCal(); }
    function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCal(); }

    function renderCal() {
      document.getElementById('cal-title').textContent = CAL_MESES[calMonth] + ' ' + calYear;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

      // Collect events for this month
      const evByDay = {};
      ST.examenes.forEach(e => {
        if (!e.f) return;
        const d = new Date(e.f + 'T00:00:00');
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          const k = d.getDate();
          if (!evByDay[k]) evByDay[k] = [];
          // Truncate temas to ~80 chars for tooltip preview
          const temasPreview = e.temas ? e.temas.replace(/\n/g, ' · ').slice(0, 80) + (e.temas.length > 80 ? '…' : '') : '';
          evByDay[k].push({ type: 'exam', label: e.n, mat: e.m || '', temas: temasPreview, id: e.id });
        }
      });
      ST.tasks.filter(t => t.date && !t.done).forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          const k = d.getDate();
          if (!evByDay[k]) evByDay[k] = [];
          evByDay[k].push({ type: 'task', label: t.name, mat: t.mat || '', id: t.id, prio: t.prio });
        }
      });

      let html = CAL_DIAS.map(d => `<div class="cal-dow">${d}</div>`).join('');
      for (let i = 0; i < firstDay; i++)html += `<div class="cal-day empty"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(calYear, calMonth, d);
        const isToday = dt.getTime() === today.getTime();
        const evs = evByDay[d] || [];
        const evHtml = evs.slice(0, 3).map(e => {
          const safeLabel = e.label.replace(/"/g, '&quot;');
          const safeMat = (e.mat || '').replace(/"/g, '&quot;');
          const safeTemas = (e.temas || '').replace(/"/g, '&quot;');
          const prioColor = e.type === 'task' ? (e.prio === '1' ? 'var(--red)' : e.prio === '3' ? 'var(--blue)' : 'var(--amber)') : '';
          const extraStyle = e.type === 'task' ? `background: transparent; border: 1px solid ${prioColor}; color: ${prioColor}; border-left: 3px solid ${prioColor};` : '';
          return `<div class="cal-event ${e.type === 'exam' ? 'exam' : 'task'}"
        data-cal-type="${e.type}"
        data-cal-label="${safeLabel}"
        data-cal-mat="${safeMat}"
        data-cal-temas="${safeTemas}"
        style="cursor:pointer; ${extraStyle}">${e.label}</div>`;
        }).join('');
        const more = evs.length > 3 ? `<div style="font-size:9px;color:var(--text3)">+${evs.length - 3} más</div>` : '';
        html += `<div class="cal-day${isToday ? ' today' : ''}">
      <div class="cal-day-num">${d}</div>
      ${evHtml}${more}
    </div>`;
      }
      document.getElementById('cal-grid').innerHTML = html;
      if (!window._calWired) { wireCalTooltips(); window._calWired = true; }

      // Side lists
      const exThisMonth = ST.examenes.filter(e => {
        if (!e.f) return false;
        const d = new Date(e.f + 'T00:00:00');
        return d.getFullYear() === calYear && d.getMonth() === calMonth;
      }).sort((a, b) => new Date(a.f) - new Date(b.f));
      const tkThisMonth = ST.tasks.filter(t => {
        if (!t.date || t.done) return false;
        const d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === calYear && d.getMonth() === calMonth;
      }).sort((a, b) => new Date(a.date) - new Date(b.date));

      document.getElementById('cal-exam-list').innerHTML = exThisMonth.length
        ? exThisMonth.map(e => {
          const diff = Math.round((new Date(e.f + 'T00:00:00') - today) / 864e5);
          const col = diff < 0 ? 'var(--text3)' : diff <= 2 ? 'var(--red)' : diff <= 7 ? 'var(--amber)' : 'var(--green)';
          return `<div class="task-item">
          <div class="exam-dot" style="background:${col};flex-shrink:0;margin-top:4px"></div>
          <div class="task-body">
            <div class="task-name">${e.n}</div>
            <div class="task-meta">${e.m}</div>
          </div>
          <div class="task-date">${new Date(e.f + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
        </div>`;
        }).join('')
        : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sin exámenes este mes</div>';

      document.getElementById('cal-task-list').innerHTML = tkThisMonth.length
        ? tkThisMonth.map(t => `<div class="task-item ${t.prio ? 'task-prio-'+t.prio : ''}">
        <div style="width:9px;height:9px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:4px"></div>
        <div class="task-body">
          <div class="task-name">${t.name}</div>
          ${t.mat ? `<div class="task-meta">${t.mat}</div>` : ''}
        </div>
        <div class="task-date">${new Date(t.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
      </div>`).join('')
        : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sin tareas con fecha este mes</div>';
    }

    /* ── CALENDAR TOOLTIP ── */
    let _ttTimeout = null;

    function showCalTip(ev, type, label, mat, temas) {
      clearTimeout(_ttTimeout);
      const tt = document.getElementById('cal-tooltip');
      const isExam = type === 'exam';
      const typeColor = isExam ? 'var(--red)' : 'var(--blue)';
      const typeLabel = isExam ? 'EXAMEN' : 'TAREA';
      let html = `<div class="tt-type" style="color:${typeColor}">${typeLabel}</div>`;
      html += `<div class="tt-name">${label}</div>`;
      if (mat) html += `<div class="tt-mat">📚 ${mat}</div>`;
      if (isExam && temas) html += `<div class="tt-temas">${temas}</div>`;
      html += `<div class="tt-hint">Click para ver detalle completo</div>`;
      tt.innerHTML = html;

      const pad = 14;
      let x = ev.clientX + pad, y = ev.clientY + pad;
      // measure after inserting content
      tt.style.visibility = 'hidden'; tt.style.display = 'block'; tt.classList.remove('show');
      requestAnimationFrame(() => {
        const tw = tt.offsetWidth, th = tt.offsetHeight;
        if (x + tw > window.innerWidth - 8) x = ev.clientX - tw - pad;
        if (y + th > window.innerHeight - 8) y = ev.clientY - th - pad;
        tt.style.left = x + 'px'; tt.style.top = y + 'px';
        tt.style.visibility = ''; tt.classList.add('show');
      });
    }

    function hideCalTip() {
      clearTimeout(_ttTimeout);
      _ttTimeout = setTimeout(() => {
        document.getElementById('cal-tooltip').classList.remove('show');
      }, 100);
    }

    function wireCalTooltips() {
      const grid = document.getElementById('cal-grid');
      if (!grid) return;
      grid.addEventListener('mouseover', function (ev) {
        const el = ev.target.closest('.cal-event');
        if (!el) return;
        showCalTip(ev, el.dataset.calType, el.dataset.calLabel, el.dataset.calMat, el.dataset.calTemas);
      });
      grid.addEventListener('mouseout', function (ev) {
        const el = ev.target.closest('.cal-event');
        if (!el) return;
        // Only hide if mouse left the event element entirely
        if (!el.contains(ev.relatedTarget)) hideCalTip();
      });
      grid.addEventListener('mousemove', function (ev) {
        const el = ev.target.closest('.cal-event');
        if (!el) return;
        const tt = document.getElementById('cal-tooltip');
        if (!tt.classList.contains('show')) return;
        const pad = 14;
        let x = ev.clientX + pad, y = ev.clientY + pad;
        const tw = tt.offsetWidth, th = tt.offsetHeight;
        if (x + tw > window.innerWidth - 8) x = ev.clientX - tw - pad;
        if (y + th > window.innerHeight - 8) y = ev.clientY - th - pad;
        tt.style.left = x + 'px'; tt.style.top = y + 'px';
      });
      grid.addEventListener('click', function (ev) {
        const el = ev.target.closest('.cal-event');
        if (!el) return;
        hideCalTip();
        goPage(el.dataset.calType === 'exam' ? 'examenes' : 'tareas');
      });
    }
    /* ── COMUNIDAD ── */
    const COMM_TIPOS = { apunte: { icon: '📄', label: 'Apunte' }, parcial: { icon: '📝', label: 'Parcial' }, final: { icon: '📋', label: 'Final' }, resumen: { icon: '⚡', label: 'Formulario' } };
    const COMM_KEY = 'uais_comunidad_sistemas_v1';

    function getAllSubjectNames() {
      const r = [];
      MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => r.push(s.name))));
      return r;
    }

    function refreshCommSelects() {
      const names = getAllSubjectNames();
      ['comm-materia', 'comm-filtro-mat'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const isFilter = id === 'comm-filtro-mat';
        const prev = sel.value;
        sel.innerHTML = isFilter ? '<option value="">Todas las materias</option>' : '<option value="">— Seleccioná —</option>';
        names.forEach(n => { const opt = document.createElement('option'); opt.value = n; opt.textContent = n; sel.appendChild(opt); });
        if (prev) sel.value = prev;
      });
    }

    function loadComunidad() {
      const cont = document.getElementById('comm-list');
      cont.innerHTML = '<div class="comm-empty"><div class="comm-empty-icon">⏳</div><div style="font-size:13px;color:var(--text3)">Cargando materiales...</div></div>';
      try {
        const result = localStorage.getItem(COMM_KEY);
        const items = result ? JSON.parse(result) : [];
        renderComunidad(items);
      } catch (e) { renderComunidad([]); }
    }

    function renderComunidad(items) {
      if (items === undefined) { loadComunidad(); return; }
      const matFil = document.getElementById('comm-filtro-mat')?.value || '';
      const tipoFil = document.getElementById('comm-filtro-tipo')?.value || '';
      let list = items ? [...items] : [];
      if (matFil) list = list.filter(i => i.materia === matFil);
      if (tipoFil) list = list.filter(i => i.tipo === tipoFil);
      list.reverse();
      const cont = document.getElementById('comm-list');
      if (!list.length) {
        cont.innerHTML = `<div class="comm-empty"><div class="comm-empty-icon">📚</div><div style="font-size:14px;font-weight:500;color:var(--text2);margin-bottom:6px">Sin materiales todavía</div><div style="font-size:12px;color:var(--text3)">Sé el primero en subir apuntes para tu carrera.</div></div>`;
        return;
      }
      cont.innerHTML = list.map(m => {
        const ti = COMM_TIPOS[m.tipo] || COMM_TIPOS.apunte;
        const fecha = new Date(m.ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
        return `<div class="comm-card" style="cursor:pointer;" onclick="openCommDetail(${m.id})">
      <div class="comm-icon ${m.tipo}">${ti.icon}</div>
      <div class="comm-body">
        <div class="comm-title">${m.titulo}</div>
        <div style="margin-top:4px"><span class="comm-tag">${ti.label}</span></div>
        <div class="comm-meta"><span>📚 ${m.materia}</span><span>👤 ${m.autor}</span><span>📅 ${fecha}</span></div>
        ${m.desc ? `<div style="font-size:12px;color:var(--text2);margin-top:5px;line-height:1.5">${m.desc}</div>` : ''}
      </div>
      ${m.link ? `<a href="${m.link}" target="_blank" rel="noopener" class="btn btn-sm" style="flex-shrink:0;text-decoration:none">Ver →</a>` : ''}
    </div>`;
      }).join('');
    }

    function subirMaterial() {
      const titulo = document.getElementById('comm-titulo').value.trim();
      const autor = document.getElementById('comm-autor').value.trim();
      const materia = document.getElementById('comm-materia').value;
      const tipo = document.getElementById('comm-tipo').value;
      const link = document.getElementById('comm-link').value.trim();
      const desc = document.getElementById('comm-desc').value.trim();
      const fileInput = document.getElementById('comm-file');
      const msg = document.getElementById('comm-msg');
      
      if (!titulo || !materia || !autor) {
        msg.style.display = 'block'; msg.style.color = 'var(--amber)'; msg.textContent = '⚠ Completá título, materia y nombre.'; return;
      }
      if (link && !link.startsWith('http')) {
        msg.style.display = 'block'; msg.style.color = 'var(--amber)'; msg.textContent = '⚠ El link debe comenzar con http.'; return;
      }
      try {
        let items = [];
        try { const result = localStorage.getItem(COMM_KEY); if (result) items = JSON.parse(result); } catch (e) { }
        
        let fileData = null;
        let fileName = null;
        
        const saveItem = (fData, fName) => {
            items.push({ id: Date.now(), titulo, autor, materia, tipo, link, desc, ts: Date.now(), carrera: 'sistemas', file: fData, fileName: fName, comments: [], isMine: true });
            try {
                localStorage.setItem(COMM_KEY, JSON.stringify(items));
                ['comm-titulo', 'comm-autor', 'comm-link', 'comm-desc'].forEach(id => document.getElementById(id).value = '');
                document.getElementById('comm-materia').value = '';
                if(fileInput) fileInput.value = '';
                msg.style.display = 'block'; msg.style.color = 'var(--green)'; msg.textContent = '✓ Material publicado exitosamente.';
                setTimeout(() => { msg.style.display = 'none'; }, 4000);
                loadComunidad();
            } catch (e) {
                msg.style.display = 'block'; msg.style.color = 'var(--red)'; msg.textContent = '✗ Límite de memoria alcanzado. El archivo es muy pesado.';
            }
        };

        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                msg.style.display = 'block'; msg.style.color = 'var(--amber)'; msg.textContent = '⚠ Archivo muy pesado (Max 2MB). Usá un link mejor.';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                saveItem(e.target.result, file.name);
            };
            reader.readAsDataURL(file);
        } else {
            saveItem(null, null);
        }
      } catch (e) {
        msg.style.display = 'block'; msg.style.color = 'var(--red)'; msg.textContent = '✗ Error al publicar.';
      }
    }

    let pomoInt = null, pomoOn = false, pomoSec = 25 * 60, pomoMax = 25 * 60, pomoMode = 'work';
    const MODES = { work: { s: 25 * 60, lbl: 'Sesión de foco', color: 'var(--bordo2)' }, short: { s: 5 * 60, lbl: 'Descanso', color: 'var(--green)' } };
    
    
    function updateDescansoTime() {
      const mins = parseInt(document.getElementById('descanso-time').value) || 5;
      MODES.short.s = mins * 60;
      if (pomoMode === 'short') {
        pomoSec = MODES.short.s;
        pomoMax = pomoSec;
        updatePomo();
      }
    }

    function updateFocoTime() {
      const mins = parseInt(document.getElementById('foco-time').value) || 25;
      MODES.work.s = mins * 60;
      if (pomoMode === 'work') {
        pomoSec = MODES.work.s;
        pomoMax = pomoSec;
        updatePomo();
      }
    }

    function setPomoMode(mode, btn) {
      document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('on'));
      if (btn) btn.classList.add('on'); pomoMode = mode;
      pomoSec = MODES[mode].s; pomoMax = pomoSec;
      document.getElementById('pomo-lbl').textContent = MODES[mode].lbl;
      if (pomoInt) { clearInterval(pomoInt); pomoInt = null; pomoOn = false; }
      document.getElementById('pomo-pause-btn').textContent = 'Iniciar';
      updatePomo();
    }
    function updatePomo() {
      const m = Math.floor(pomoSec / 60), s = pomoSec % 60;
      document.getElementById('pomo-disp').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      const frac = pomoSec / pomoMax;
      const circ = 465;
      document.getElementById('pomo-arc').setAttribute('stroke-dashoffset', circ * (1 - frac));
      document.getElementById('pomo-arc').setAttribute('stroke', MODES[pomoMode].color);
    }
    function pomoPause() {
      if (pomoOn) { clearInterval(pomoInt); pomoOn = false; document.getElementById('pomo-pause-btn').textContent = 'Reanudar'; }
      else {
        pomoOn = true; document.getElementById('pomo-pause-btn').textContent = 'Pausar';
        pomoInt = setInterval(() => {
          if (pomoSec <= 0) {
            clearInterval(pomoInt); pomoOn = false;
            document.getElementById('pomo-pause-btn').textContent = 'Iniciar';
            
    if (pomoMode === 'work') { 
        ST.pomoSessions = (ST.pomoSessions || 0) + 1; 
        document.getElementById('pomo-sessions').textContent = ST.pomoSessions; 
        
        // Calcular racha
        const todayStr = new Date().toISOString().split('T')[0];
        if (ST.lastPomoDate !== todayStr) {
            if (ST.lastPomoDate) {
                const lastDate = new Date(ST.lastPomoDate);
                const todayDate = new Date(todayStr);
                const diffTime = Math.abs(todayDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) {
                    ST.racha = (ST.racha || 0) + 1;
                } else {
                    ST.racha = 1;
                }
            } else {
                ST.racha = 1;
            }
            ST.lastPomoDate = todayStr;
        }
        
        save();
        renderDashStats();
    }

            pomoSec = pomoMax; updatePomo(); return;
          }
          pomoSec--; updatePomo();
        }, 1000);
      }
    }
    function pomoReset() { if (pomoInt) clearInterval(pomoInt); pomoOn = false; pomoSec = pomoMax; document.getElementById('pomo-pause-btn').textContent = 'Iniciar'; updatePomo(); }

    /* ── NAV ── */
    function goPage(id) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-' + id).classList.add('active');
      document.querySelector('[data-page="' + id + '"]').classList.add('active');
      if (id === 'rpg') { renderRPG(); }
      if (id === 'calendario') { renderCal(); }
      if (id === 'comunidad') { refreshCommSelects(); loadComunidad(); }
      if (id === 'materias') renderMaterias();
      if (id === 'mensajes') renderInbox();
      if (window.innerWidth <= 640) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }
    }
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => goPage(item.dataset.page));
    });
    document.querySelectorAll('[data-mf]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mf]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on'); matFilter = btn.dataset.mf; renderMaterias();
      });
    });
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('open');
    }

    /* ── GREETING ── */
    function setGreeting() {
      const h = new Date().getHours();
      const g = h < 12 ? 'Buenos días' : 'h<19' ? 'Buenas tardes' : 'Buenas noches';
      document.getElementById('dash-greeting').textContent = (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + '!';
    }

    /* ── INIT ── */
    load();
    initOnboarding();
    if (!ST.notas) ST.notas = {};
    setGreeting();
    renderDashStats();
    renderMaterias();
    renderExamenes();
    renderTasks();
        renderXP();
    updatePomo();
    refreshSelects();
    refreshCommSelects();
    document.getElementById('pomo-sessions').textContent = ST.pomoSessions || 0;

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ST));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "uaistation_backup.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object') {
        ST = Object.assign({ materias: {}, examenes: [], tasks: [], xp: 0, xpLog: [], pomoSessions: 0, matNotes: {}, lastPomoDate: null, racha: 0, inbox: [], username: null, careerIndex: null }, data);
        save();
        location.reload();
      }
    } catch (err) {
      alert("Error al importar datos: archivo inválido.");
    }
  };
  reader.readAsText(file);
}


function handleSearch() {
  const query = document.getElementById('global-search').value.toLowerCase();
  if (query.length < 2) {
    if (query.length === 0 && document.querySelector('.page.active').id !== 'page-materias') {
        // do nothing, let them stay on the page
    }
    return;
  }
  
  goPage('materias');
  document.querySelectorAll('.subject-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'block' : 'none';
  });
}


let currentMatCode = null;

function openMatModal(code, event) {
  event.stopPropagation();
  currentMatCode = code;
  let sname = code;
  MATERIAS.forEach(y => y.cuatris.forEach(c => c.subjects.forEach(s => { if (s.code === code) sname = s.name; })));
  
  document.getElementById('mat-detail-name').textContent = sname;
  document.getElementById('mat-detail-code').textContent = code;
  document.getElementById('mat-detail-notes').value = ST.matNotes && ST.matNotes[code] ? ST.matNotes[code] : '';
  
  document.getElementById('mat-detail-modal').classList.add('open');
}

function closeMatModal() {
  document.getElementById('mat-detail-modal').classList.remove('open');
  currentMatCode = null;
}

function saveMatNotes() {
  if (!currentMatCode) return;
  if (!ST.matNotes) ST.matNotes = {};
  ST.matNotes[currentMatCode] = document.getElementById('mat-detail-notes').value;
  save();
  closeMatModal();
}


let currentCommId = null;

function openCommDetail(id) {
    let items = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) items = JSON.parse(result); } catch (e) { }
    const m = items.find(i => i.id === id);
    if(!m) return;
    
    currentCommId = id;
    document.getElementById('cd-title').textContent = m.titulo;
    const fecha = new Date(m.ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('cd-meta').textContent = `👤 ${m.autor} · 📚 ${m.materia} · 📅 ${fecha}`;
    document.getElementById('cd-desc').textContent = m.desc || 'Sin descripción adicional.';
    
    const lnk = document.getElementById('cd-link');
    if(m.link) { lnk.style.display = 'flex'; lnk.href = m.link; } else { lnk.style.display = 'none'; }
    
    const fl = document.getElementById('cd-file');
    if(m.file) { fl.style.display = 'flex'; fl.href = m.file; fl.download = m.fileName || 'archivo'; } else { fl.style.display = 'none'; }
    
    renderCommComments(m.comments || []);
    
    const editBtn = document.getElementById('cd-edit-btn');
    const delBtn = document.getElementById('cd-del-btn');
    if(delBtn) { delBtn.style.display = m.isMine ? 'inline-flex' : 'none'; }
    if(editBtn) { editBtn.style.display = m.isMine ? 'inline-flex' : 'none'; }
    document.getElementById('comm-detail-modal').classList.add('open');
    document.getElementById('cd-comment-author').value = ST.username || '';
    
    document.getElementById('cd-add-comment-btn').onclick = function() {
        const text = document.getElementById('cd-new-comment').value.trim();
        const author = document.getElementById('cd-comment-author').value.trim() || 'Anónimo';
        if(!text) return;
        
        const fileInput = document.getElementById('cd-comment-file');
        
        const saveComment = (fData, fName) => {
            let allItems = [];
            try { const result = localStorage.getItem(COMM_KEY); if (result) allItems = JSON.parse(result); } catch (e) { }
            const itemIndex = allItems.findIndex(i => i.id === currentCommId);
            if(itemIndex !== -1) {
                if(!allItems[itemIndex].comments) allItems[itemIndex].comments = [];
                allItems[itemIndex].comments.push({ id: Date.now(), text, author, ts: Date.now(), file: fData, fileName: fName, isMine: true });
                try {
                    localStorage.setItem(COMM_KEY, JSON.stringify(allItems));
                    document.getElementById('cd-new-comment').value = '';
                    if(fileInput) fileInput.value = '';
                    renderCommComments(allItems[itemIndex].comments);
                } catch(e) {
                    alert('Error: Archivo muy pesado. Límite de memoria alcanzado.');
                }
            }
        };

        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) { alert('Archivo muy pesado (Max 2MB).'); return; }
            const reader = new FileReader();
            reader.onload = function(e) { saveComment(e.target.result, file.name); };
            reader.readAsDataURL(file);
        } else {
            saveComment(null, null);
        }
    };
}

function renderCommComments(comments) {
    const cont = document.getElementById('cd-comments');
    if(!comments || comments.length === 0) {
        cont.innerHTML = '<div style="font-size:12px; color:var(--text3); font-style:italic;">No hay aportes todavía. Sé el primero.</div>';
        return;
    }
    cont.innerHTML = comments.map(c => {
        const fecha = new Date(c.ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        const fileHtml = c.file ? `<div style="margin-top:4px;"><a href="${c.file}" download="${c.fileName || 'archivo'}" style="font-size:11px; color:var(--blue); text-decoration:none;">📎 ${c.fileName || 'Descargar archivo adjunto'}</a></div>` : '';
        const actionsHtml = c.isMine ? `<div style="display:flex; gap:4px; margin-top:4px;"><button onclick="editComment(${c.id})" style="background:none; border:none; cursor:pointer; font-size:10px; color:var(--text3);" title="Editar">✏️</button><button onclick="deleteComment(${c.id})" style="background:none; border:none; cursor:pointer; font-size:10px; color:var(--red);" title="Borrar">✕</button></div>` : '';
        return `<div style="background:var(--bg2); border:1px solid var(--border); padding:6px 10px; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-size:10px; color:var(--text3); margin-bottom:2px;"><b>${c.author}</b> · ${fecha}</div>
                ${actionsHtml}
            </div>
            <div style="font-size:12px; color:var(--text); line-height:1.4;">${c.text}</div>
            ${fileHtml}
        </div>`;
    }).join('');
}


let editingTaskId = null;
function editTask(id) {
    const t = ST.tasks.find(x => x.id === id);
    if(!t) return;
    editingTaskId = id;
    document.getElementById('task-name').value = t.name;
    document.getElementById('task-mat').value = t.mat || '';
    document.getElementById('task-date').value = t.date || '';
    if(document.getElementById('task-prio')) document.getElementById('task-prio').value = t.prio || '2';
    
    document.getElementById('task-add-btn').style.display = 'none';
    document.getElementById('task-edit-btn').style.display = 'flex';
    goPage('tareas');
}

function saveEditTask() {
    if(!editingTaskId) return;
    const t = ST.tasks.find(x => x.id === editingTaskId);
    if(!t) return;
    
    const name = document.getElementById('task-name').value.trim();
    if (!name) return;
    
    t.name = name;
    t.mat = document.getElementById('task-mat').value;
    t.date = document.getElementById('task-date').value;
    t.prio = document.getElementById('task-prio') ? document.getElementById('task-prio').value : '2';
    
    document.getElementById('task-name').value = '';
    document.getElementById('task-mat').value = '';
    document.getElementById('task-date').value = '';
    
    document.getElementById('task-add-btn').style.display = 'flex';
    document.getElementById('task-edit-btn').style.display = 'none';
    
    editingTaskId = null;
    save(); 
    renderTasks();
}

let editingExamId = null;
function editExamen(id) {
    const e = ST.examenes.find(x => x.id === id);
    if(!e) return;
    editingExamId = id;
    document.getElementById('ex-n').value = e.n;
    document.getElementById('ex-m').value = e.m === 'General' ? '' : e.m;
    document.getElementById('ex-f').value = e.f;
    document.getElementById('ex-temas').value = e.temas || '';
    
    document.getElementById('exam-add-btn').style.display = 'none';
    document.getElementById('exam-edit-btn').style.display = 'flex';
    goPage('examenes');
}

function saveEditExamen() {
    if(!editingExamId) return;
    const e = ST.examenes.find(x => x.id === editingExamId);
    if(!e) return;
    
    const n = document.getElementById('ex-n').value.trim();
    const f = document.getElementById('ex-f').value;
    if (!n || !f) return;
    
    e.n = n;
    e.m = document.getElementById('ex-m').value || 'General';
    e.f = f;
    e.temas = document.getElementById('ex-temas').value.trim();
    
    document.getElementById('ex-n').value = '';
    document.getElementById('ex-m').value = '';
    document.getElementById('ex-f').value = '';
    document.getElementById('ex-temas').value = '';
    
    document.getElementById('exam-add-btn').style.display = 'flex';
    document.getElementById('exam-edit-btn').style.display = 'none';
    
    editingExamId = null;
    save(); 
    renderExamenes();
}


let editingCommId = null;
function editCommPublication() {
    let items = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) items = JSON.parse(result); } catch (e) { }
    const m = items.find(i => i.id === currentCommId);
    if(!m) return;
    
    editingCommId = m.id;
    document.getElementById('comm-titulo').value = m.titulo;
    document.getElementById('comm-autor').value = m.autor;
    document.getElementById('comm-materia').value = m.materia;
    document.getElementById('comm-tipo').value = m.tipo;
    document.getElementById('comm-link').value = m.link || '';
    document.getElementById('comm-desc').value = m.desc || '';
    
    // Cambiar botón de Publicar
    const btn = document.querySelector('button[onclick="subirMaterial()"]');
    if(btn) {
        btn.textContent = 'Guardar edición';
        btn.onclick = saveEditComm;
    }
    
    document.getElementById('comm-detail-modal').classList.remove('open');
    // Scroll to form
    document.querySelector('.page.active').scrollTo(0,0);
}

function saveEditComm() {
    const titulo = document.getElementById('comm-titulo').value.trim();
    const autor = document.getElementById('comm-autor').value.trim();
    const materia = document.getElementById('comm-materia').value;
    const tipo = document.getElementById('comm-tipo').value;
    const link = document.getElementById('comm-link').value.trim();
    const desc = document.getElementById('comm-desc').value.trim();
    const msg = document.getElementById('comm-msg');
    
    if (!titulo || !materia || !autor) {
        msg.style.display = 'block'; msg.style.color = 'var(--amber)'; msg.textContent = '⚠ Completá título, materia y nombre.'; return;
    }
    
    let items = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) items = JSON.parse(result); } catch (e) { }
    const itemIndex = items.findIndex(i => i.id === editingCommId);
    
    if(itemIndex !== -1) {
        items[itemIndex].titulo = titulo;
        items[itemIndex].autor = autor;
        items[itemIndex].materia = materia;
        items[itemIndex].tipo = tipo;
        items[itemIndex].link = link;
        items[itemIndex].desc = desc;
        
        try {
            localStorage.setItem(COMM_KEY, JSON.stringify(items));
            ['comm-titulo', 'comm-autor', 'comm-link', 'comm-desc'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('comm-materia').value = '';
            
            // Restaurar botón
            const btn = document.querySelector('button[onclick="saveEditComm()"]');
            if(btn) {
                btn.textContent = '↑ Publicar material';
                btn.onclick = subirMaterial;
            }
            
            msg.style.display = 'block'; msg.style.color = 'var(--green)'; msg.textContent = '✓ Edición guardada exitosamente.';
            setTimeout(() => { msg.style.display = 'none'; }, 4000);
            editingCommId = null;
            loadComunidad();
        } catch (e) {
            msg.style.display = 'block'; msg.style.color = 'var(--red)'; msg.textContent = '✗ Error al guardar.';
        }
    }
}


function deleteCommPublication() {
    if(!confirm('¿Seguro que querés borrar esta publicación?')) return;
    let items = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) items = JSON.parse(result); } catch (e) { }
    items = items.filter(i => i.id !== currentCommId);
    localStorage.setItem(COMM_KEY, JSON.stringify(items));
    document.getElementById('comm-detail-modal').classList.remove('open');
    loadComunidad();
}


let editingCommentId = null;

function deleteComment(cId) {
    if(!confirm('¿Borrar este aporte?')) return;
    let allItems = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) allItems = JSON.parse(result); } catch (e) { }
    const itemIndex = allItems.findIndex(i => i.id === currentCommId);
    if(itemIndex !== -1 && allItems[itemIndex].comments) {
        allItems[itemIndex].comments = allItems[itemIndex].comments.filter(c => c.id !== cId);
        localStorage.setItem(COMM_KEY, JSON.stringify(allItems));
        renderCommComments(allItems[itemIndex].comments);
    }
}

function editComment(cId) {
    let allItems = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) allItems = JSON.parse(result); } catch (e) { }
    const itemIndex = allItems.findIndex(i => i.id === currentCommId);
    if(itemIndex !== -1 && allItems[itemIndex].comments) {
        const c = allItems[itemIndex].comments.find(x => x.id === cId);
        if(!c) return;
        editingCommentId = cId;
        document.getElementById('cd-new-comment').value = c.text;
        
        const btn = document.getElementById('cd-add-comment-btn');
        btn.textContent = 'Guardar';
        btn.onclick = function() { saveEditComment(); };
    }
}

function saveEditComment() {
    const text = document.getElementById('cd-new-comment').value.trim();
    if(!text) return;
    
    let allItems = [];
    try { const result = localStorage.getItem(COMM_KEY); if (result) allItems = JSON.parse(result); } catch (e) { }
    const itemIndex = allItems.findIndex(i => i.id === currentCommId);
    if(itemIndex !== -1 && allItems[itemIndex].comments) {
        const cIndex = allItems[itemIndex].comments.findIndex(x => x.id === editingCommentId);
        if(cIndex !== -1) {
            allItems[itemIndex].comments[cIndex].text = text;
            // No editamos el archivo ni el autor por simplicidad en esta edición rápida
            localStorage.setItem(COMM_KEY, JSON.stringify(allItems));
            
            document.getElementById('cd-new-comment').value = '';
            editingCommentId = null;
            
            const btn = document.getElementById('cd-add-comment-btn');
            btn.textContent = 'Comentar';
            
            // Restore original onclick logic
            // Note: the original onclick has complex logic capturing the file input. 
            // The cleanest way is to just call openCommDetail again to re-wire everything and render
            openCommDetail(currentCommId);
        }
    }
}


// ── TEST MENSAJE 21:33 ──
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 21 && now.getMinutes() === 33) {
        if (!ST.testMessageShown) {
            ST.testMessageShown = true; // Para que no se spamee varias veces en el mismo minuto
            
            // Contar tareas creadas hoy
            const todayStr = now.toLocaleDateString();
            const tasksToday = ST.tasks.filter(t => new Date(t.id).toLocaleDateString() === todayStr);
            
            const cont = document.getElementById('dash-messages-container');
            if(cont) {
                let txt = '';
                if(tasksToday.length > 0) {
                    txt = `¡Hola! Son las 21:33. Hoy agregaste ${tasksToday.length} tarea(s): ` + tasksToday.map(t => t.name).join(', ') + '.';
                } else {
                    txt = `¡Hola! Son las 21:33. Hoy no agregaste ninguna tarea nueva. ¡Acordate de mantenerte al día!`;
                }
                
                const msgHtml = `<div class="msg-item" style="border-left: 3px solid var(--purple);">
                  <div style="font-size:10px;color:var(--purple);font-weight:600">Alerta de Prueba (21:33)</div>
                  <div style="font-size:12px;color:var(--text2);margin-top:3px">${txt}</div>
                </div>`;
                
                // Insert at the top of messages
                cont.insertAdjacentHTML('afterbegin', msgHtml);
            }
        }
    } else {
        // Reset the flag if time is no longer 21:33
        ST.testMessageShown = false;
    }
}, 5000); // Check every 5 seconds


/* ── INBOX / MENSAJES ── */
let currentInboxMessages = [];
let selectedMsgId = null;

function generateInboxData() {
    let allMsgs = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Auto generated system messages
    ST.examenes.forEach(e => {
        if(!e.f) return;
        const diff = Math.round((new Date(e.f + 'T00:00:00') - today) / 864e5);
        if(diff >= 0 && diff <= 7) {
            allMsgs.push({ id: 'sys_ex_'+e.id, type: 'exam', sender: 'Sistema', title: 'Examen Próximo', body: `Faltan ${diff} días para tu examen de ${e.n} (${e.m}).\n\n¡Aprovechá la técnica Pomodoro para estudiar!`, date: new Date().toISOString() });
        }
    });
    
    ST.tasks.filter(t => !t.done).forEach(t => {
        if(!t.date) return;
        const diff = Math.round((new Date(t.date + 'T00:00:00') - today) / 864e5);
        if(diff === 1) {
            allMsgs.push({ id: 'sys_tk_'+t.id, type: 'task', sender: 'Sistema', title: 'Tarea vence mañana', body: `No te olvides que "${t.name}" vence mañana.`, date: new Date().toISOString() });
        } else if (diff < 0) {
            allMsgs.push({ id: 'sys_tkv_'+t.id, type: 'task', sender: 'Sistema', title: 'Tarea Vencida', body: `La tarea "${t.name}" está atrasada. ¿Ya la completaste?`, date: new Date().toISOString() });
        }
    });
    
    // Direct messages
    if(ST.inbox) {
        ST.inbox.forEach(m => allMsgs.push(m));
    }
    
    // Sort by date descending
    allMsgs.sort((a,b) => new Date(b.date) - new Date(a.date));
    currentInboxMessages = allMsgs;
}

function renderInbox() {
    generateInboxData();
    const list = document.getElementById('inbox-list');
    if(!list) return;
    
    if(currentInboxMessages.length === 0) {
        list.innerHTML = `<div style="padding:16px; font-size:12px; color:var(--text3); text-align:center;">Bandeja vacía</div>`;
        document.getElementById('inbox-content').innerHTML = `<div class="inbox-empty"><svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:10px; opacity:0.5;"><path d="M2 4l6 4 6-4M2 4v8h12V4z"/></svg><div>Bandeja vacía</div></div>`;
        return;
    }
    
    list.innerHTML = currentInboxMessages.map(m => {
        const d = new Date(m.date);
        const dateStr = d.toLocaleDateString() === new Date().toLocaleDateString() ? 
            (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes() : 
            d.toLocaleDateString('es-AR', {day:'numeric', month:'short'});
            
        return `<div class="inbox-item ${selectedMsgId === m.id ? 'active' : ''}" onclick="viewMessage('${m.id}')">
            <div class="inbox-item-title"><span><b>${m.sender}</b></span> <span>${dateStr}</span></div>
            <div style="font-size:12px; font-weight:600; color:var(--text); margin-bottom:2px;">${m.title}</div>
            <div class="inbox-item-preview">${m.body}</div>
        </div>`;
    }).join('');
}

function viewMessage(id) {
    selectedMsgId = id;
    renderInbox(); // update active state
    
    const m = currentInboxMessages.find(x => x.id === id);
    if(!m) return;
    
    const d = new Date(m.date);
    const dateFull = d.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) + ' a las ' + (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();
    
    document.getElementById('inbox-content').innerHTML = `
        <div class="inbox-header">
            <div>
                <div style="font-size:18px; font-weight:600; color:var(--text); margin-bottom:4px;">${m.title}</div>
                <div style="font-size:12px; color:var(--text2);">De: <b>${m.sender}</b>${m.to ? ` &nbsp; Para: <b>${m.to}</b>` : ''}</div>
            </div>
            <div style="font-size:11px; color:var(--text3);">${dateFull}</div>
        </div>
        <div class="inbox-body">${m.body}</div>
    `;
}

function sendDirectMessage() {
    const to = document.getElementById('dm-to').value.trim();
    const subject = document.getElementById('dm-subject').value.trim();
    const body = document.getElementById('dm-body').value.trim();
    const msgEl = document.getElementById('dm-msg');
    
    if(!to || !subject || !body) {
        msgEl.style.display = 'block'; msgEl.style.color = 'var(--amber)'; msgEl.textContent = '⚠ Completá todos los campos.';
        return;
    }
    
    if(!ST.inbox) ST.inbox = [];
    // Simulamos que el destinatario recibe el mensaje en SU propia bandeja (lo guardamos en local)
    ST.inbox.push({
        id: 'dm_' + Date.now(),
        type: 'dm',
        sender: ST.username || 'Vos',
        to: to,
        title: subject,
        body: body,
        date: new Date().toISOString()
    });
    
    save();
    
    document.getElementById('dm-to').value = '';
    document.getElementById('dm-subject').value = '';
    document.getElementById('dm-body').value = '';
    
    msgEl.style.display = 'block'; msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Mensaje enviado a ' + to + '.';
    
    renderInbox();
    
    setTimeout(() => { 
        msgEl.style.display = 'none'; 
        document.getElementById('new-msg-modal').classList.remove('open');
    }, 1500);
}

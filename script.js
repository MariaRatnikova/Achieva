/*****************************************************************
 *  Achieva  –  Haupt-Skript
 *  =============================================================
 *  Enthält:
 *   • To-Do-Logik  (Kategorien + Tasks)
 *   • Kalender (Monat ↔ Woche)
 *   • Schedule-Ansicht (FullCalendar – Tagesraster)
 *   • Dialoge  (Task, Category, Event)
 *
 *  Alle Funktionen kommen **genau einmal** vor – keine Duplikate!
 *****************************************************************/

/* =============================================================
   0) Hilfsfunktionen & Shortcuts
   ============================================================= */
   const $  = sel => document.querySelector(sel);        // schlanker QS
   const $$ = sel => document.querySelectorAll(sel);     // schlanker QSA
   const uuid     = () => crypto.randomUUID();           // eindeutige ID
   const todayISO = () => new Date().toISOString().split('T')[0];
   const lblWeekDate = $('#weekDateLabel');
   /* =============================================================
      1) Lokale Daten (todoData.json) laden & speichern
      ============================================================= */
   const LOCAL_KEY = 'todoData';   // Key im localStorage
   let   store     = null;         // globaler Speicher (Objekt)
   
   /**
    * Lädt die To-Do-Struktur
    * – zuerst aus localStorage (wenn vorhanden)
    * – sonst Fallback-Datei todoData.json und speichert sie lokal
    */
   async function prepareAppData () {
     if (!localStorage.getItem(LOCAL_KEY)) {
       store = await fetch('todoData.json').then(r => r.json());
       localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
     } else {
       store = JSON.parse(localStorage.getItem(LOCAL_KEY));
     }
   }
   const save = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
   
   /* ============================================
      2) App-Start (wenn To-Do-Screen gezeigt wird)
      ============================================ */
   let visibleBlocks = 1;          // wie viele Kategorie-Boxen werden angezeigt?
   
   function initApp () {
   
     /* heutiges Datum in den Start-Screen schreiben ---------------- */
     const t = new Date();
     $('#dayName').textContent  = t.toLocaleDateString('en-US', { weekday : 'long' });
     $('#fullDate').textContent = t.toLocaleDateString('en-US', { month   : 'long',
                                                                   day     : 'numeric',
                                                                   year    : 'numeric' });
   
     renderBoard();   // To-Do-Spalten
     bindUI();        // alle Klick-Handler
   }
   
   /* =============================================================
      3) Board (alle sichtbaren Kategorien) rendern
      ============================================================= */
   function renderBoard () {
   
     /* Board-Container nur einmal anlegen ------------------------- */
     const board = $('#board') ?? (() => {
       const d = document.createElement('div');
       d.id = 'board';
       $('.ToDo-Screen').insertBefore(d, $('#addCatBtn'));
       return d;
     })();
   
     board.innerHTML = '';    // alles leer → neu zeichnen
   
     /* nur die ersten N (=visibleBlocks) Kategorien zeigen -------- */
     store.categories
          .slice(0, visibleBlocks)
          .forEach(cat => board.appendChild(renderCategory(cat)));
   
     updateOpenTaskCounter(); // Zahl im Start-Screen aktualisieren
   }
   
   /** Zähler "x tasks today" im Start-Screen */
   function updateOpenTaskCounter () {
     const open = store.categories.flatMap(c => c.tasks.filter(t => !t.done));
     $('#taskCount').textContent = `${open.length} task${open.length!==1?'s':''}`;
   }
   
   /* -----------------------------------------------------------------
      3.1) Eine Kategorie-Box zeichnen
      -----------------------------------------------------------------*/
   function renderCategory (cat) {
   
     const box = document.createElement('section');
     box.className     = 'todo-box';
     box.dataset.catId = cat.id;
   
     /* Grundgerüst – Select + zwei UL-Listen ---------------------- */
     box.innerHTML = /*html*/`
         <select class="category-select"></select>
   
         <h3 class="title todo-h">To Do</h3>
         <ul class="task-list todo-list"></ul>
   
         <h3 class="title done-h">Done</h3>
         <ul class="task-list done-list"></ul>
     `;
   
     /* Select befüllen ------------------------------------------- */
     const sel = box.querySelector('.category-select');
     sel.innerHTML = store.categories
        .map(c => `<option value="${c.id}" ${c.id===cat.id?'selected':''}>${c.name}</option>`)
        .join('');
   
     /* Kategorie-Wechsel im Select → Box durch neue ersetzen ------ */
     sel.onchange = e => {
       const newCat = store.categories.find(c => c.id === e.target.value);
       if (newCat) box.replaceWith(renderCategory(newCat));
     };
   
     /* Long-Press auf Box (600 ms) → löschen/ausblenden ----------- */
     let pressID = null;
     const startPress = () => pressID = setTimeout(() => deleteOrHideCategory(cat.id), 600);
     const stopPress  = () => clearTimeout(pressID);
     ['mousedown','touchstart'].forEach(ev => box.addEventListener(ev, startPress));
     ['mouseup','mouseleave','touchend','touchcancel']
           .forEach(ev => box.addEventListener(ev, stopPress));
   
     /* Referenzen auf UL-Listen */
     const ulTodo = box.querySelector('.todo-list');
     const ulDone = box.querySelector('.done-list');
   
     /* alle Tasks einer Kategorie durchgehen ---------------------- */
     cat.tasks.forEach(task => {
   
       const li = document.createElement('li');
       li.innerHTML = /*html*/`
           <label>
             <input type="checkbox" ${task.done?'checked':''}>
             <span class="task-wrap">
               <span class="task-text">${task.text}</span>
               ${task.date ? `<span class="task-date">${task.date}</span>` : ''}
             </span>
           </label>`;
   
       /* Checkbox an/aus → Task wandert in andere Liste ----------- */
       li.querySelector('input').onchange = e => {
         task.done        = e.target.checked;
         task.completedAt = task.done ? todayISO() : undefined;
         save();
   
         (task.done ? ulDone : ulTodo).appendChild(li);
         toggleHeadings(box, ulTodo, ulDone);
         updateOpenTaskCounter();
       };
   
       /* Long-Press auf Task (600 ms) → löschen ------------------- */
       let tID=null;
       const s = () => tID = setTimeout(()=>deleteTask(cat.id, task.id),600);
       const x = () => clearTimeout(tID);
       ['mousedown','touchstart'].forEach(ev=>li.addEventListener(ev,s));
       ['mouseup','mouseleave','touchend','touchcancel']
             .forEach(ev=>li.addEventListener(ev,x));
   
       (task.done?ulDone:ulTodo).appendChild(li);
     });
   
     /* Überschriften ggf. verstecken ------------------------------ */
     toggleHeadings(box, ulTodo, ulDone);
     return box;
   }
   
   /** Blendet "To Do" / "Done" nur ein, wenn Liste Inhalt hat */
   function toggleHeadings (box, ulTodo, ulDone) {
     box.querySelector('.todo-h').style.display = ulTodo.children.length ? '' : 'none';
     box.querySelector('.done-h').style.display = ulDone.children.length ? '' : 'none';
   }
   
   /* --------------------------------------------------------------
      3.x) Löschen oder Verstecken einer Kategorie
      -------------------------------------------------------------- */
   function deleteOrHideCategory (catId) {
     const really = confirm('Delete category permanently?\nCancel = hide only.');
     if (really) {
       store.categories = store.categories.filter(c => c.id !== catId);
       visibleBlocks    = Math.min(visibleBlocks, store.categories.length);
       save(); renderBoard();
     } else {
       document.querySelector(`[data-cat-id="${catId}"]`)?.classList.add('hidden');
     }
   }
   
   /** einzelnes Task löschen */
   function deleteTask (catId, taskId) {
     if (!confirm('Delete this task?')) return;
     const cat = store.categories.find(c => c.id === catId);
     cat.tasks = cat.tasks.filter(t => t.id !== taskId);
     save(); renderBoard();
   }
   
   /* =============================================================
      4) UI-Events & Dialoge
      ============================================================= */
   function bindUI () {
   
     /* --------- Haupt-Buttons ---------------------------------- */

     const addBlock = $('#addCatBtn');    // "+ Add Category"
   
     /** zeigt eine Box mehr (bis alle Kategorien sichtbar sind) */
     addBlock.onclick = () => {
       if (visibleBlocks < store.categories.length) {
         visibleBlocks++; renderBoard();
       }
     };
   

     /* Klick irgendwo anders → Menü schließen */
     document.addEventListener('click', ev => {
       if (!fabMenu.contains(ev.target) && ev.target !== fab)
           fabMenu.classList.add('hidden');
     }, true);
   
     /* ---------- Formular-Submit-Handler ------------------------ */
     $('#catForm').addEventListener('submit', e => {
       e.preventDefault();            // <submit> nicht neu laden
       if (document.activeElement?.classList.contains('create'))
           addCategoryFromDialog();
       $('#catDlg').close();
     });
   
     $('#taskForm').addEventListener('submit', e => {
       e.preventDefault();
       addTaskFromDialog();
       $('#taskModal').classList.add('hidden');
     });
   
     /** Cancel-Button im Task-Dialog */
     $('#cancelTask').addEventListener('click', () =>
           $('#taskModal').classList.add('hidden'));
   }
   
   /* ------------- Dialog-Helfer ------------------------------- */
   function openRealCategoryDialog () {
    const input = document.getElementById('catName');
    const dialog = document.getElementById('catDlg');
  
    input.value = '';                   
    dialog.classList.remove('hidden'); 
    dialog.showModal();              
  }
   /** Task-Dialog öffnen; Datum = aktuell ausgewählter Tag */
   function openTaskDialog () {
     $('#taskTitle').value = '';
     const d = new Date(viewDate); d.setDate(selDay);
     $('#taskDate').value = d.toISOString().split('T')[0];
   
     /* Select mit „— no category —“ + alle Kategorien */
     const options = store.categories
           .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
     $('#taskCategory').innerHTML = `<option value="">— no category —</option>` + options;
   
     $('#taskModal').classList.remove('hidden');
   }
   
   /** Event-Dialog (Schedule) öffnen */
   function openEventDialog () {
     const d = new Date(viewDate); d.setDate(selDay);
     $('#evTitle').value = '';
     $('#evDate').value  = d.toISOString().split('T')[0];
     $('#evStart').value = '09:00';
     $('#evEnd').value   = '10:00';
     $('#eventDlg').showModal();
     const dlg = $('#eventDlg');      // <dialog id="eventDlg">
     dlg.classList.remove('hidden');  
     dlg.showModal(); 
   }
    /** Deadline öffnen */
   function openDeadlineDialog(){
    $('#dlTitle').value = '';
    $('#dlDate').value  = todayISO();
    $('#dlColor').value = '#fd9679';
    $('#dlDlg').classList.remove('hidden');
    $('#dlDlg').showModal();
  }
   /* --------------------------------------------------------------
      4.x) Daten aus Dialogen übernehmen
      -------------------------------------------------------------- */
   function addCategoryFromDialog () {
     const name = $('#catName').value.trim();
     if (!name) { flashInput('#catName'); return; }
   
     const newCat = { id: uuid(), name, tasks: [] };
     store.categories.push(newCat);
     save();
   
     updateAllCategorySelects(newCat);   // Select-Listen nachpflegen
     updateOpenTaskCounter();
   }
   
   /** Fügt neue Option in **alle** Category-Selects ein */
   function updateAllCategorySelects ({id, name}) {
     $$('.category-select').forEach(sel => {
       sel.insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
     });
     $('#taskCategory')?.insertAdjacentHTML('beforeend',
            `<option value="${id}">${name}</option>`);
   }
   
   /** Task aus Dialog speichern */
   function addTaskFromDialog () {
     const title = $('#taskTitle').value.trim();
     const date  = $('#taskDate').value;
     const cid   = $('#taskCategory').value;
   
     if (!title) { flashInput('#taskTitle'); return; }
   
     store.categories
          .find(c => c.id === cid)
          .tasks.push({ id: uuid(), text: title,
                        date: date || undefined, done: false });
   
     save(); renderBoard();
   }
   
   /** Minimale Fehlermeldung – roter Hinweis unter Input */
   function flashInput (sel) {
     const el  = $(sel);
     let err   = el.nextElementSibling;
     if (!err || !err.classList.contains('input-error')) {
       err = document.createElement('div');
       err.className = 'input-error';
       err.style.cssText = 'color:#b00;font-size:11px;margin-top:4px';
       el.after(err);
     }
     err.textContent = 'Please fill out this field.';
     err.style.display = 'block';
     setTimeout(() => err.style.display = 'none', 2000);
   }
   
   /* =============================================================
   5) Navigation (Login → Start → To-Do → Calendar)
   ============================================================= */
window.addEventListener('DOMContentLoaded', () => {

    /* ▸ 1. Wurzel-Screens einsammeln ------------------------- */
    const login = $('#loginScreen');
    const start = $('#startScreen');
    const todo  = $('#todoScreen');
    const cal   = $('#calenderScreen');   
  
    /** Seitenumschalter mit Taskbar-Aktualisierung */
function show(scr){
    [login, start, todo, cal].forEach(s => s.classList.toggle('hidden', s !== scr));
  
    // Aktiver Taskbar-Button je nach Screen
    const name = scr.id === 'calenderScreen' ? 'calendar'
               : 'home';
  
    // Alle Taskbars aktualisieren (nur nötig, wenn in jedem Screen eigener Taskbar steht)
    document.querySelectorAll('task-bar .nav-item').forEach(nav=>{
      nav.classList.toggle('active', nav.dataset.page === name);
    });
  }
    /* ▸ 3. Login → Start -------------------------------------- */
    $('.LogIn' ).addEventListener('click', () => show(start));
    $('.SignUp').addEventListener('click', () => show(start));
  
    /* ▸ 4. Start → To-Do (mit Daten-Init) ---------------------- */
    $('.todo-button').addEventListener('click', () => {
      show(todo);
      prepareAppData().then(initApp);
    });
   
    /* ▸ 5. Task-Bar: Home / Calendar -------------------------- */
    document.addEventListener('click', ev => {
      const tgt = ev.target.closest('.nav-item');
      if(!tgt) return;
  
      switch (tgt.dataset.page) {
        case 'home'    : show(start); break;
        case 'calendar': show(cal);   break;
        /* für modules / uploads analog … */
      }
    });
    [
        { button: '#fabBtnTodo', menu: '#fabMenuTodo' },
        { button: '#fabBtnCal',  menu: '#fabMenuCal' }
      ].forEach(({button, menu}) => {
        const btn  = document.querySelector(button);
        const menuEl = document.querySelector(menu);
        if (!btn || !menuEl) return;
      
        btn.addEventListener('click', () => {
          menuEl.classList.toggle('hidden');
        });
      });
      ['#fabMenuTodo', '#fabMenuCal'].forEach(sel => {
        const menu = document.querySelector(sel);
        if (!menu) return;                       
      
        menu.addEventListener('click', e => {
          const action = e.target.dataset.action;  // task / cat / event
          menu.classList.add('hidden');            
      
          switch (action) {
            case 'task':   openTaskDialog();        break;
            case 'cat':    openRealCategoryDialog();break;
            case 'event':  openEventDialog();       break;
            case 'deadline': openDeadlineDialog();     break;
          }
        });
      });
      $('#dlForm').addEventListener('submit', e=>{
        e.preventDefault();
        const dl = {
          id   : uuid(),
          title: $('#dlTitle').value.trim(),
          module: $('#dlModule').value,
          date : $('#dlDate').value,
          color: $('#dlColor').value        // hex код
        };
        if(!dl.title) return;
        deadlines.push(dl);
        localStorage.setItem('deadlines', JSON.stringify(deadlines));
    
        $('#dlDlg').close();
        renderCalendar();
        refreshDeadlines();
      });
   
    /* ▸ 6. Task-Bar im Login ausblenden ----------------------- */
    $('body > task-bar')?.classList.add('hidden');
  });
  
   
   /* =============================================================
      6) Kalender + Schedule (gemeinsam)
      ============================================================= */
   /* ---------- Referenzen & Konstanten -------------------------- */
   const btnTasks    = $('#btnTasks');
   const btnSchedule = $('#btnSchedule');
   const paneTasks   = $('#dayTasks');
   const toggleBtn   = $('#toggleViewBtn');
   const daysBox     = $('.calendar-dates');
   const calHeadTxt  = $('.calendar-current-date');
   const calBox      = $('.calendar-container');
   const navPrev     = $('#calendar-prev');
   const navNext     = $('#calendar-next');
   
   const months = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
   const wDays  = ['S','M','T','W','T','F','S'];
   
   let view      = 'month';          // aktueller Kalender-Modus
   let viewDate  = new Date();       // Monat / Woche, die gezeigt wird
   let selDay    = viewDate.getDate();  // markierter Tag innerhalb viewDate-Monats
   
   /* ---------- externe Tasks (für Day-Tasks-Pane) --------------- */
   let extReady = false;
   let extTasks = [];                // aus tasks.json laden
   fetch('tasks.json')
     .then(r => r.json())
     .then(d => { extTasks = Array.isArray(d)?d:(d.tasks||[]); extReady=true; })
     .catch(console.error);
     /* ---------- DEADLINES --------------------------- */
    let dlReady = false;
    let deadlines = [];                

fetch('deadlines.json')
  .then(r => r.json())
  .then(d => { deadlines = d.deadlines || []; dlReady = true; refreshDeadlines(); })
  .catch(console.error);
   
   /* ---------- Tab-Wechsel Tasks / Schedule --------------------- */
   btnTasks.addEventListener   ('click',()=>switchTab('tasks'));
   btnSchedule.addEventListener('click',()=>switchTab('schedule'));
   toggleBtn.addEventListener  ('click',()=> view==='month'
                                        ? switchTab('tasks')
                                        : expandMonth() );
   
   /** wechselt zwischen "Tasks"- und "Schedule"-Pane (immer Week-View) */
   function switchTab(which){
     const isTasks = (which==='tasks');
   
     view = 'week';
     toggleBtn.classList.add('rotated');
     const maxDayInMonth = new Date(viewDate.getFullYear(),
     viewDate.getMonth()+1,0).getDate();
    if(selDay > maxDayInMonth) selDay = maxDayInMonth;
     btnTasks   .classList.toggle('active', isTasks);
     btnSchedule.classList.toggle('active',!isTasks);
   
     paneTasks           .style.display = isTasks ? 'block':'none';
     $('#schedule-view') .style.display = isTasks ? 'none' :'block';
   
     renderCalendar();
     updateWeekDateLabel();
     refreshDeadlines(); 
     isTasks ? refreshDayTasks() : refreshSchedule();
   }
   
   /** schaltet zurück auf Monatsansicht */
   function expandMonth(){
     view = 'month';
     toggleBtn.classList.remove('rotated');
     paneTasks.style.display = 'none';
     renderCalendar();
     updateWeekDateLabel();
   }
   
   /* ---------- Kalender zeichnen (Monat / Woche) --------------- */
   function renderCalendar(){
     calBox.classList.toggle('week', view==='week');
     view==='month' ? renderMonth() : renderWeek();
   }
   
   function renderMonth(){
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y,m,1).getDay();
    const lastD = new Date(y,m+1,0).getDate();
    const lastW = new Date(y,m,lastD).getDay();
    const prevL = new Date(y,m,0).getDate();
    let html = '';
  
    /* ▸ Tage des Vormonats (grau ausgeblendet) */
    for(let i=first;i>0;i--) html += `<li class="inactive">${prevL-i+1}</li>`;
  
    /* ▸ Tage dieses Monats */
    for(let d=1; d<=lastD; d++){
      const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dl = deadlines.find(x=>x.date===iso);
      const dls = deadlines.filter(dl => dl.date === iso);  
        const hasDL = dls.length > 0;
        const grad  = hasDL ? pieGradient(dls.slice(0,3).map(dl=>dl.color)) : '';

        const classes = [
        isToday(y,m,d) ? 'active'    : '',
        d===selDay     ? 'highlight' : '',
        hasDL          ? 'deadline-ring' : ''
        ].join(' ');

        const style = hasDL
                    ? `style="--dl-grad:${grad}; --dl-color:${dls[0].color}"`
                    : '';
        html += `<li class="${classes}" ${style} data-day="${d}">${d}</li>`;
            }
        
    /* ▸ Tage des Folgemonats */
    for(let i=lastW; i<6; i++) html += `<li class="inactive">${i-lastW+1}</li>`;
  
    calHeadTxt.textContent = `${months[m]} ${y}`;
    daysBox.innerHTML = html;
    bindDayClicks();
  }
  
   
  function renderWeek () {

    /* ― 1. Sonntag der Woche ― */
    const start = new Date(viewDate);
    start.setDate(viewDate.getDate() - viewDate.getDay());
  
    let html = '';
  
    /* ― 2. sieben Tage bauen ― */
    for (let i = 0; i < 7; i++) {
  
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
  
      const y   = cur.getFullYear();
      const m   = cur.getMonth();
      const d   = cur.getDate();
  
      const iso = cur.toISOString().split('T')[0];
      const dl  = deadlines.find(dl => dl.date === iso);
  
      const dls = deadlines.filter(dl => dl.date === iso);  // все дедлайны дня
        const hasDL = dls.length > 0;
        const grad  = hasDL ? pieGradient(dls.slice(0,3).map(dl=>dl.color)) : '';

        const classes = [
        isToday(y,m,d) ? 'active'    : '',
        d===selDay     ? 'highlight' : '',
        hasDL          ? 'deadline-ring' : ''
        ].join(' ');

        const style = hasDL
                    ? `style="--dl-grad:${grad}; --dl-color:${dls[0].color}"`
                    : '';
        html += `<li class="${classes}" ${style} data-day="${d}">${d}</li>`;
    }
  
    /* ― 3. DOM + Überschrift ― */
    calHeadTxt.textContent =
        `${months[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  
    daysBox.innerHTML = html;
    bindDayClicks();
  }
   /* ---------- Klick auf Tag ------------------------------ */
   function bindDayClicks(){
     daysBox.querySelectorAll('li:not(.inactive)').forEach(li=>{
       li.onclick=()=>{
         daysBox.querySelector('.highlight')?.classList.remove('highlight');
         li.classList.add('highlight');
         selDay=+li.dataset.day;
         btnTasks   .classList.contains('active') && refreshDayTasks();
         btnSchedule.classList.contains('active') && refreshSchedule();
         updateWeekDateLabel();
         refreshDeadlines(); 
       };
     });
   }
   
   /* ---------- Day-Tasks-Pane füllen ----------------------- */
   function refreshDayTasks(){
     if(view!=='week'||!extReady) return;
   
     const wrap=paneTasks; wrap.innerHTML='';
   
     const d=new Date(viewDate); d.setDate(selDay);
     const iso=d.toISOString().split('T')[0];
   
     /* externe tasks.json */
     const ext=extTasks.filter(t=>t.date===iso);
     if(ext.length) wrap.appendChild(makeList(ext.map(t=>t.title||t.text||t.name)));
   
     /* To-Do-Listen */
     const todoData=JSON.parse(localStorage.getItem('todoData')||'{"categories":[]}');
     todoData.categories
       .map(c=>({name:c.name,items:(c.tasks||[]).filter(t=>!t.done&&t.date===iso)}))
       .filter(c=>c.items.length)
       .forEach(c=>{
         wrap.insertAdjacentHTML('beforeend',`<h4 class="task-cat">${c.name}</h4>`);
         wrap.appendChild(makeList(c.items.map(t=>t.text)));
       });
   
     if(!wrap.children.length) wrap.innerHTML='<p class="no-tasks-msg">No deadlines today</p>';
   }
   
   /** erzeugt UL-Liste mit Checkboxen (read-only) */
   function makeList(arr){
     const ul=document.createElement('ul'); ul.className='task-list';
     arr.forEach(txt=>ul.insertAdjacentHTML('beforeend',`
       <li><label>
         <input type="checkbox">
         <span class="task-wrap"><span class="task-text">${txt}</span></span>
       </label></li>`));
     return ul;
   }
   
   /* ---------- Pfeil-Navigation Monat/Woche ---------------- */
   navPrev.addEventListener('click',()=>changePage(-1));
   navNext.addEventListener('click',()=>changePage( 1));
   
   function changePage(delta){
     if(view==='month') viewDate.setMonth(viewDate.getMonth()+delta);
     else               viewDate.setDate(viewDate.getDate()+delta*7);
     renderCalendar();
     updateWeekDateLabel();
     refreshDayTasks();
     refreshSchedule();
     refreshDeadlines(); 
   }
   
   /* ---------- Hilfsfunktionen Datum ----------------------- */
   const isToday   =(y,m,d)=>{const t=new Date();
     return t.getFullYear()===y&&t.getMonth()===m&&t.getDate()===d;};
   const isSameDay =(a,b)=>a.toDateString()===b.toDateString();
   
   /* =============================================================
      7) FullCalendar  (Schedule-Pane)
      ============================================================= */
   let fc=null;  
   
   /** zeigt Schedule-Ansicht für gegebenes ISO-Datum */
   function showSchedule(dateISO){
     const node=$('#schedule-view');
     if(!fc){
       fc=new FullCalendar.Calendar(node,{
         initialView    :'timeGridDay',
         slotMinTime    :'00:00:00',
         slotMaxTime    :'23:00:00',
         allDaySlot     :false,
         headerToolbar  :false,
         dayHeaders     :false,
         height         :'auto',
         eventTimeFormat:{hour:'2-digit',minute:'2-digit',hour12:false},
         slotLabelFormat:{hour:'2-digit',minute:'2-digit',hour12:false},
         events         :'schedule_data.json'
       });
       fc.render();
     }
     fc.gotoDate(dateISO);
   }
   
   /** Aktualisiert Schedule-Pane, falls es sichtbar ist */
   function refreshSchedule(){
     if(btnSchedule.classList.contains('active')){
       const d=new Date(viewDate); d.setDate(selDay);
       showSchedule(d.toISOString().split('T')[0]);
     }
   }
   
   /* =============================================================
      8) Dialog  —  neues Event anlegen
      ============================================================= */
   $('#eventForm')?.addEventListener('submit',e=>{
     e.preventDefault();
     const ev={
       title : $('#evTitle').value.trim(),
       start : `${$('#evDate').value}T${$('#evStart').value}`,
       end   : `${$('#evDate').value}T${$('#evEnd').value}`
     };
     if(!ev.title) return;   // leere Titel ignorieren
     fc?.addEvent(ev);       // sofort im Kalender anzeigen
     $('#eventDlg').close();
   });
   /**
 * Füllt den Deadline-Container unter dem Kalender.
 * Zeigt zu jedem Deadline-Objekt Titel + Modul in Pastell-Farbe.
 */
function refreshDeadlines(){

    if (!dlReady) return;                       // JSON noch nicht geladen
  
    const box = $('#deadlineContainer');
    box.innerHTML = '';                         // alles löschen
  
    // ISO-String des selektierten Datums bilden
    const d   = new Date(viewDate); d.setDate(selDay);
    const iso = d.toISOString().split('T')[0];
  
    // alle Deadlines für diesen Tag
    const list = deadlines.filter(dl => dl.date === iso);
  
    if (!list.length){
      // keine Deadlines – Platzhalter
      box.innerHTML =
        '<p class="no-deadlines">No deadlines today</p>';
      return;
    }
  
    /* ► Deadline-Karten anlegen
       · farbiger Balken links (6 px) nimmt exakt die Deadline-Farbe
       · rechts daneben: Titel fett, Modul darunter kleiner         */
    list.forEach(dl => {
      box.insertAdjacentHTML('beforeend', `
        <div class="deadline-item"
             style="border-left:6px solid ${dl.color}">
          <strong>${dl.title}</strong><br>
          <span style="font-size:13px">${dl.module}</span>
        </div>`);
    });
  }
  /**
 * Zeigt das aktuell gewählte Datum (Week-View) rechts in der Top-Bar.
 * Im Month-View wird das Label ausgeblendet.
 */
  function updateWeekDateLabel () {

    
    const cal      = document.getElementById('calenderScreen');
    const nameScr  = cal.querySelector('.name-screen');
    const dateInfo = cal.querySelector('.date-info');
  
    if (view === 'week') {
      const d = new Date(viewDate); d.setDate(selDay);
      cal.querySelector('#weekDayLabel').textContent  =
          d.toLocaleDateString('en-US', { weekday:'long' });
      cal.querySelector('#weekDateLabel').textContent =
          d.toLocaleDateString('en-US',
                               { day:'numeric', month:'long', year:'numeric' });
  
      nameScr .classList.add   ('hidden');   // «Calendar» verschwinden
      dateInfo.classList.remove('hidden');   // Datum zeigen
    } else {
      nameScr .classList.remove('hidden');
      dateInfo.classList.add   ('hidden');
    }
  }
  function pieGradient(colors){
    const n = colors.length;
    if(n === 1) return colors[0];          
    const slice = 360 / n;               
    
    return 'conic-gradient(' + colors
      .map((c,i)=>`${c} ${i*slice}deg ${(i+1)*slice}deg`)
      .join(', ') + ')';
  }
  
  
   /* =============================================================
      9) Initialer Kalender-Render (Monatsansicht)
      ============================================================= */
   renderCalendar();   // sofort beim ersten Laden
/* ==============================================================
   Achieva – Haupt-Skript (Plain JS)  
   • ausführliche deutsche Kommentare  
   • keine Frameworks, keine externen Abhängigkeiten
   ============================================================== */

/* --------------------------------------------------------------
   0) kleine Helfer & Shortcuts
   -------------------------------------------------------------- */
   const $  = sel => document.querySelector(sel);
   const $$ = sel => document.querySelectorAll(sel);
   const uuid     = () => crypto.randomUUID();
   const todayISO = () => new Date().toISOString().split('T')[0];
   
   /* --------------------------------------------------------------
      1) Daten laden / speichern
      -------------------------------------------------------------- */
   const LOCAL_KEY = 'todoData';
   let   store     = null;          // globaler Speicher (Objekt aus todoData.json)
   
   /* erste Datenbeschaffung: erst localStorage → sonst Fallback-Datei */
   async function prepareAppData () {
     if (!localStorage.getItem(LOCAL_KEY)) {
       store = await fetch('todoData.json').then(r => r.json());
       localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
     } else {
       store = JSON.parse(localStorage.getItem(LOCAL_KEY));
     }
   }
   const save = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
   
   /* --------------------------------------------------------------
      2) allgemeine Initialisierung (je Aufruf To-Do-Screen)
      -------------------------------------------------------------- */
   let visibleBlocks = 1;           // wie viele todo-Boxen sind sichtbar?
   
   function initApp () {
   
     /* heutiges Datum in den Start-Screen schreiben */
     const t = new Date();
     $('#dayName').textContent  =
         t.toLocaleDateString('en-US', { weekday : 'long' });
     $('#fullDate').textContent =
         t.toLocaleDateString('en-US', { month   : 'long',
                                         day     : 'numeric',
                                         year    : 'numeric' });
   
     renderBoard();
     bindUI();
   }
   
   /* --------------------------------------------------------------
      3) Board (= alle sichtbaren Kategorien) zeichnen
      -------------------------------------------------------------- */
   function renderBoard () {
   
     /* Board-Container nur ein einziges Mal anlegen  */
     const board = $('#board') ?? (() => {
       const d   = document.createElement('div');
       d.id      = 'board';
       d.style.width = '100%';
       $('.ToDo-Screen').insertBefore(d, $('#addCatBtn'));
       return d;
     })();
   
     board.innerHTML = '';
   
     /* nur die ersten N (=visibleBlocks) Kategorien anzeigen */
     store.categories
          .slice(0, visibleBlocks)
          .forEach((cat, i) => {
            const box = renderCategory(cat);
            box.style.marginBottom = '32px';   // vertikaler Abstand
            board.appendChild(box);
          });
   
     /* Zähler im Start-Screen aktualisieren */
     updateOpenTaskCounter();
   }
   
   function updateOpenTaskCounter () {
     const open = store.categories
                       .flatMap(c => c.tasks.filter(t => !t.done));
     $('#taskCount').textContent =
          `${open.length} task${open.length !== 1 ? 's' : ''}`;
   }
   
   /* --------------------------------------------------------------
      3.1) Einzelne Kategorie (todo-Box) zeichnen
      -------------------------------------------------------------- */
   function renderCategory (cat) {
   
     const box = document.createElement('section');
     box.className     = 'todo-box';
     box.dataset.catId = cat.id;
   
     /* Grundgerüst -------------------------------------------------- */
     box.innerHTML = /*html*/`
         <select class="category-select"></select>
   
         <h3 class="title todo-h">To Do</h3>
         <ul class="task-list todo-list"></ul>
   
         <h3 class="title done-h">Done</h3>
         <ul class="task-list done-list"></ul>
     `;
   
     /* Select mit allen Kategorien füllen --------------------------- */
     const sel = box.querySelector('.category-select');
     sel.innerHTML = store.categories
        .map(c => `<option value="${c.id}" ${c.id === cat.id ? 'selected' : ''}>
                     ${c.name}
                   </option>`).join('');
   
     /* Wechsel der Auswahl → derselbe Block wird ersetzt  */
     sel.onchange = e => {
       const newCat = store.categories.find(c => c.id === e.target.value);
       if (newCat) box.replaceWith( renderCategory(newCat) );
     };
   
     /* Long-Press auf Box → löschen / verstecken -------------------- */
     let pressID = null;
     const pressStart = () =>
           pressID = setTimeout(() => deleteOrHideCategory(cat.id), 600);
     const pressStop  = () => clearTimeout(pressID);
     ['mousedown','touchstart'].forEach(ev => box.addEventListener(ev, pressStart));
     ['mouseup','mouseleave','touchend','touchcancel']
           .forEach(ev => box.addEventListener(ev, pressStop));
   
     /* Listen-Referenzen */
     const ulTodo = box.querySelector('.todo-list');
     const ulDone = box.querySelector('.done-list');
   
     /* alle Tasks rendern ------------------------------------------- */
     cat.tasks.forEach(task => {
       const li = document.createElement('li');
       li.innerHTML = /*html*/`
           <label>
             <input type="checkbox" ${ task.done ? 'checked' : '' }>
             <span class="task-wrap">
               <span class="task-text">${ task.text }</span>
               ${ task.date ? `<span class="task-date">${task.date}</span>` : '' }
             </span>
           </label>
       `;
   
       /* Checkbox toggeln → nur verschieben, Board NICHT neu bauen  */
       li.querySelector('input').onchange = e => {
         task.done        = e.target.checked;
         task.completedAt = task.done ? todayISO() : undefined;
         save();
   
         (task.done ? ulDone : ulTodo).appendChild(li);
         toggleHeadings(box, ulTodo, ulDone);
         updateOpenTaskCounter();
       };
   
       /* Long-Press auf Task → löschen ----------------------------- */
       let tID = null;
       const s = () => tID = setTimeout(() => deleteTask(cat.id, task.id), 600);
       const x = () => clearTimeout(tID);
       ['mousedown','touchstart'].forEach(ev => li.addEventListener(ev, s));
       ['mouseup','mouseleave','touchend','touchcancel']
           .forEach(ev => li.addEventListener(ev, x));
   
       (task.done ? ulDone : ulTodo).appendChild(li);
     });
   
     /* Überschriften aus-/einblenden */
     toggleHeadings(box, ulTodo, ulDone);
   
     return box;
   }
   
   /* Hilfs-Fn: To Do / Done nur zeigen, wenn mind. 1 Task vorhanden   */
   function toggleHeadings (box, ulTodo, ulDone) {
     box.querySelector('.todo-h').style.display =
          ulTodo.children.length ? '' : 'none';
     box.querySelector('.done-h').style.display =
          ulDone.children.length ? '' : 'none';
   }
   
   /* --------------------------------------------------------------
      3.x) Löschen / verstecken
      -------------------------------------------------------------- */
   function deleteOrHideCategory (catId) {
     const really = confirm('Delete category permanently?\nCancel = hide only.');
     if (really) {
       store.categories = store.categories.filter(c => c.id !== catId);
       visibleBlocks    = Math.min(visibleBlocks, store.categories.length);
       save();  renderBoard();
     } else {
       document.querySelector(`[data-cat-id="${catId}"]`)
               ?.classList.add('hidden');
     }
   }
   
   function deleteTask (catId, taskId) {
     if (!confirm('Delete this task?')) return;
     const cat = store.categories.find(c => c.id === catId);
     cat.tasks = cat.tasks.filter(t => t.id !== taskId);
     save();  renderBoard();
   }
   
   /* --------------------------------------------------------------
      4) UI-Events & Dialoge
      -------------------------------------------------------------- */
   function bindUI () {
   
     /* ------ Haupt-Buttons ----------------------------- */
     const fab      = $('#addTaskBtn');          // großes "+"
     const fabMenu  = $('#fabMenu');             // klapp-Menü unterm "+"
     const addBlock = $('#addCatBtn');           // 'Add Category'-Button
   
     /* 4.1  zusätzlicher Block ►NICHT◄ Dialog */
     addBlock.onclick = () => {
       if (visibleBlocks < store.categories.length) {
         visibleBlocks++;
         renderBoard();
       }
     };
   
     /* 4.2  FAB-Menü (Task / echte Kategorie anlegen) ----- */
     fab.onclick = () => fabMenu.classList.toggle('hidden');
   
     fabMenu.onclick = e => {
       fabMenu.classList.add('hidden');
       if (e.target.dataset.action === 'task') openTaskDialog();
       if (e.target.dataset.action === 'cat')  openRealCategoryDialog();
     };
   
     /* Klick daneben → Menü zu */
     document.addEventListener('click', ev => {
       if (!fabMenu.contains(ev.target) && ev.target !== fab)
           fabMenu.classList.add('hidden');
     }, true);
   
     /* ---------- Formulare ------------------------------ */
     $('#catForm').addEventListener('submit', e => {
       e.preventDefault();
       if (document.activeElement?.classList.contains('create'))
           addCategoryFromDialog();
       $('#catDlg').close();
     });
   
     $('#taskForm').addEventListener('submit', e => {
       e.preventDefault();
       addTaskFromDialog();
       $('#taskModal').classList.add('hidden');
     });
   
     /* Cancel-Buttons */
     $('#cancelTask')?.addEventListener('click', () =>
           $('#taskModal').classList.add('hidden'));
   }
   
   /* ------ Dialog-Helfer ----------------------------------------- */
   function openRealCategoryDialog () {
     $('#catName').value = '';
     $('#catDlg').classList.remove('hidden');
     $('#catDlg').showModal();
   }
   
   function openTaskDialog () {
     $('#taskTitle').value = '';
     $('#taskDate').value  = todayISO();
     $('#taskCategory').innerHTML = store.categories
        .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
     $('#taskModal').classList.remove('hidden');
   }
   
   /* --------------------------------------------------------------
   neue Kategorie aus dem Dialog übernehmen
   -------------------------------------------------------------- */
function addCategoryFromDialog () {
    const name = $('#catName').value.trim();
    if (!name) { flashInput('#catName'); return; }
  
    const newCat = { id : uuid(), name, tasks : [] };
    store.categories.push(newCat);
    save();
  
    updateAllCategorySelects(newCat);   //  ←  **NEU**
  
    /* sichtbare Blockzahl bleibt gleich – Nutzer entscheidet selbst
       mit dem Button »Add Category«, ob er einen neuen Block sehen will */
    updateOpenTaskCounter();
  }
  
  /* --------------------------------------------------------------
     ALLE Select-Boxen (und den Task-Dialog) nachpflegen
     -------------------------------------------------------------- */
  function updateAllCategorySelects ({ id, name }) {
  
    /* 1) die Selects in jedem To-Do-Block */
    $$('.category-select').forEach(sel => {
      const opt       = document.createElement('option');
      opt.value       = id;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  
    /* 2) das Select-Feld im Task-Dialog                */
    const taskSel = $('#taskCategory');
    if (taskSel) {
      const opt       = document.createElement('option');
      opt.value       = id;
      opt.textContent = name;
      taskSel.appendChild(opt);
    }
  }
  
   function addTaskFromDialog () {
     const title = $('#taskTitle').value.trim();
     const date  = $('#taskDate').value;
     const cid   = $('#taskCategory').value;
   
     if (!title) { flashInput('#taskTitle'); return; }
   
     store.categories
          .find(c => c.id === cid)
          .tasks.push({ id : uuid(), text : title,
                        date : date || undefined, done : false });
   
     save();  renderBoard();
   }
   
   /* kleines rotes Hinweis-Pop-up ---------------------------------- */
   function flashInput (sel) {
     const el  = $(sel);
     let  err  = el.nextElementSibling;
     if (!err || !err.classList.contains('input-error')) {
       err = document.createElement('div');
       err.className = 'input-error';
       err.style.color = '#b00';
       err.style.fontSize = '11px';
       err.style.marginTop = '4px';
       el.after(err);
     }
     err.textContent = 'Please fill out this field.';
     err.style.display = 'block';
     setTimeout(() => err.style.display = 'none', 2000);
   }
   
   /* --------------------------------------------------------------
      5) einfache Seiten-Navigation  (Login → Start → ToDo)
      -------------------------------------------------------------- */
   window.addEventListener('DOMContentLoaded', () => {
   
     const login = $('#loginScreen');
     const start = $('#startScreen');
     const todo  = $('#todoScreen');
   
     const show = scr =>
       [login, start, todo].forEach(s => s.classList.toggle('hidden', s !== scr));
   
     /* Login / Sign-Up → Start-Screen */
     $('.LogIn') ?.addEventListener('click', () => show(start));
     $('.SignUp')?.addEventListener('click', () => show(start));
   
     /* Start-Screen → To-Do-Screen  (erst dann Daten laden) */
     $('.todo-button')?.addEventListener('click', () => {
       show(todo);
       prepareAppData().then(initApp);
     });
     $('.LogIn') ?.addEventListener('click', () => {
        show(start);
        prepareAppData().then(initApp); 
      });
      $('.SignUp')?.addEventListener('click', () => {
        show(start);
        prepareAppData().then(initApp); 
      });
   
     /* Home-Icon in Taskbar → zurück */
     document.addEventListener('click', ev => {
       if (ev.target.closest('#taskbar-home')) show(start);
     });
   
     /* Task-Bar im Login ausblenden (falls global im HTML eingebunden) */
     $('body > task-bar')?.classList.add('hidden');
   });
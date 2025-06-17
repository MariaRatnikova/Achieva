class TaskBar extends HTMLElement {
    connectedCallback () {
      this.innerHTML = `
        <style>
          
          .taskbar{
            position:fixed;
            bottom:0;
            left:0;
            width: 100vw;
            background:#F6F4F2;
            box-shadow:0 -1px 4px rgba(0,0,0,.06);
            display:flex;
            justify-content: center;
            gap: 40px;
            padding:12px 0;
            font-family:'Nunito',sans-serif;z-index:100;
          }
          
          .nav-item{
          display:flex;
          flex-direction:column;
          align-items:center;
          font-size:15px;
          color:#ccc;
          font-weight:1000;
          cursor:pointer}

          .nav-item img{
          width:24px;
          height:24px;
          margin-bottom:4px;
          opacity:.3;
          transition:.2s
          }
          .nav-item.active{
          color:#4A646C
          }
          .nav-item.active img{
          opacity:1
          }
        </style>
  
        <div class="taskbar">
          <div class="nav-item active" id="taskbar-home" data-page="home">
            <img src="images/Icons/Home.svg" alt="Home"><span>Home</span></div>
          <div class="nav-item" data-page="modules">
            <img src="images/Icons/Book.svg" alt="Modules"><span>Modules</span></div>
          <div class="nav-item" data-page="calendar">
            <img src="images/Icons/calendar.svg" alt="Calendar"><span>Calendar</span></div>
          <div class="nav-item" data-page="uploads">
            <img src="images/Icons/folder-empty.svg" alt="Uploads"><span>Uploads</span></div>
        </div>
      `;
  
      
      this.querySelectorAll('.nav-item').forEach(item=>{
        item.addEventListener('click',()=>{
          this.querySelector('.active')?.classList.remove('active');
          item.classList.add('active');
        });
      });
    }
  }
  customElements.define('task-bar', TaskBar);
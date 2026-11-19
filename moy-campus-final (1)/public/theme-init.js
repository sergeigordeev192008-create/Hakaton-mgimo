try{document.documentElement.dataset.theme=localStorage.getItem('campus-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}

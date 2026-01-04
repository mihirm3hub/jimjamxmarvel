pc.script.createLoadingScreen((app) => {
  let canStart = false;

  // ✅ Hosted image URLs go here
  const IMG = {
    loadingBg: 'https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/loading-bg.jpg',
    loadingDot: 'https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/loading-dot.png',
    jimjamLogo: 'https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/jimjam-marvel-logo.png',
    rotateIcon: 'https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/rotate-icon.png',
    marvelLogo: 'https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/marvel-logo.png'
  };

  // --- INLINE CSS (loader + rotate screen) ---
  const createCss = () => {
    const css = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;height:100%}
:root{--fs-small:.875rem}

#application-splash-wrapper{
  position:fixed; inset:0;
  width:100vw;
  height:100vh;            /* fallback */
  height:100dvh;           /* modern mobile browsers */
  z-index:2147483647;
  pointer-events:auto;
}

.desk-rotate-screen{display:block;width:100%;height:100%}
.desk-rotate-con{
  background:#000;width:100%;height:100%;min-height:100dvh;
  display:flex;justify-content:center;align-items:center;padding:1rem;
}
.rotate-content-box{width:100%;max-width:420px;text-align:center}
.rotate-content-inner>img{width:220px;height:auto;margin:0 auto 18px;display:block}
// .rotate-box{
//   margin:0 auto;max-width:340px;padding:16px 14px;border-radius:14px;
//   background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)
// }
.rotate-box img{width:52px;height:auto;display:block;margin:0 auto 10px}
.rotate-box p{
  margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif;
  font-size:14px;line-height:1.3
}
.rotate-foot-box{margin-top:18px}
.rotate-foot-box ul{
  list-style:none;padding:0;margin:0;display:flex;justify-content:space-between;
  align-items:center;gap:12px
}
.rotate-foot-box a{
  color:#fff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;
  font-size:12px;opacity:.9
}
.rotate-foot-box .marvel-logo{width:54px;height:auto}

/* Hide main content by default for desktop */
.page-wrapper{display:block}

.loading-sec{
  width:100%;
  min-height:100vh;
  min-height:100dvh;
}
.loading-banner-box{
  position:relative;
  width:100%;
  min-height:100vh;
  min-height:100dvh;
  overflow:hidden;
  background:#000;
}
.loading-bg-img{position:absolute;inset:0;width:100%;height:100vh;object-fit:cover;z-index:0}

.loading-box {
    position: absolute;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;

    width: 100%;
    padding: 0 20px;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
/* ===== LOADER WRAPPER ===== */
.skew-loader {
    width: 100%;
    max-width: 282px;
    margin-bottom: 14px;
}

.skew-frame {
    position: relative;
    width: 100%;
    height: 15px;

    background-image: url("https://d3lnwbvoiab3gu.cloudfront.net/pc_loadingScreen_assets/loading-frame.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;

    display: flex;
    align-items: center;
    padding: 4px;

    overflow: visible;
}

/* ===== OUTER TRACK ===== */
.skew-track {
    position: relative;
    width: 100%;
    height: 8px;
    background: #241546;

    clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%);
}

/* ===== GLOW / FRAME BEHIND ===== */

/* ===== INNER FILL ===== */
.skew-fill {
    position: absolute;
    inset: 0;
    width: 0%;

    background: linear-gradient(180deg,
            #FF00D3 18%,
            #99007F 100%);

    clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%);
    overflow: hidden;

    transition: width 0.15s linear;
}

/* ===== BISCUIT ===== */
.skew-biscuit {
    position: absolute;
    top: 50%;
    left: 0%;

    transform: translate(-50%, -50%);
    width: 44px;

    z-index: 10;
    /* above frame */
    pointer-events: none;
    border: none;
    outline: none;

    transition: left 0.15s linear;
}
.loading-box p{
  margin:0;color:#fff;font-size:var(--fs-small);
  font-family:Arial,Helvetica,sans-serif;opacity:.9
}
/* 🔑 Single text element */
#loaderText{
  margin-top:14px;
  color:#fff;
  font-family:Arial,Helvetica,sans-serif;
  font-size:14px;
  opacity:.9;
  transition:opacity .25s ease,font-size .25s ease;
}

/* State after load */
#loaderText.ready{
  font-size:14px;           /* bigger */
  letter-spacing:2px;
  text-transform:uppercase;
  opacity:1;
  cursor:pointer;
}

.banner-footer{
  position:absolute;left:0;right:0;bottom:14px;z-index:2;
  display:flex;justify-content:space-between;align-items:center;
  padding:0 16px;color:#fff;font-family:Arial,Helvetica,sans-serif;
  font-size:12px;opacity:.9
}
.banner-footer .marvel-logo{width:44px;height:auto;vertical-align:middle;margin-left:6px}
.tnc-text{color:#fff}

#pc-tap-to-start{
  position:absolute;bottom:14%;left:50%;transform:translateX(-50%);
  color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:18px;
  letter-spacing:2px;text-transform:uppercase;opacity:0;
  transition:opacity .35s ease;pointer-events:none;z-index:3
}

/* Mobile shows loader; desktop shows rotate screen */
// @media (max-width:576px){
//   .page-wrapper{display:block}
//   .desk-rotate-screen{display:none}
// }
        `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  };

  const showSplash = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'application-splash-wrapper';
    document.body.appendChild(wrapper);

    // Desktop rotate blocker
    // const desk = document.createElement('div');
    // desk.className = 'desk-rotate-screen';
    // desk.innerHTML = `
    //     <div class="desk-rotate-con">
    //       <div class="rotate-content-box">
    //         <div class="rotate-content-inner">
    //           <img src="${IMG.jimjamLogo}" alt="Jimjam Marvel Logo">
    //           <div class="rotate-box">
    //             <img src="${IMG.rotateIcon}" alt="Rotate Icon">
    //             <p>This experience is limited to mobile</p>
    //             <p>devices only.</p>
    //           </div>
    //         </div>
    //         <div class="rotate-foot-box">
    //           <ul>
    //             <li><a href="#" target="_blank" rel="noopener">TnC Applies</a></li>
    //             <li>
    //               <a href="#" target="_blank" rel="noopener">
    //                 <img src="${IMG.marvelLogo}" alt="Marvel Logo" class="marvel-logo">
    //               </a>
    //             </li>
    //           </ul>
    //         </div>
    //       </div>
    //     </div>
    // `;
    // wrapper.appendChild(desk);

    // Loading section (mobile)
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper';

    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-wrapper';

    const loadingSec = document.createElement('section');
    loadingSec.className = 'loading-sec';
    loadingSec.id = 'loading-sec';

    loadingSec.innerHTML = `
            <div class="loading-banner-box">
              <img src="${IMG.loadingBg}" alt="Background Image" class="loading-bg-img">

              <div class="loading-box">
                <div class="skew-loader">
                  <div class="skew-frame">
                    <div class="skew-track">
                        <div class="skew-fill"></div>
                    </div>
                    
                    <img src="${IMG.loadingDot}" class="skew-biscuit" alt="Loading dot">
                  </div>
                </div>
                <p id="loaderText">Loading your experience...</p>
              </div>

              <div class="banner-footer">
                <span class="tnc-text">TnC Applies</span>
                <span class="copyright">
                  © <span id="pc-year"></span>
                  <img src="${IMG.marvelLogo}" class="marvel-logo" alt="Marvel">
                </span>
              </div>

              <div id="pc-tap-to-start">TAP TO START</div>
            </div>
        `;

    mainWrapper.appendChild(loadingSec);
    pageWrapper.appendChild(mainWrapper);
    wrapper.appendChild(pageWrapper);

    // year
    const y = wrapper.querySelector('#pc-year');
    if (y) y.textContent = new Date().getFullYear();

    // click to start
    wrapper.addEventListener('click', (e) => {
      if (!canStart) return;
      app.fire('ui:start');
      hideSplash();
      e.stopPropagation();
    });
  };

  // ✅ REAL progress from PlayCanvas (0..1) → updates skew-fill + biscuit position
  const updateSkewLoader = (value) => {
    const wrapper = document.getElementById('application-splash-wrapper');
    if (!wrapper) return;

    const fill = wrapper.querySelector('.skew-fill');
    const biscuit = wrapper.querySelector('.skew-biscuit');

    // clamp 0..1
    const v = Math.max(0, Math.min(1, value));

    // convert to %
    const pct = v * 100;

    if (fill) fill.style.width = `${pct}%`;

    // optional clamp so biscuit doesn't visually overflow its own width
    const biscuitPct = Math.min(100, Math.max(0, pct));
    if (biscuit) biscuit.style.left = `${biscuitPct}%`;
  };

  const hideSplash = () => {
    const el = document.getElementById('application-splash-wrapper');
    if (el) el.remove();
  };

  // boot
  createCss();
  showSplash();

  // Drive UI from actual engine load progress
  app.on('preload:progress', (value) => {
    updateSkewLoader(value);
  });

  // When everything is ready:
  app.on('start', () => {
    updateSkewLoader(1); // force 100%


    const text = document.getElementById('loaderText');
    if (text) {
      text.textContent = 'TAP TO START';
      text.classList.add('ready');
    }

    canStart = true;
    // if (tap) tap.style.opacity = '1';
  });
});

/**
 * YAFT Marketing Website - Interactive Scripts (Zero External Dependencies)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Management (Light / Dark)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const html = document.documentElement;

  const getPreferredTheme = () => {
    const stored = localStorage.getItem('yaft-marketing-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const setTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('yaft-marketing-theme', theme);
  };

  setTheme(getPreferredTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = html.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // 2. Header Scroll Effect
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // 3. Mobile Navigation Drawer
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const mobileLinks = document.querySelectorAll('.mkt-mob-link');

  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
      });
    });
  }

  // 4. Global Privacy Amount Masking Toggle
  const maskToggleBtn = document.getElementById('maskToggleBtn');
  const maskBtnText = document.getElementById('maskBtnText');
  const eyeOpen = document.querySelector('.eye-open');
  const eyeClosed = document.querySelector('.eye-closed');
  let isMasked = false;

  if (maskToggleBtn) {
    maskToggleBtn.addEventListener('click', () => {
      isMasked = !isMasked;
      const maskables = document.querySelectorAll('.maskable');

      maskables.forEach(el => {
        const real = el.getAttribute('data-real');
        if (isMasked) {
          if (real && real.includes('+')) {
            el.textContent = '+ ₹ ••••••';
          } else if (real && real.includes('-')) {
            el.textContent = '- ₹ ••••••';
          } else {
            el.textContent = '₹ ••••••';
          }
        } else {
          el.textContent = real;
        }
      });

      if (isMasked) {
        maskToggleBtn.classList.add('active');
        if (maskBtnText) maskBtnText.textContent = 'Masked';
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
      } else {
        maskToggleBtn.classList.remove('active');
        if (maskBtnText) maskBtnText.textContent = 'Mask Numbers';
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    });
  }

  // 5. Mockup Tabs Switcher
  const mockupTabs = document.querySelectorAll('.mkt-mockup-tab');
  const tabContents = document.querySelectorAll('.mkt-tab-content');

  mockupTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      mockupTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // 6. Deploy Tabs Switcher
  const deployTabs = document.querySelectorAll('.mkt-deploy-tab');
  const deployContents = document.querySelectorAll('.mkt-deploy-content');

  deployTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const deployType = tab.getAttribute('data-deploy');

      deployTabs.forEach(t => t.classList.remove('active'));
      deployContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(`deploy-${deployType}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // 7. Copy Buttons
  const copyHeroDockerBtn = document.getElementById('copyHeroDockerBtn');
  if (copyHeroDockerBtn) {
    copyHeroDockerBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('docker compose up -d');
      const textSpan = copyHeroDockerBtn.querySelector('.copy-text');
      if (textSpan) textSpan.textContent = 'Copied!';
      setTimeout(() => {
        if (textSpan) textSpan.textContent = 'Copy';
      }, 2000);
    });
  }

  const copySnippetBtns = document.querySelectorAll('.copy-snippet-btn');
  copySnippetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code');
      if (code) {
        navigator.clipboard.writeText(code);
        const textSpan = btn.querySelector('.copy-text');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => {
          if (textSpan) textSpan.textContent = 'Copy Snippet';
        }, 2000);
      }
    });
  });

  // 8. FAQ Accordion
  const faqQuestions = document.querySelectorAll('.mkt-faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isOpen = item.classList.contains('open');

      // Close all other items
      document.querySelectorAll('.mkt-faq-item').forEach(i => {
        i.classList.remove('open');
        const q = i.querySelector('.mkt-faq-question');
        if (q) q.setAttribute('aria-expanded', 'false');
        const chevron = i.querySelector('.mkt-faq-chevron');
        if (chevron) chevron.classList.remove('rotate');
      });

      // If it wasn't open, open it
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        const chevron = item.querySelector('.mkt-faq-chevron');
        if (chevron) chevron.classList.add('rotate');
      }
    });
  });

  // 9. Back to Top Button
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

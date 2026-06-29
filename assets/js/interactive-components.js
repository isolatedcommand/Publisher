// Front-end interactions for isolatedcommand.com

document.addEventListener('DOMContentLoaded', function() {
  initTypingEffect();
  initCardAnimations();
  initGlitchEffect();
  initTerminalEffect();
  initScrollAnimations();
  initCodeHighlight();
  initNeonHover();
  initCopyMarkdown();
});

// Copy raw markdown of an article to clipboard
function initCopyMarkdown() {
  const buttons = document.querySelectorAll('[data-copy-md]');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const toolbar = button.closest('.article-toolbar');
      const source = toolbar ? toolbar.querySelector('.article-raw-md') : null;
      if (!source) return;

      const text = source.value;
      const original = button.textContent;

      navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = original; }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        source.removeAttribute('hidden');
        source.select();
        document.execCommand('copy');
        source.setAttribute('hidden', '');
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = original; }, 2000);
      });
    });
  });
}

// Typing Effect for Hero Text
function initTypingEffect() {
  const elements = document.querySelectorAll('[data-typing]');

  elements.forEach(element => {
    const text = element.textContent;
    element.textContent = '';
    let index = 0;

    const type = () => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, 50 + Math.random() * 30);
      }
    };

    type();
  });
}

// Animate cards on scroll
function initCardAnimations() {
  const cards = document.querySelectorAll('.card, [data-card]');

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  cards.forEach(card => observer.observe(card));
}

// Glitch Effect on Elements
function initGlitchEffect() {
  const glitchElements = document.querySelectorAll('[data-glitch]');

  glitchElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
      element.classList.add('glitch-text');

      setTimeout(() => {
        element.classList.remove('glitch-text');
      }, 500);
    });
  });
}

// Terminal Effect for Code Blocks
function initTerminalEffect() {
  const terminals = document.querySelectorAll('[data-terminal]');

  terminals.forEach(terminal => {
    const lines = terminal.textContent.split('\n');
    terminal.innerHTML = '';
    let lineIndex = 0;

    const addLine = () => {
      if (lineIndex < lines.length) {
        const line = document.createElement('div');
        line.style.minHeight = '1.5em';

        if (lines[lineIndex].trim().startsWith('$') || lines[lineIndex].trim().startsWith('>')) {
          const prefix = document.createElement('span');
          prefix.textContent = '$ ';
          prefix.style.color = 'var(--color-primary)';
          line.appendChild(prefix);

          const content = document.createElement('span');
          content.textContent = lines[lineIndex].substring(2);
          content.style.color = 'var(--color-secondary)';
          line.appendChild(content);
        } else {
          line.textContent = lines[lineIndex];
        }

        terminal.appendChild(line);
        lineIndex++;

        setTimeout(addLine, 100 + Math.random() * 100);
      }
    };

    addLine();
  });
}

// Scroll Animations
function initScrollAnimations() {
  const elements = document.querySelectorAll('[data-animate-on-scroll]');

  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const animation = entry.target.getAttribute('data-animate-on-scroll');
        entry.target.style.animation = `${animation} 0.8s ease-out forwards`;
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  elements.forEach(element => observer.observe(element));
}

// Code Highlight with Copy Button
function initCodeHighlight() {
  const codeBlocks = document.querySelectorAll('pre code');

  codeBlocks.forEach(block => {
    const pre = block.parentElement;

    // Check if copy button already exists
    if (pre.querySelector('.copy-btn')) return;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    copyBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      background: var(--color-primary);
      color: var(--color-bg-dark);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
      z-index: 10;
    `;

    pre.style.position = 'relative';
    pre.appendChild(copyBtn);

    copyBtn.addEventListener('click', () => {
      const text = block.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        copyBtn.style.background = 'var(--color-secondary)';

        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.background = 'var(--color-primary)';
        }, 2000);
      });
    });

    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.boxShadow = '0 0 20px var(--color-primary)';
    });

    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.boxShadow = 'none';
    });
  });
}

// Neon Hover Effects
function initNeonHover() {
  const hoverElements = document.querySelectorAll('[data-neon-hover]');

  hoverElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
      element.style.textShadow = '0 0 10px var(--color-primary), 0 0 20px var(--color-secondary)';
      element.style.color = 'var(--color-secondary)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.textShadow = 'none';
      element.style.color = '';
    });
  });
}

// Parallax Effect (optional, for hero sections)
function initParallax() {
  const parallaxElements = document.querySelectorAll('[data-parallax]');

  window.addEventListener('scroll', () => {
    parallaxElements.forEach(element => {
      const scrollPosition = window.scrollY;
      const speed = element.getAttribute('data-parallax') || 0.5;
      element.style.transform = `translateY(${scrollPosition * speed}px)`;
    });
  });
}

window.addEventListener('load', () => {
  initParallax();
});

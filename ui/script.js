
    const tabs = document.querySelectorAll('.tab');
    const preview = document.getElementById('preview');
    const markdown = document.getElementById('markdown');
    const repoGroup = document.getElementById('repo-group');
    const repoInput = document.getElementById('repo');
    const gistGroup = document.getElementById('gist-group');
    const gistInput = document.getElementById('gist-id');
    const loadingOverlay = document.getElementById('loading-overlay');
    const successToast = document.getElementById('success-toast');

    let currentType = 'core';
    let debounceTimer;

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentType = tab.dataset.type;
        
        repoGroup.style.display = (currentType === "repo") ? "flex" : "none";
        gistGroup.style.display = (currentType === "gist") ? "flex" : "none";
        
        updatePreview();
      });
    });

    // Input event listeners with debouncing
    document.querySelectorAll('.options input, .options select').forEach(el => {
      el.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updatePreview, 500);
      });
    });

    function getCardUrl(type) {
      const username = document.getElementById('username').value.trim() || "pranesh-2005";
      const theme = document.getElementById('theme').value;
      const repo = repoInput.value.trim() || "github-readme-stats-fast";
      const gistId = gistInput.value.trim() || "bbfce31e0217a3689c8d961a356cb10d";

      let base = "https://github-readme-stats-fast.vercel.app/api";

      switch(type) {
        case "stats":
          base += `?username=${encodeURIComponent(username)}&show_icons=true&count_private=true`;
          break;
        case "streak":
          base += `/streak?username=${encodeURIComponent(username)}`;
          break;
        case "top-langs":
          base += `/top-langs/?username=${encodeURIComponent(username)}&layout=compact&langs_count=8`;
          break;
        case "wakatime":
          const wakatimeUsername = username === "pranesh-2005" ? "ffflabs" : username;
          base += `/wakatime?username=${encodeURIComponent(wakatimeUsername)}`;
          break;
        case "repo":
          base += `/pin/?username=${encodeURIComponent(username)}&repo=${encodeURIComponent(repo)}`;
          break;
        case "gist":
          base += `/gist?id=${encodeURIComponent(gistId)}`;
          break;
      }

      if (theme) {
        base += `&theme=${encodeURIComponent(theme)}`;
      }

      return base;
    }

    function showLoading() {
      loadingOverlay.classList.add('show');
    }

    function hideLoading() {
      loadingOverlay.classList.remove('show');
    }

    function showError(msg) {
      hideLoading();
      preview.innerHTML = `<div class="error-message">${msg}</div>`;
    }

    function showToast(message) {
      const toast = document.getElementById('success-toast');
      toast.querySelector('span:last-child').textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    function updatePreview() {
      showLoading();
      
      let urls = [];
      if (currentType === "core") {
        urls = [
          getCardUrl("stats"),
          getCardUrl("streak"),
          getCardUrl("top-langs")
        ];
      } else {
        urls = [getCardUrl(currentType)];
      }

      let md = "";
      let loaded = 0;
      let hasError = false;
      
      // Clear previous content
      const existingImages = preview.querySelectorAll('img, .error-message');
      existingImages.forEach(el => el.remove());

      urls.forEach((url, index) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = `GitHub Stats Card ${index + 1}`;
        img.style.opacity = '0';
        img.style.transform = 'translateY(20px)';
        
        img.onload = () => {
          loaded++;
          // Animate in
          setTimeout(() => {
            img.style.transition = 'all 0.5s ease';
            img.style.opacity = '1';
            img.style.transform = 'translateY(0)';
          }, index * 100);
          
          if (loaded === urls.length && !hasError) {
            hideLoading();
          }
        };
        
        img.onerror = () => {
          hasError = true;
          showError("Unable to load GitHub stats. Please check your username and try again.");
        };
        
        preview.appendChild(img);
        md += `![GitHub Stats](${url})\n`;
      });
      
      markdown.value = md.trim();
    }

    function refreshPreview() {
      updatePreview();
      showToast("Preview refreshed!");
    }

    async function copyCode() {
      try {
        await navigator.clipboard.writeText(markdown.value);
        showToast("Markdown copied to clipboard!");
      } catch (err) {
        // Fallback for older browsers
        markdown.select();
        document.execCommand("copy");
        showToast("Markdown copied to clipboard!");
      }
    }

    // Initialize
    updatePreview();

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'c':
            if (e.target === markdown) {
              e.preventDefault();
              copyCode();
            }
            break;
          case 'r':
            e.preventDefault();
            refreshPreview();
            break;
        }
      }
});
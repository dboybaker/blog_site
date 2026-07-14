// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  // Tag filtering on blog list page
  const blogGrid = document.querySelector('.blog-grid');
  const filterBar = document.getElementById('tag-filter-bar');
  const filterBarTag = document.getElementById('filter-bar-tag');
  const filterBarClear = document.getElementById('filter-bar-clear');

  if (blogGrid && filterBar) {
    let activeTag = null;

    const applyFilter = (tag) => {
      activeTag = tag;

      // Update URL hash
      window.location.hash = 'tag:' + encodeURIComponent(tag);

      // Show filter bar
      filterBar.style.display = 'flex';
      filterBarTag.textContent = tag;

      // Highlight the active tag
      const tags = blogGrid.querySelectorAll('.tag');
      tags.forEach((t) => {
        if (t.dataset.tag === tag) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      // Filter blog cards
      const cards = blogGrid.querySelectorAll('.blog-card');
      let visibleCount = 0;

      cards.forEach((card) => {
        const tagsData = card.dataset.tags;
        if (tagsData && tagsData.includes('"' + tag + '"')) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      // If no posts match, show a message
      let noResults = document.querySelector('.no-results-message');
      if (visibleCount === 0) {
        if (!noResults) {
          noResults = document.createElement('p');
          noResults.className = 'no-results-message';
          noResults.textContent = 'No posts found with the selected tag.';
          blogGrid.parentNode.insertBefore(noResults, blogGrid.nextSibling);
        }
        noResults.style.display = '';
      } else if (noResults) {
        noResults.style.display = 'none';
      }
    };

    const clearFilter = () => {
      activeTag = null;

      // Clear URL hash
      if (history.replaceState) {
        history.replaceState(null, null, window.location.pathname);
      }

      // Hide filter bar
      filterBar.style.display = 'none';
      filterBarTag.textContent = '';

      // Remove active class from all tags
      const tags = blogGrid.querySelectorAll('.tag');
      tags.forEach((t) => {
        t.classList.remove('active');
      });

      // Show all blog cards
      const cards = blogGrid.querySelectorAll('.blog-card');
      cards.forEach((card) => {
        card.style.display = '';
      });

      // Hide no results message if present
      const noResults = document.querySelector('.no-results-message');
      if (noResults) {
        noResults.style.display = 'none';
      }
    };

    const readHashAndApply = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#tag:')) {
        const tag = decodeURIComponent(hash.substring(5));
        if (tag) {
          applyFilter(tag);
          return true;
        }
      }
      return false;
    };

    // Try to read hash from URL on initial load (use load event for reliability)
    window.addEventListener('load', () => {
      readHashAndApply();
    });

    // Also try immediately in case load already fired
    readHashAndApply();

    // Listen for hash changes (e.g., navigating back from another page with hash in URL)
    window.addEventListener('hashchange', () => {
      readHashAndApply();
    });

    // Attach click handlers to all tag elements using event delegation
    blogGrid.addEventListener('click', (e) => {
      const tagEl = e.target.closest('.tag');
      if (!tagEl) return;

      e.preventDefault();
      e.stopPropagation();

      const tag = tagEl.dataset.tag;

      // Toggle: if clicking the same tag, clear the filter
      if (activeTag === tag) {
        clearFilter();
      } else {
        applyFilter(tag);
      }
    });

    // Clear button handler
    filterBarClear.addEventListener('click', () => {
      clearFilter();
    });
  }
});
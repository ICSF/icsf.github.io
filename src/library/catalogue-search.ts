const API_BASE = 'https://library-database-system-nine.vercel.app'

const PAGE_SIZE = 100;

// typing delay to avoid excessive re-rendering while the user is typing
const DEBOUNCE_MS = 120;

// some author names are put as these formats in the db
const FORMATS = ['dvd', 'video', 'magazine', 'comics', 'bluray', 'dc: comics', 'audio'];

type CatalogueRow = {
    title: string;
    series: string | null;
    series_num: string | null;
    author_name: string | null;
    isbn: string | null;
}

// raw row + precomputed lowercase search blob
type SearchableCatalogueRow = CatalogueRow & {
  _searchBlob: string;
};

let allItems: SearchableCatalogueRow[] = [];

let currentResults: SearchableCatalogueRow[] = [];
let currentPage = 1;

let debounceHandle: ReturnType<typeof setTimeout> | null = null 

const searchInput = document.getElementById('catalogue-search-input') as HTMLInputElement | null;
const statusEl = document.getElementById('catalogue-status');
const resultsEl = document.getElementById('catalogue-results');

const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_LOOKUP[char] ?? char);
}

function buildSearchBlob(item: CatalogueRow): string {
  return [item.title, item.author_name ?? '', item.series ?? '']
    .join(' ')
    .toLowerCase();
}

function totalPages(): number {
  return Math.max(1, Math.ceil(currentResults.length / PAGE_SIZE));
}

function renderPage(): void {
  if (!resultsEl) return;

  if (currentResults.length === 0) {
    resultsEl.innerHTML = '<li class="catalogue-empty">No items match your search.</li>';
    updatePaginationControls();
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = currentResults.slice(start, start + PAGE_SIZE);

  resultsEl.innerHTML = pageItems
    .map((item) => {
      // display names like "DVD" or "Video" without the "by" prefix
      const isFormat = item.author_name ? FORMATS.includes(item.author_name.toLowerCase()) : false;
      const authorText = item.author_name ? escapeHtml(item.author_name) : '';
      
      const seriesBadge = item.series 
        ? `<div class="card-series">${escapeHtml(item.series)}${item.series_num ? ` #${escapeHtml(item.series_num)}` : ''}</div>`
        : '';

      const isbnBadge = item.isbn 
        ? `<div class="card-isbn">ISBN: ${escapeHtml(item.isbn)}</div>` 
        : '';

      return `
        <li class="catalogue-card">
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${authorText ? `<div class="card-author">${isFormat ? authorText : `by ${authorText}`}</div>` : ''}
            ${seriesBadge}
          </div>
          ${isbnBadge ? `<div class="card-footer">${isbnBadge}</div>` : ''}
        </li>
      `;
    })
    .join('');

    updatePaginationControls();
}

function updatePaginationControls(): void {
  const pages = totalPages();

  // Re-query dynamically to guarantee elements are present in the DOM
  const indicators = document.querySelectorAll('.catalogue-page-indicator');
  const prevBtns = document.querySelectorAll<HTMLButtonElement>('.catalogue-prev-page');
  const nextBtns = document.querySelectorAll<HTMLButtonElement>('.catalogue-next-page');

  indicators.forEach((el) => {
    el.textContent = `Page ${currentPage} of ${pages}`;
  });

  prevBtns.forEach((btn) => {
    btn.disabled = currentPage <= 1;
  });

  nextBtns.forEach((btn) => {
    btn.disabled = currentPage >= pages;
  });

  if (statusEl) {
    const total = currentResults.length;
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(total, currentPage * PAGE_SIZE);
    statusEl.textContent =
      total === 0
        ? '0 items match.'
        : `Showing ${start}–${end} of ${total} item${total === 1 ? '' : 's'}.`;
  }
}


function goToPage(page: number): void {
  const pages = totalPages();
  currentPage = Math.min(Math.max(1, page), pages);
  renderPage();

  const headerEl = document.querySelector('site-header');
  if (headerEl) {
    headerEl.scrollIntoView({ behavior: 'auto', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}


function filterCatalogue(query: string): SearchableCatalogueRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return allItems;

  return allItems.filter((item) => item._searchBlob.includes(q));
}

function runFilterAndRender(query: string): void {
  currentResults = filterCatalogue(query);
  currentPage = 1; 
  renderPage();
}

async function loadCatalogue(): Promise<void> {
  if (!statusEl) return;

  try {
    const response = await fetch(`${API_BASE}/api/catalogueList`);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = (await response.json()) as {result?: {data?: CatalogueRow[]}};

    const rawItems = data.result?.data ?? [];

    allItems = rawItems.map((item) => ({
      ...item,
      _searchBlob: buildSearchBlob(item),
    }));

    currentResults = allItems;
    currentPage = 1;
    renderPage();
  } catch (err) {
    console.error('[catalogue-search] failed to load catalogue:', err);
    statusEl.textContent = 'Unable to load the catalogue right now. Please try again later.';
  }
}

searchInput?.addEventListener('input', () => {
  if (debounceHandle !== null) {
    clearTimeout(debounceHandle);
  }

  debounceHandle = setTimeout(() => {
    runFilterAndRender(searchInput.value);
  }, DEBOUNCE_MS);
});

// Attach event listeners to all prev/next buttons
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const prevBtn = target.closest<HTMLButtonElement>('.catalogue-prev-page');
  const nextBtn = target.closest<HTMLButtonElement>('.catalogue-next-page');

  if (prevBtn && !prevBtn.disabled) {
    goToPage(currentPage - 1);
  } else if (nextBtn && !nextBtn.disabled) {
    goToPage(currentPage + 1);
  }
});

if (statusEl) {
  statusEl.textContent = 'Loading catalogue…';
}

void loadCatalogue();
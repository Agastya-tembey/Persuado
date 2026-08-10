let countryDataset = [];
const selectedCountries = [null, null, null, null];
const metrics = ['name', 'capital', 'population', 'gdp', 'gdpPerCapita', 'currency', 'officialLanguages', 'subregion', 'hdi'];
const COUNTRY_SLUG_ALIASES = {
  'russia': 'russian-federation',
  'united-states': 'united-states-of-america',
  'united-kingdom': 'united-kingdom-of-great-britain-and-northern-ireland',
  'turkey': 'turkiye',
  'vietnam': 'viet-nam',
  'korea-north': 'democratic-people-s-republic-of-korea',
  'korea-south': 'republic-of-korea',
  'venezuela': 'venezuela-bolivarian-republic-of',
  'syria': 'syrian-arab-republic',
  'tanzania': 'united-republic-of-tanzania',
  'moldova': 'republic-of-moldova',
  'gambia': 'the-gambia'
};

function slugFromCountryName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function countryCodeToFlag(code) {
  if (!code) return '🌐';
  const normalized = String(code).toUpperCase();
  const first = normalized.charCodeAt(0);
  const second = normalized.charCodeAt(1);
  if (first < 65 || first > 90 || second < 65 || second > 90) return '🌐';
  return String.fromCodePoint(first + 0x1F1A5, second + 0x1F1A5);
}

function normalizeCountryRecord(record) {
  const name = record['Country'] || record.name || '';
  const languages = Array.isArray(record.officialLanguages)
    ? record.officialLanguages
    : String(record['Languages'] || record.languages || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

  return {
    capital: record['Capital'] || record.capital || '',
    population: Number(record['Population 2026'] ?? record.population) || 0,
    gdp: Number(record['GDP USD B'] ?? record.gdp) || 0,
    gdpPerCapita: Number(record['GDP per Capita'] ?? record.gdpPerCapita) || 0,
    currency: record['Currency'] || record.currency || '',
    officialLanguages: languages,
    subregion: record['Continent'] || record.subregion || '',
    hdi: Number(record['HDI'] ?? record.hdi) || 0,
    name,
    slug: slugFromCountryName(name),
    flag: record['ISO-2'] ? countryCodeToFlag(record['ISO-2']) : (record.flag || '🌐')
  };
}

async function loadCountryDataset() {
  try {
    const response = await fetch('data/countries.json');
    if (!response.ok) throw new Error('Failed to load country dataset');
    const json = await response.json();
    const rows = Array.isArray(json.Sheet1) ? json.Sheet1 : Array.isArray(json) ? json : [];
    countryDataset = rows.map(normalizeCountryRecord).filter(country => country.name);
    if (!countryDataset.length) {
      createEmptyState('Country data is temporarily unavailable. Please refresh and try again.');
    }
  } catch (error) {
    console.error('Unable to load country dataset:', error);
    countryDataset = [];
    createEmptyState('Country data could not be loaded. Please refresh and try again.');
  }
}

function initDropdowns() {
  for (let i = 1; i <= 4; i++) {
    const searchInput = document.getElementById(`search${i}`);
    const dropdownList = document.getElementById(`list${i}`);

    if (!searchInput || !dropdownList) continue;

    searchInput.addEventListener('focus', () => renderCountryList(i, searchInput.value));
    searchInput.addEventListener('input', (event) => renderCountryList(i, event.target.value));
    searchInput.addEventListener('blur', () => {
      setTimeout(() => dropdownList.classList.remove('active'), 150);
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.searchable-dropdown')) {
      closeDropdowns();
    }
  });
}

function closeDropdowns() {
  for (let i = 1; i <= 4; i++) {
    const dropdownList = document.getElementById(`list${i}`);
    if (dropdownList) {
      dropdownList.classList.remove('active');
    }
  }
}

function renderCountryList(index, query) {
  const dropdownList = document.getElementById(`list${index}`);
  if (!dropdownList) return;

  const filtered = countryDataset.filter(c => c.name.toLowerCase().includes((query || '').toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  dropdownList.innerHTML = filtered.map(country => {
    const activeSelection = selectedCountries[index - 1]?.slug === country.slug;
    const usedElsewhere = selectedCountries.some((entry, entryIndex) => entryIndex !== index - 1 && entry?.slug === country.slug);
    const optionClass = activeSelection ? 'selected' : (usedElsewhere ? 'used' : '');
    const disabledAttr = usedElsewhere && !activeSelection ? 'aria-disabled="true"' : '';
    const onclick = usedElsewhere && !activeSelection ? '' : `onclick="selectCountry(${index}, '${country.slug}')"`;
    const label = usedElsewhere && !activeSelection ? `${country.name} · already selected` : country.name;
    return `<div class="dropdown-option ${optionClass}" ${disabledAttr} ${onclick}>${country.flag} ${label}</div>`;
  }).join('');

  dropdownList.classList.add('active');
}

function findCountryBySlug(slug) {
  const normalizedValue = String(slug || '').toLowerCase();
  const candidateSlugs = [normalizedValue];
  if (COUNTRY_SLUG_ALIASES[normalizedValue]) {
    candidateSlugs.push(COUNTRY_SLUG_ALIASES[normalizedValue]);
  }
  return countryDataset.find(country => candidateSlugs.includes(country.slug));
}

function selectCountry(index, slug) {
  const country = findCountryBySlug(slug);
  if (!country) return;

  selectedCountries[index - 1] = country;
  const searchInput = document.getElementById(`search${index}`);
  if (searchInput) {
    searchInput.value = country.name;
  }
  const dropdownList = document.getElementById(`list${index}`);
  if (dropdownList) {
    dropdownList.classList.remove('active');
  }
  updateSelectionSummary();
  generateComparison();
}

function updateSelectionSummary() {
  const summary = document.getElementById('selectionSummary');
  if (!summary) return;

  const selected = selectedCountries.filter(Boolean);

  if (!selected.length) {
    summary.innerHTML = '<div class="summary-copy">Choose at least two countries to begin the side-by-side comparison.</div>';
    return;
  }

  const chips = selected.map(country => `<span class="summary-chip">${country.flag} ${country.name}</span>`).join('');
  summary.innerHTML = `<div class="summary-copy">Selected countries</div><div class="chip-row">${chips}</div>`;
}

function createEmptyState(message) {
  const comparisonContainer = document.getElementById('comparisonContainer');
  if (comparisonContainer) {
    comparisonContainer.innerHTML = `<div class="empty-state">${message}</div>`;
  }
}

function formatPopulation(val) {
  if (val >= 1e9) return (val / 1e9).toFixed(1) + ' Billion';
  if (val >= 1e6) return (val / 1e6).toFixed(1) + ' Million';
  return val.toLocaleString();
}

function formatGDP(val) {
  if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + ' Trillion';
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + ' Billion';
  return '$' + (val / 1e6).toFixed(2) + ' Million';
}

function formatGDPPerCapita(val) {
  return '$' + val.toLocaleString();
}

function formatHDI(val) {
  return val.toFixed(3);
}

function getMetricValue(country, metric) {
  if (!country) return '-';
  if (metric === 'name') return `${country.flag} ${country.name}`;
  if (metric === 'population') return formatPopulation(country.population);
  if (metric === 'gdp') return formatGDP(country.gdp);
  if (metric === 'gdpPerCapita') return formatGDPPerCapita(country.gdpPerCapita);
  if (metric === 'hdi') return formatHDI(country.hdi);
  if (metric === 'officialLanguages') return country.officialLanguages.join(', ');
  return country[metric] || '-';
}

function highlightMax(values, metric) {
  if (['name', 'capital', 'currency', 'officialLanguages', 'subregion'].includes(metric)) return [];
  const numValues = values.map(c => c ? c[metric] : -Infinity);
  const maxIdx = numValues.indexOf(Math.max(...numValues.filter(v => v !== -Infinity)));
  return numValues.map((_, i) => i === maxIdx ? 'highlight' : '');
}

function generateComparison() {
  const comparison = selectedCountries.filter(c => c !== null);
  if (comparison.length < 2) {
    createEmptyState('Select at least two countries to build a comparison.');
    return;
  }

  let html = '<div class="comparison-table-wrapper"><table class="comparison-table"><thead><tr><th>Metric</th>';
  comparison.forEach(c => html += `<th>${c.flag} ${c.name}</th>`);
  html += '</tr></thead><tbody>';

  metrics.forEach(metric => {
    const highlights = highlightMax(comparison, metric);
    const metricLabel = metric.charAt(0).toUpperCase() + metric.slice(1).replace(/([A-Z])/g, ' $1');
    html += `<tr><td class="metric-label">${metricLabel}</td>`;
    comparison.forEach((country, i) => {
      const value = getMetricValue(country, metric);
      html += `<td ${highlights[i] === 'highlight' ? 'class="value-highlighted"' : ''}>${value}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  const comparisonContainer = document.getElementById('comparisonContainer');
  if (comparisonContainer) {
    comparisonContainer.innerHTML = html;
  }
}

function swapCountries() {
  if (!selectedCountries[0] || !selectedCountries[1]) return;

  [selectedCountries[0], selectedCountries[1]] = [selectedCountries[1], selectedCountries[0]];

  const search1 = document.getElementById('search1');
  const search2 = document.getElementById('search2');
  if (search1) search1.value = selectedCountries[0]?.name || '';
  if (search2) search2.value = selectedCountries[1]?.name || '';
  updateSelectionSummary();
  generateComparison();
}

function clearComparison() {
  selectedCountries.fill(null);
  ['search1', 'search2', 'search3', 'search4'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  updateSelectionSummary();
  createEmptyState('Select countries from the dropdowns to start comparing.');
}

function initChatWidget() {
  const url = 'https://delegate-helper.lovable.app';
  const btn = document.getElementById('chatBtn');
  const modal = document.getElementById('chatModal');
  const iframe = document.getElementById('chatIframe');
  const close = document.getElementById('chatClose');

  if (!btn || !modal || !iframe || !close) return;

  btn.addEventListener('click', function () {
    const w = window.open(url, 'delegateHelper', 'width=420,height=680');
    if (w && !w.closed) { w.focus(); return; }
    iframe.src = url;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  });
  close.addEventListener('click', function () {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = '';
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#chatModal') && !event.target.closest('#chatBtn')) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      iframe.src = '';
    }
  });
}

function initApp() {
  initDropdowns();
  initChatWidget();
  clearComparison();
  loadCountryDataset();
}

window.selectCountry = selectCountry;
window.swapCountries = swapCountries;
window.clearComparison = clearComparison;
window.generateComparison = generateComparison;
window.addEventListener('DOMContentLoaded', initApp);

let allProducts = [];
let currentFilter = 'all';
let currentSort = 'featured';
let currentSearch = '';

const hasCatalogGrid = () => Boolean(document.getElementById('products'));

function initCatalogFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const search = params.get('search');

  if (category) {
    currentFilter = category;
  }

  if (search) {
    currentSearch = search;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = search;
    }
  }

  setActiveFilterButton(currentFilter);
}

function loadProducts() {
  if (!hasCatalogGrid()) {
    return;
  }

  fetch('/products')
    .then(async (res) => {
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.message || 'Unable to load products');
      }
      return data;
    })
    .then((data) => {
      allProducts = data;
      applyProductView();
    })
    .catch((error) => {
      console.error('Error loading products:', error);
      showNotification(error.message || 'Unable to load products right now', 'error');
    });
}

function getVisibleProducts() {
  const normalizedSearch = currentSearch.trim().toLowerCase();

  let visible = allProducts.filter((product) => {
    const matchesCategory = currentFilter === 'all' || (
      product.category && product.category.toLowerCase() === currentFilter
    );

    const matchesSearch = !normalizedSearch || (
      product.name && product.name.toLowerCase().includes(normalizedSearch)
    ) || (
      product.category && product.category.toLowerCase().includes(normalizedSearch)
    );

    return matchesCategory && matchesSearch;
  });

  if (currentSort === 'price-asc') {
    visible = visible.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (currentSort === 'price-desc') {
    visible = visible.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (currentSort === 'name-asc') {
    visible = visible.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  return visible;
}

function applyProductView() {
  renderProducts(getVisibleProducts());
  updateResultsCount();
}

function updateResultsCount() {
  const countElement = document.getElementById('resultsCount');
  if (!countElement) {
    return;
  }

  const count = getVisibleProducts().length;
  countElement.textContent = `${count} product${count === 1 ? '' : 's'}`;
}

function renderProducts(products) {
  const productsElement = document.getElementById('products');
  if (!productsElement) {
    return;
  }

  if (!products.length) {
    productsElement.innerHTML = `
      <div class="empty-products">
        <h3>No products found</h3>
        <p>Try a different search or switch category filters.</p>
      </div>
    `;
    return;
  }

  let out = '';

  products.forEach((p, index) => {
    out += `
      <div class="card reveal" style="transition-delay:${index * 45}ms">
        <div class="card-tag">Top Pick</div>
        <h3>${p.name}</h3>
        <p class="price">₹${p.price}</p>
        <p class="card-meta">${p.category ? p.category.toUpperCase() : 'HOME'} | Premium finish | 7-day easy return</p>
        <div class="card-actions">
          <div class="quantity-controls">
            <button onclick="updateQuantity('${p._id}', -1)" class="qty-btn">-</button>
            <span id="qty-${p._id}" class="quantity">1</span>
            <button onclick="updateQuantity('${p._id}', 1)" class="qty-btn">+</button>
          </div>
          <button onclick="addToCart('${p._id}', this)" class="btn add-to-cart-btn">Add to Cart</button>
        </div>
      </div>
    `;
  });

  productsElement.innerHTML = out;
  setupRevealAnimations();
}

function searchProducts() {
  const searchInput = document.getElementById('searchInput');
  const value = searchInput ? searchInput.value.trim() : '';

  if (!hasCatalogGrid()) {
    if (value) {
      window.location.href = `products.html?search=${encodeURIComponent(value)}`;
    } else {
      window.location.href = 'products.html';
    }
    return;
  }

  currentSearch = value;
  updateUrlState();
  applyProductView();
}

function filterByCategory(category) {
  if (!hasCatalogGrid()) {
    openCatalog(category);
    return;
  }

  currentFilter = category;
  setActiveFilterButton(category);
  updateUrlState();
  applyProductView();
}

function showAllProducts() {
  filterByCategory('all');
}

function setActiveFilterButton(category) {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  const activeBtn = document.querySelector(`.filter-btn[data-category="${category}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

function updateUrlState() {
  if (!hasCatalogGrid()) {
    return;
  }

  const params = new URLSearchParams();
  if (currentFilter && currentFilter !== 'all') {
    params.set('category', currentFilter);
  }

  if (currentSearch.trim()) {
    params.set('search', currentSearch.trim());
  }

  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  history.replaceState({}, '', newUrl);
}

function updateCartCount() {
  const cartCountElement = document.getElementById('cart-count');
  if (!cartCountElement) {
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    cartCountElement.textContent = '0';
    return;
  }

  fetch('/cart', {
    headers: {
      Authorization: token
    }
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Unable to fetch cart count');
      }
      return res.json();
    })
    .then((items) => {
      const count = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      cartCountElement.textContent = count;
    })
    .catch(() => {
      cartCountElement.textContent = '0';
    });
}

function updateQuantity(productId, change) {
  const qtyElement = document.getElementById(`qty-${productId}`);
  if (!qtyElement) {
    return;
  }

  let currentQty = parseInt(qtyElement.textContent, 10);
  currentQty = Math.max(1, currentQty + change);
  qtyElement.textContent = currentQty;
}

function addToCart(id, button) {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Please login first to add items to cart', 'error');
    return;
  }

  const originalText = button.textContent;
  const quantity = parseInt(document.getElementById(`qty-${id}`).textContent, 10);

  button.textContent = 'Adding...';
  button.disabled = true;
  button.style.opacity = '0.7';

  fetch('/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({
      productId: id,
      quantity
    })
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add to cart');
      }
      return data;
    })
    .then(() => {
      button.textContent = '✓ Added!';
      button.classList.add('success');
      updateCartCount();

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
        button.classList.remove('success');
      }, 1200);
    })
    .catch((error) => {
      button.textContent = '✗ Failed';
      button.classList.add('error');
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
        button.classList.remove('error');
      }, 1200);
      showNotification(error.message, 'error');
    });
}

function openCatalog(category) {
  const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  window.location.href = `products.html${query}`;
}

function startCountdown() {
  const daysElement = document.getElementById('days');
  const hoursElement = document.getElementById('hours');
  const minutesElement = document.getElementById('minutes');
  const secondsElement = document.getElementById('seconds');

  if (!daysElement || !hoursElement || !minutesElement) {
    return;
  }

  const countdownKey = 'homekart_offer_ends_at';
  const now = Date.now();
  const stored = Number(localStorage.getItem(countdownKey));
  const isValidFuture = Number.isFinite(stored) && stored > now + 60 * 1000;

  let countdownEnd = isValidFuture ? stored : 0;

  if (!countdownEnd) {
    // Creates urgency while still feeling realistic (4 to 18 hours).
    const randomHours = Math.floor(Math.random() * 15) + 4;
    const randomMinutes = Math.floor(Math.random() * 59);
    countdownEnd = now + (randomHours * 60 + randomMinutes) * 60 * 1000;
    localStorage.setItem(countdownKey, String(countdownEnd));
  }

  const timer = setInterval(() => {
    const current = Date.now();
    const distance = countdownEnd - current;

    if (distance < 0) {
      // Roll over to a fresh offer window so timer never looks broken.
      const rolloverHours = 8;
      countdownEnd = current + rolloverHours * 60 * 60 * 1000;
      localStorage.setItem(countdownKey, String(countdownEnd));
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysElement.textContent = days.toString().padStart(2, '0');
    hoursElement.textContent = hours.toString().padStart(2, '0');
    minutesElement.textContent = minutes.toString().padStart(2, '0');
    if (secondsElement) {
      secondsElement.textContent = seconds.toString().padStart(2, '0');
    }
  }, 1000);
}

function subscribeNewsletter() {
  const emailInput = document.querySelector('.newsletter-input');
  const email = emailInput ? emailInput.value : '';

  if (!email) {
    showNotification('Please enter your email', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showNotification('Please enter a valid email', 'error');
    return;
  }

  fetch('/newsletter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Subscription failed');
      }
      return data;
    })
    .then((data) => {
      showNotification(data.message || 'Thank you for subscribing!', 'success');
      if (emailInput) emailInput.value = '';
    })
    .catch((error) => {
      showNotification(error.message || 'Subscription failed', 'error');
    });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll('.reveal');
  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealItems.forEach((item) => observer.observe(item));
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchProducts();
      }
    });
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyProductView();
    });
  }

  const newsletterBtn = document.querySelector('.newsletter-btn');
  if (newsletterBtn) {
    newsletterBtn.addEventListener('click', subscribeNewsletter);
  }

  document.querySelectorAll('.category-card, .trust-item, .footer-section, .catalog-hero, .catalog-toolbar').forEach((item, index) => {
    item.classList.add('reveal');
    item.style.transitionDelay = `${index * 60}ms`;
  });

  initCatalogFromUrl();
  loadProducts();
  startCountdown();
  updateCartCount();
  setupRevealAnimations();
  setInterval(updateCartCount, 5000);
});

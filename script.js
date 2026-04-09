// Global variables
let allProducts = [];
let currentFilter = 'all';

// Load products with enhanced styling and functionality
fetch('/products')
.then(res => res.json())
.then(data => {
  allProducts = data;
  renderProducts(data);
  updateCartCount();
});

// Render products with filtering
function renderProducts(products) {
  let out = "";

  products.forEach(p => {
    out += `
      <div class="card">
        <h3>${p.name}</h3>
        <p class="price">₹${p.price}</p>
        <div class="card-actions">
          <div class="quantity-controls">
            <button onclick="updateQuantity('${p._id}', -1)" class="qty-btn">-</button>
            <span id="qty-${p._id}" class="quantity">1</span>
            <button onclick="updateQuantity('${p._id}', 1)" class="qty-btn">+</button>
          </div>
          <button onclick="addToCart('${p._id}')" class="btn add-to-cart-btn">Add to Cart</button>
        </div>
      </div>
    `;
  });

  document.getElementById("products").innerHTML = out;
}

// Search functionality
function searchProducts() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  if (!searchTerm) {
    renderProducts(allProducts);
    return;
  }

  const filteredProducts = allProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm)
  );

  renderProducts(filteredProducts);
  showNotification(`Found ${filteredProducts.length} products`, "success");
}

// Filter by category
function filterByCategory(category) {
  currentFilter = category;

  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  if (category === 'all') {
    renderProducts(allProducts);
    return;
  }

  // Mock category filtering (you can enhance this based on your product data structure)
  const filteredProducts = allProducts.filter(product =>
    product.category && product.category.toLowerCase().includes(category)
  );

  renderProducts(filteredProducts);
}

// Show all products
function showAllProducts() {
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector('.filter-btn').classList.add('active');
  renderProducts(allProducts);
}

// Update cart count
function updateCartCount() {
  // This would typically fetch cart data, but for demo purposes:
  const cartCount = localStorage.getItem('cartCount') || 0;
  const cartCountElement = document.getElementById('cart-count');
  if (cartCountElement) {
    cartCountElement.textContent = cartCount;
  }
}

// Quantity management
function updateQuantity(productId, change) {
  const qtyElement = document.getElementById(`qty-${productId}`);
  let currentQty = parseInt(qtyElement.textContent);
  currentQty = Math.max(1, currentQty + change);
  qtyElement.textContent = currentQty;
}

// Enhanced add to cart with loading states and feedback
function addToCart(id) {
  const button = event.target;
  const originalText = button.textContent;
  const quantity = parseInt(document.getElementById(`qty-${id}`).textContent);

  // Show loading state
  button.textContent = "Adding...";
  button.disabled = true;
  button.style.opacity = "0.7";

  fetch('/cart', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": localStorage.getItem("token")
    },
    body: JSON.stringify({
      productId: id,
      quantity: quantity
    })
  })
  .then(res => {
    if (res.ok) {
      // Success feedback
      button.textContent = "✓ Added!";
      button.classList.add("success");

      // Update cart count
      let currentCount = parseInt(localStorage.getItem('cartCount') || 0);
      localStorage.setItem('cartCount', currentCount + quantity);
      updateCartCount();

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = "1";
        button.classList.remove("success");
      }, 2000);
    } else {
      throw new Error('Failed to add to cart');
    }
  })
  .catch(error => {
    // Error feedback
    button.textContent = "✗ Failed";
    button.classList.add("error");
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      button.style.opacity = "1";
      button.classList.remove("error");
    }, 2000);
    console.error('Error adding to cart:', error);
  });
}

// Countdown timer for promotional banner
function startCountdown() {
  const countdownDate = new Date();
  countdownDate.setDate(countdownDate.getDate() + 2); // 2 days from now

  const timer = setInterval(() => {
    const now = new Date().getTime();
    const distance = countdownDate - now;

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

    const daysElement = document.getElementById('days');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');

    if (daysElement && hoursElement && minutesElement) {
      daysElement.textContent = days.toString().padStart(2, '0');
      hoursElement.textContent = hours.toString().padStart(2, '0');
      minutesElement.textContent = minutes.toString().padStart(2, '0');
    }

    if (distance < 0) {
      clearInterval(timer);
      if (daysElement && hoursElement && minutesElement) {
        daysElement.textContent = '00';
        hoursElement.textContent = '00';
        minutesElement.textContent = '00';
      }
    }
  }, 1000);
}

// Newsletter subscription
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

  // Mock newsletter subscription
  showNotification('Thank you for subscribing!', 'success');
  if (emailInput) emailInput.value = '';
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Notification system
function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// Add some interactive enhancements
document.addEventListener('DOMContentLoaded', function() {
  // Add loading animation to page
  document.body.classList.add('loaded');

  // Add smooth scrolling for navigation
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Search on enter key
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchProducts();
      }
    });
  }

  // Newsletter subscription
  const newsletterBtn = document.querySelector('.newsletter-btn');
  if (newsletterBtn) {
    newsletterBtn.addEventListener('click', subscribeNewsletter);
  }

  // Start countdown timer
  startCountdown();

  // Update cart count periodically
  setInterval(updateCartCount, 5000);
});
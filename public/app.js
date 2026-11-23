(() => {
  const API_URL = "/api";
  const STORAGE_KEY = "estacao_cart_v1";
  const state = { products: [], cart: loadCart(), category: "todas", search: "", sort: "featured" };
  const $ = (selector) => document.querySelector(selector);
  const productsGrid = $("#produtosGrid");
  const cartPanel = $("#cartPanel");
  const cartOverlay = $("#cartOverlay");
  const cartItems = $("#cartItems");
  const toast = $("#toast");
  let toastTimer;

  function loadCart() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
  }

  function money(value) {
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function categoryName(category) {
    return ({ buque: "Buquê", arranjo: "Arranjo", planta: "Planta", presente: "Presente" })[category] || "Flores";
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products`);
      if (!response.ok) throw new Error("Não foi possível carregar os produtos.");
      const data = await response.json();
      state.products = data.products || [];
      renderProducts();
      renderCart();
    } catch (error) {
      productsGrid.innerHTML = `<p class="empty-results">Não foi possível conectar ao catálogo. Confira se a API está iniciada e tente atualizar a página.</p>`;
      showToast(error.message);
    }
  }

  function getVisibleProducts() {
    let products = [...state.products];
    if (state.category !== "todas") products = products.filter((product) => product.category_slug === state.category);
    if (state.search) {
      const term = state.search.toLocaleLowerCase("pt-BR");
      products = products.filter((product) => `${product.name} ${product.description} ${product.category_name}`.toLocaleLowerCase("pt-BR").includes(term));
    }
    if (state.sort === "price-asc") products.sort((a, b) => Number(a.price) - Number(b.price));
    if (state.sort === "price-desc") products.sort((a, b) => Number(b.price) - Number(a.price));
    if (state.sort === "name") products.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return products;
  }

  function renderProducts() {
    const products = getVisibleProducts();
    if (!products.length) {
      productsGrid.innerHTML = `<p class="empty-results">Não encontramos produtos com esses filtros. Tente outra busca.</p>`;
      return;
    }
    productsGrid.innerHTML = products.map((product) => {
      const stock = Number(product.stock_quantity);
      const quantityInCart = Number(state.cart[product.id] || 0);
      const unavailable = !product.is_active || stock <= 0;
      return `
        <article class="product-card">
          <div class="product-image">
            <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=700&q=75'">
            <span class="product-label">${escapeHtml(categoryName(product.category_slug))}</span>
          </div>
          <div class="product-info"><div><h3 class="product-name">${escapeHtml(product.name)}</h3></div><span class="product-price">${money(product.price)}</span></div>
          <p class="product-description">${escapeHtml(product.description)}</p>
          <div class="product-bottom"><small>${unavailable ? "Indisponível no momento" : stock <= 3 ? `Restam ${stock} unidades` : "Disponível"}</small><button class="add-button" data-add="${product.id}" ${unavailable || quantityInCart >= stock ? "disabled" : ""}>${quantityInCart ? `Na sacola (${quantityInCart})` : "Adicionar +"}</button></div>
        </article>`;
    }).join("");
  }

  function cartEntries() {
    return Object.entries(state.cart).map(([id, quantity]) => ({ product: state.products.find((item) => String(item.id) === String(id)), quantity: Number(quantity) })).filter((entry) => entry.product && entry.quantity > 0);
  }

  function renderCart() {
    const entries = cartEntries();
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = entries.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
    $("#cartCount").textContent = count;
    $("#cartTotal").textContent = money(total);
    $("#checkoutBtn").disabled = entries.length === 0;
    if (!entries.length) {
      cartItems.innerHTML = `<p class="empty-cart">Sua sacola ainda está vazia.</p>`;
      return;
    }
    cartItems.innerHTML = entries.map(({ product, quantity }) => `
      <article class="cart-line">
        <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">
        <div><h3>${escapeHtml(product.name)}</h3><p>${money(product.price)} cada</p><div class="quantity-control"><button data-quantity="-1" data-id="${product.id}" aria-label="Diminuir quantidade">−</button><span>${quantity}</span><button data-quantity="1" data-id="${product.id}" aria-label="Aumentar quantidade">+</button><button class="remove-item" data-remove="${product.id}">Remover</button></div></div>
        <strong class="cart-line-price">${money(Number(product.price) * quantity)}</strong>
      </article>`).join("");
  }

  function addToCart(id) {
    const product = state.products.find((item) => String(item.id) === String(id));
    if (!product) return;
    const current = Number(state.cart[id] || 0);
    if (current >= Number(product.stock_quantity)) return showToast("Não há mais unidades disponíveis desse produto.");
    state.cart[id] = current + 1;
    saveCart();
    renderProducts();
    renderCart();
    showToast("Adicionado à sacola.");
  }

  function changeQuantity(id, difference) {
    const product = state.products.find((item) => String(item.id) === String(id));
    if (!product) return;
    const next = Number(state.cart[id] || 0) + difference;
    if (next <= 0) delete state.cart[id];
    else if (next <= Number(product.stock_quantity)) state.cart[id] = next;
    else return showToast("Quantidade maior que o estoque disponível.");
    saveCart();
    renderProducts();
    renderCart();
  }

  function openCart() {
    cartPanel.classList.add("is-open");
    cartOverlay.classList.add("is-open");
    cartPanel.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    cartPanel.classList.remove("is-open");
    cartOverlay.classList.remove("is-open");
    cartPanel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function openCheckout() {
    closeCart();
    $("#checkoutError").textContent = "";
    const date = $("#checkoutForm").elements.deliveryDate;
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    date.min = localDate;
    date.value = localDate;
    $("#checkoutBackdrop").hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeCheckout() {
    $("#checkoutBackdrop").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function closeConfirmation() {
    $("#confirmBackdrop").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function whatsappLink(url) {
    const link = document.createElement("a");
    link.className = "button button-dark";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = "Abrir WhatsApp <span>↗</span>";
    return link;
  }

  // Mostra ao cliente o resultado do pedido: número, total e o próximo passo.
  function showOrderConfirmation(result, checkoutType) {
    const message = $("#confirmMessage");
    const actions = $("#confirmActions");
    $("#confirmOrderNumber").textContent = result.orderNumber;
    $("#confirmTotal").textContent = money(result.total);
    actions.innerHTML = "";

    if (checkoutType === "whatsapp" && result.whatsappUrl) {
      message.textContent = "Para confirmar, envie os detalhes do pedido pelo WhatsApp. Se a conversa não abrir sozinha, use o botão abaixo.";
      actions.appendChild(whatsappLink(result.whatsappUrl));
      const popup = window.open(result.whatsappUrl, "_blank");
      if (popup) popup.opener = null;
    } else if (checkoutType === "online") {
      message.textContent = result.paymentSetupError || "O pagamento online ainda não está disponível. A loja entrará em contato pelo telefone informado para combinar o pagamento.";
      if (result.paymentConfigured === false) console.warn("MERCADOPAGO_ACCESS_TOKEN não está configurado no servidor.");
    } else {
      message.textContent = "A loja entrará em contato pelo telefone informado para confirmar a entrega. Guarde o número do pedido.";
      if (result.whatsappConfigured === false) console.warn("WHATSAPP_NUMBER não está configurado no servidor.");
    }

    const keepShopping = document.createElement("button");
    keepShopping.type = "button";
    keepShopping.className = "button button-outline";
    keepShopping.textContent = "Continuar comprando";
    keepShopping.addEventListener("click", closeConfirmation);
    actions.appendChild(keepShopping);

    $("#confirmBackdrop").hidden = false;
    document.body.classList.add("no-scroll");
    actions.firstElementChild.focus();
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const checkoutType = formData.get("checkoutType");
    const items = cartEntries().map(({ product, quantity }) => ({ productId: product.id, quantity }));
    if (!items.length) return;
    const payload = {
      customerName: formData.get("customerName"),
      customerPhone: formData.get("customerPhone"),
      recipientName: formData.get("recipientName"),
      recipientPhone: formData.get("recipientPhone"),
      deliveryAddress: formData.get("deliveryAddress"),
      deliveryDate: formData.get("deliveryDate"),
      deliveryPeriod: formData.get("deliveryPeriod"),
      cardMessage: formData.get("cardMessage"),
      notes: formData.get("notes"),
      checkoutType,
      items
    };
    const submitButton = $("#submitOrder");
    submitButton.disabled = true;
    submitButton.innerHTML = "Enviando pedido...";
    $("#checkoutError").textContent = "";
    try {
      const response = await fetch(`${API_URL}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível registrar o pedido.");
      state.cart = {};
      saveCart();
      renderCart();
      renderProducts();
      closeCheckout();
      form.reset();
      if (checkoutType === "online" && result.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }
      showOrderConfirmation(result, checkoutType);
      await loadProducts();
    } catch (error) {
      $("#checkoutError").textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Enviar pedido <span>→</span>';
    }
  }

  productsGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
  });

  cartItems.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-quantity]");
    const removeButton = event.target.closest("[data-remove]");
    if (quantityButton) changeQuantity(quantityButton.dataset.id, Number(quantityButton.dataset.quantity));
    if (removeButton) {
      delete state.cart[removeButton.dataset.remove];
      saveCart();
      renderCart();
      renderProducts();
    }
  });

  $("#filtros").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.category = button.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((item) => item.classList.toggle("is-active", item === button));
    renderProducts();
  });

  $("#searchToggle").addEventListener("click", () => {
    const bar = $("#searchBar");
    bar.hidden = !bar.hidden;
    if (!bar.hidden) $("#searchInput").focus();
  });
  $("#searchInput").addEventListener("input", (event) => { state.search = event.target.value.trim(); renderProducts(); });
  $("#sortSelect").addEventListener("change", (event) => { state.sort = event.target.value; renderProducts(); });
  $("#cartBtn").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  $("#cartOverlay").addEventListener("click", closeCart);
  $("#continueShopping").addEventListener("click", closeCart);
  $("#checkoutBtn").addEventListener("click", openCheckout);
  $("#checkoutClose").addEventListener("click", closeCheckout);
  $("#checkoutBackdrop").addEventListener("click", (event) => { if (event.target.id === "checkoutBackdrop") closeCheckout(); });
  $("#confirmClose").addEventListener("click", closeConfirmation);
  $("#confirmBackdrop").addEventListener("click", (event) => { if (event.target.id === "confirmBackdrop") closeConfirmation(); });
  $("#checkoutForm").addEventListener("submit", submitOrder);
  $("#mobileMenu").addEventListener("click", () => {
    const nav = $("#mainNav");
    const opened = nav.classList.toggle("is-open");
    $("#mobileMenu").setAttribute("aria-expanded", String(opened));
  });
  $("#mainNav").addEventListener("click", (event) => { if (event.target.closest("a")) $("#mainNav").classList.remove("is-open"); });
  document.querySelectorAll("[data-occasion]").forEach((button) => button.addEventListener("click", () => {
    state.category = button.dataset.occasion;
    document.querySelectorAll(".filter-btn").forEach((item) => item.classList.toggle("is-active", item.dataset.filter === state.category));
    renderProducts();
    $("#catalogo").scrollIntoView({ behavior: "smooth" });
  }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeCart(); closeCheckout(); closeConfirmation(); } });
  $("#currentYear").textContent = new Date().getFullYear();

  loadProducts();
})();

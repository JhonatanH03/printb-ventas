const STORAGE_KEY = 'printb-data-v1';
const seed = { sales: [], clients: [], payments: [] };

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(seed));
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sales) || !Array.isArray(parsed.clients) || !Array.isArray(parsed.payments)) {
      return JSON.parse(JSON.stringify(seed));
    }
    return parsed;
  } catch (error) {
    return JSON.parse(JSON.stringify(seed));
  }
}

let data = loadData();

const money = value => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(Number(value) || 0);
const saleOptions = [
  { name: 'Blanco y negro � texto', prices: [5, 4, 3] },
  { name: 'B/N � con im�genes/gr�ficos', prices: [7, 6, 5] },
  { name: 'Color � texto / poco color', prices: [10, 8, 7] },
  { name: 'Color � gr�ficos / color medio', prices: [15, 12, 10] },
  { name: 'Color � p�gina completa / mucha tinta', prices: [20, 18, 15] },
  { name: 'Imagen/foto en papel normal', prices: [25, 20, 18] },
  { name: 'Copia de c�dula � B/N', prices: [10, 10, 10] },
  { name: 'Copia de c�dula � color', prices: [20, 20, 20] }
];

const priceForPages = (optionIndex, pages) => {
  const option = saleOptions[optionIndex];
  if (!option || !Number.isFinite(pages) || pages <= 0) return 0;
  const range = pages <= 10 ? 0 : pages <= 50 ? 1 : 2;
  return option.prices[range] * pages;
};

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (window.PRINTB_CLOUD_SAVE) window.PRINTB_CLOUD_SAVE(data);
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

const clientById = id => data.clients.find(client => client.id === id);
const clientDebt = id => data.sales.filter(sale => sale.clientId === id).reduce((sum, sale) => sum + (Number(sale.total) || 0) - (Number(sale.paid) || 0), 0);

const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
};

function navigate(view) {
  document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === `${view}-view`));
  document.querySelectorAll('.nav-item').forEach(element => element.classList.toggle('active', element.dataset.view === view));
  const titles = {
    dashboard: 'Resumen de tu negocio',
    sales: 'Ventas',
    clients: 'Clientes y saldos',
    payments: 'Abonos recibidos'
  };
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = titles[view] || 'Resumen de tu negocio';
}

function openModal(content) {
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  if (!modal || !backdrop) return;
  modal.innerHTML = content;
  backdrop.classList.add('open');
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function dateLabel(date) {
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'));
}

function saleStatus(sale) {
  if (!sale) return ['Pendiente', 'pending'];
  return Number(sale.paid) >= Number(sale.total) ? ['Pagada', 'paid'] : Number(sale.paid) > 0 ? ['Abono parcial', 'partial'] : ['Pendiente', 'pending'];
}

function saleDetailMarkup(sale) {
  if (Array.isArray(sale.items) && sale.items.length) {
    return `<ul class="sale-detail-list">${sale.items.map(item => `<li>${esc(item.pages || 0)} × ${esc(item.option?.name || 'Servicio')}</li>`).join('')}</ul>`;
  }

  const detail = typeof sale.description === 'string' && sale.description ? sale.description : 'Venta registrada';
  return esc(detail);
}

function saleTable(sales, full) {
  if (!sales.length) return '<p class="empty">Todav�a no hay ventas registradas.</p>';

  return `<table class="data-table"><thead><tr><th>Cliente</th><th>Detalle</th><th>Fecha</th><th>Total</th><th>Estado</th>${full ? '<th></th>' : ''}</tr></thead><tbody>${sales.map(sale => {
    const status = saleStatus(sale);
    const client = clientById(sale.clientId);
    return `<tr><td><strong>${esc(client?.name || 'Venta de mostrador')}</strong></td><td>${saleDetailMarkup(sale)}</td><td>${dateLabel(sale.date)}</td><td>${money(sale.total)}</td><td><span class="status ${status[1]}">${status[0]}</span></td>${full ? `<td><button class="text-button" data-edit-sale="${sale.id}">Editar</button> <button class="text-button" data-print="${sale.id}">Imprimir</button></td>` : ''}</tr>`;
  }).join('')}</tbody></table>`;
}

function renderDashboard() {
  const total = data.sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const paid = data.sales.reduce((sum, sale) => sum + (Number(sale.paid) || 0), 0);
  const salesCount = data.sales.length;

  const metricSales = document.getElementById('metric-sales');
  const metricSalesCount = document.getElementById('metric-sales-count');
  const metricProfit = document.getElementById('metric-profit');
  const metricDebt = document.getElementById('metric-debt');
  const metricDebtCount = document.getElementById('metric-debt-count');
  const metricClients = document.getElementById('metric-clients');

  if (metricSales) metricSales.textContent = money(total);
  if (metricSalesCount) metricSalesCount.textContent = `${salesCount} venta${salesCount === 1 ? '' : 's'} registrada${salesCount === 1 ? '' : 's'}`;
  if (metricProfit) metricProfit.textContent = money(data.sales.reduce((sum, sale) => sum + (Number(sale.total) || 0) - (Number(sale.cost) || 0), 0));
  if (metricDebt) metricDebt.textContent = money(total - paid);
  if (metricDebtCount) metricDebtCount.textContent = `${data.clients.filter(client => clientDebt(client.id) > 0).length} clientes con saldo`;
  if (metricClients) metricClients.textContent = data.clients.length;

  const chart = document.getElementById('sales-chart');
  if (chart) {
    const days = [...Array(7)].map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + index);
      return date.toISOString().slice(0, 10);
    });
    const values = days.map(day => data.sales.filter(sale => sale.date === day).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0));
    const max = Math.max(...values, 1);
    chart.innerHTML = days.map((day, index) => `<div class="bar-col"><div class="bar ${index === 6 ? 'today' : ''}" style="height:${Math.max(values[index] / max * 82, 4)}%" title="${money(values[index])}"></div><label>${new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(day + 'T12:00:00')).replace('.', '')}</label></div>`).join('');
  }

  const debts = data.clients.filter(client => clientDebt(client.id) > 0).sort((a, b) => clientDebt(b.id) - clientDebt(a.id)).slice(0, 4);
  const debtsPreview = document.getElementById('debts-preview');
  if (debtsPreview) {
    debtsPreview.innerHTML = debts.length ? debts.map(client => `<div class="debt-row"><div class="person"><span class="avatar">${esc(client.name.charAt(0).toUpperCase())}</span><div><strong>${esc(client.name)}</strong><small>${esc(client.phone || 'Sin tel�fono')}</small></div></div><span class="amount">${money(clientDebt(client.id))}</span></div>`).join('') : '<p class="empty">No hay saldos pendientes.</p>';
  }

  const recentSales = document.getElementById('recent-sales');
  if (recentSales) {
    const recent = [...data.sales].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
    recentSales.innerHTML = saleTable(recent, false);
  }
}

function renderSales() {
  const salesTable = document.getElementById('sales-table');
  if (!salesTable) return;
  const sales = [...data.sales].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  salesTable.innerHTML = saleTable(sales, true);
}

function renderClients() {
  const clientsTable = document.getElementById('clients-table');
  if (!clientsTable) return;
  clientsTable.innerHTML = data.clients.length ? `<table class="data-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Compras</th><th>Saldo pendiente</th><th></th></tr></thead><tbody>${data.clients.map(client => `<tr><td><strong>${esc(client.name)}</strong></td><td>${esc(client.phone || 'Sin tel�fono')}</td><td>${money(data.sales.filter(sale => sale.clientId === client.id).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0))}</td><td><span class="amount">${money(clientDebt(client.id))}</span></td><td><button class="text-button" data-edit-client="${client.id}">Editar</button>${clientDebt(client.id) > 0 ? ` <button class="text-button" data-client-payment="${client.id}">Registrar abono</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Agrega clientes para controlar sus saldos.</p>';
}

function renderPayments() {
  const paymentsTable = document.getElementById('payments-table');
  if (!paymentsTable) return;
  const payments = [...data.payments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  paymentsTable.innerHTML = payments.length ? `<table class="data-table"><thead><tr><th>Cliente</th><th>Fecha</th><th>Monto</th><th>Nota</th></tr></thead><tbody>${payments.map(payment => `<tr><td><strong>${esc(clientById(payment.clientId)?.name || 'Cliente eliminado')}</strong></td><td>${dateLabel(payment.date)}</td><td>${money(payment.amount)}</td><td>${esc(payment.note || 'Sin nota')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Todav�a no hay abonos registrados.</p>';
}

function renderAll() {
  renderDashboard();
  renderSales();
  renderClients();
  renderPayments();
}

function saleForm() {
  openModal(`<div class="modal-header"><div><p class="eyebrow">NUEVO REGISTRO</p><h2>Registrar venta</h2></div><button class="close" data-close>�</button></div><form id="sale-form"><div class="form-grid"><div class="field full"><label>Cliente</label><select name="clientId"><option value="">Venta de mostrador</option>${data.clients.map(client => `<option value="${client.id}">${esc(client.name)}</option>`).join('')}</select></div><div class="field full"><label>Servicio</label><select required name="service"><option value="">Selecciona el tipo de impresi�n</option>${saleOptions.map((option, index) => `<option value="${index}">${esc(option.name)}</option>`).join('')}</select></div><div class="field"><label>Cantidad de p�ginas</label><input required type="number" min="1" step="1" name="pages" placeholder="Ej. 25" /></div><div class="field"><label>Precio por p�gina</label><input readonly name="unitPrice" placeholder="Se calcula autom�ticamente" /></div><div class="field"><label>Total de venta</label><input required readonly type="number" min="0" step="0.01" name="total" placeholder="Selecciona servicio y p�ginas" /></div><div class="field"><label>Costo</label><input required type="number" min="0" step="0.01" name="cost" placeholder="0.00" /></div><div class="field"><label>Pag� hoy</label><input required type="number" min="0" step="0.01" name="paid" placeholder="0.00" /></div><div class="field"><label>Fecha</label><input required type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Guardar venta</button></div></form></div>`);

  const formElement = document.getElementById('sale-form');
  if (!formElement) return;

  const updateTotal = () => {
    const optionIndex = Number(formElement.elements.service.value);
    const pages = Number(formElement.elements.pages.value);
    const unitPrice = optionIndex >= 0 && pages > 0 ? priceForPages(optionIndex, 1) : 0;
    const total = optionIndex >= 0 && pages > 0 ? priceForPages(optionIndex, pages) : 0;
    formElement.elements.unitPrice.value = optionIndex >= 0 && pages > 0 ? String(unitPrice) : '';
    formElement.elements.total.value = optionIndex >= 0 && pages > 0 ? String(total) : '';
  };

  formElement.elements.service.addEventListener('change', updateTotal);
  formElement.elements.pages.addEventListener('input', updateTotal);

  formElement.onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const optionIndex = Number(form.get('service'));
    const pages = Number(form.get('pages'));
    const total = Number(form.get('total'));
    const paid = Math.min(Number(form.get('paid')), total);
    const option = saleOptions[optionIndex];

    const saleEntry = {
      id: crypto.randomUUID(),
      clientId: form.get('clientId') || '',
      description: option ? `${option.name} (${pages} p�ginas)` : 'Venta registrada',
      items: option ? [{ option, pages }] : [],
      total: total || 0,
      cost: Number(form.get('cost')) || 0,
      paid: paid || 0,
      date: form.get('date'),
      createdAt: Date.now()
    };

    data.sales.push(saleEntry);

    save();
    closeModal();
    renderAll();
    showToast('Venta guardada correctamente');
  };
}

function clientForm() {
  openModal(`<div class="modal-header"><div><p class="eyebrow">CARTERA</p><h2>Nuevo cliente</h2></div><button class="close" data-close>�</button></div><form id="client-form"><div class="form-grid"><div class="field full"><label>Nombre completo</label><input required name="name" placeholder="Ej. Mar�a Gonz�lez" /></div><div class="field"><label>Tel�fono</label><input name="phone" placeholder="55 0000 0000" /></div><div class="field"><label>Correo</label><input type="email" name="email" placeholder="correo@ejemplo.com" /></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Guardar cliente</button></div></form></div>`);

  document.getElementById('client-form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    data.clients.push({
      id: crypto.randomUUID(),
      name: form.get('name'),
      phone: form.get('phone'),
      email: form.get('email')
    });
    save();
    closeModal();
    renderAll();
    showToast('Cliente agregado');
  };
}

function paymentForm(clientId = '') {
  const options = data.clients.filter(client => clientDebt(client.id) > 0).map(client => `<option value="${client.id}" ${client.id === clientId ? 'selected' : ''}>${esc(client.name)} � ${money(clientDebt(client.id))}</option>`).join('');
  openModal(`<div class="modal-header"><div><p class="eyebrow">COBRANZA</p><h2>Registrar abono</h2></div><button class="close" data-close>�</button></div><form id="payment-form"><div class="form-grid"><div class="field full"><label>Cliente</label><select required name="clientId"><option value="">Selecciona un cliente</option>${options}</select></div><div class="field"><label>Monto recibido</label><input required type="number" min="0.01" step="0.01" name="amount" placeholder="0.00" /></div><div class="field"><label>Fecha</label><input required type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></div><div class="field full"><label>Nota</label><input name="note" placeholder="Ej. Transferencia" /></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Guardar abono</button></div></form></div>`);

  document.getElementById('payment-form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const client = clientById(form.get('clientId'));
    const amount = Number(form.get('amount'));

    if (!client || amount > clientDebt(client.id) + 0.01) {
      showToast('El abono supera el saldo pendiente');
      return;
    }

    data.payments.push({
      id: crypto.randomUUID(),
      clientId: client.id,
      amount,
      date: form.get('date'),
      note: form.get('note'),
      createdAt: Date.now()
    });

    let remaining = amount;
    data.sales.filter(sale => sale.clientId === client.id && Number(sale.paid) < Number(sale.total)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(sale => {
      const applied = Math.min(remaining, Number(sale.total) - Number(sale.paid));
      sale.paid = Number(sale.paid) + applied;
      remaining -= applied;
    });

    save();
    closeModal();
    renderAll();
    showToast('Abono registrado');
  };
}

function editClientForm(clientId) {
  const client = clientById(clientId);
  if (!client) return;

  openModal(`<div class="modal-header"><div><p class="eyebrow">CARTERA</p><h2>Editar cliente</h2></div><button class="close" data-close>�</button></div><form id="edit-client-form"><div class="form-grid"><div class="field full"><label>Nombre completo</label><input required name="name" value="${esc(client.name)}" /></div><div class="field"><label>Tel�fono</label><input name="phone" value="${esc(client.phone || '')}" /></div><div class="field"><label>Correo</label><input type="email" name="email" value="${esc(client.email || '')}" /></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Guardar cambios</button></div></form></div>`);

  document.getElementById('edit-client-form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    client.name = form.get('name');
    client.phone = form.get('phone');
    client.email = form.get('email');
    save();
    closeModal();
    renderAll();
    showToast('Cliente actualizado');
  };
}

function editSaleForm(saleId) {
  const sale = data.sales.find(item => item.id === saleId);
  if (!sale) return;

  openModal(`<div class="modal-header"><div><p class="eyebrow">HISTORIAL</p><h2>Editar venta</h2></div><button class="close" data-close>�</button></div><form id="edit-sale-form"><div class="form-grid"><div class="field full"><label>Cliente</label><select required name="clientId"><option value="">Venta de mostrador</option>${data.clients.map(client => `<option value="${client.id}" ${client.id === sale.clientId ? 'selected' : ''}>${esc(client.name)}</option>`).join('')}</select></div><div class="field full"><label>Descripci�n</label><input required name="description" value="${esc(sale.description)}" /></div><div class="field"><label>Total de venta</label><input required type="number" min="0" step="0.01" name="total" value="${sale.total}" /></div><div class="field"><label>Pag�</label><input required type="number" min="0" step="0.01" name="paid" value="${sale.paid}" /></div><div class="field full"><label>Fecha</label><input required type="date" name="date" value="${sale.date}" /></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-close>Cancelar</button><button class="primary-button">Guardar cambios</button></div></form></div>`);

  document.getElementById('edit-sale-form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    sale.clientId = form.get('clientId') || '';
    sale.description = form.get('description');
    sale.total = Number(form.get('total'));
    sale.paid = Math.min(Number(form.get('paid')), sale.total);
    sale.date = form.get('date');
    save();
    closeModal();
    renderAll();
    showToast('Venta actualizada');
  };
}

function printReceipt(id) {
  const sale = data.sales.find(item => item.id === id);
  if (!sale) {
    showToast('No se encontr� la venta');
    return;
  }

  const client = clientById(sale.clientId);
  const printWindow = window.open('', '_blank', 'width=420,height=600');
  if (!printWindow) {
    showToast('Bloque� la ventana de impresi�n');
    return;
  }

  printWindow.document.write(`<html><head><title>Comprobante PrintB</title><style>body{font:14px Arial;padding:24px;color:#18352e}h1{font-size:23px;margin:0 0 5px}p{margin:7px 0}hr{border:0;border-top:1px dashed #aaa;margin:20px 0}.total{font-size:20px;font-weight:bold}</style></head><body><h1>PrintB</h1><p>Comprobante de venta</p><hr><p><b>Fecha:</b> ${dateLabel(sale.date)}</p><p><b>Cliente:</b> ${esc(client?.name || 'Mostrador')}</p><p>${esc(sale.description)}</p><hr><p>Total: <span class="total">${money(sale.total)}</span></p><p>Pagado: ${money(sale.paid)}</p><p>Pendiente: ${money(Math.max((Number(sale.total) || 0) - (Number(sale.paid) || 0), 0))}</p><script>window.print();</script></body></html>`);
  printWindow.document.close();
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]');
  if (nav) navigate(nav.dataset.view);

  const target = event.target.closest('[data-view-target]');
  if (target) navigate(target.dataset.viewTarget);

  if (event.target.closest('[data-close]') || event.target.id === 'modal-backdrop') closeModal();
  if (event.target.closest('#new-sale') || event.target.closest('#new-sale-top')) saleForm();
  if (event.target.closest('#new-client')) clientForm();
  if (event.target.closest('#new-payment')) paymentForm();

  const payment = event.target.closest('[data-client-payment]');
  if (payment) paymentForm(payment.dataset.clientPayment);

  const print = event.target.closest('[data-print]');
  if (print) printReceipt(print.dataset.print);

  const edit = event.target.closest('[data-edit-sale]');
  if (edit) editSaleForm(edit.dataset.editSale);

  const editClient = event.target.closest('[data-edit-client]');
  if (editClient) editClientForm(editClient.dataset.editClient);
});

document.getElementById('export-data').onclick = () => {
  const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = `printb-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Respaldo descargado');
};

document.getElementById('import-data').onclick = () => document.getElementById('import-file').click();
document.getElementById('import-file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.sales) || !Array.isArray(imported.clients) || !Array.isArray(imported.payments)) throw new Error('Formato inv�lido');
    data = imported;
    save();
    renderAll();
    showToast('Datos restaurados correctamente');
  } catch {
    showToast('El archivo no es un respaldo v�lido');
  }

  event.target.value = '';
};

renderAll();

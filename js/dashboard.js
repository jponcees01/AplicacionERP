
// ===============================
// CONFIG SAFE
// ===============================
const CFG = typeof CONFIG !== "undefined" ? CONFIG : window.CONFIG;

function getToken() {
    return CFG?.getData?.()?.accessToken || null;
}

// ===============================
// FETCH SEGURO CON TOKEN
// ===============================
async function authFetch(url, options = {}) {

    const token = getToken();

    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
    });
}

// ===============================
// ESTADO
// ===============================
let almacenSeleccionado = null;

// ===============================
// ALMACENES (COMBO)
// ===============================
async function cargarAlmacenes() {

    const res = await authFetch(
        `${CFG.API_URL}/inventario/combo?tipo=ALMACEN`
    );

    if (!res.ok) {
        console.error("Error almacenes:", res.status);
        return;
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
        console.error("Almacenes inválidos:", data);
        return;
    }

    const combo = document.getElementById("cmbAlmacen");
    if (!combo) return;

    combo.innerHTML = `<option value="">-- Todos --</option>`;

    data.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.text = a.texto;
        combo.appendChild(opt);
    });

    combo.addEventListener("change", function () {
        almacenSeleccionado = this.value || null;
        cargarDashboard(almacenSeleccionado);
    });
}

// ===============================
// DASHBOARD KPI
// ===============================
async function cargarDashboard(idAlmacen) {

    let url = `${CFG.API_URL}/inventario/dashboard-kpis`;

    if (idAlmacen) {
        url += `?idAlmacen=${idAlmacen}`;
    }

    const res = await authFetch(url);

    if (!res.ok) {
        console.error("Dashboard KPI error:", res.status);
        return;
    }

    const data = await res.json();

    // ================= KPI =================
    document.getElementById("totalProductos").innerText =
        data.kpiInventario?.totalProductos ?? 0;

    document.getElementById("stockTotal").innerText =
        data.kpiInventario?.stockTotal ?? 0;

    document.getElementById("ventasMes").innerText =
        "S/ " + (data.ventasMes?.ventasMes ?? 0);

    document.getElementById("enviosPendientes").innerText =
        data.enviosPendientes?.enviosPendientes ?? 0;

    // ================= ALERTAS =================
    document.getElementById("productosStockBajo").innerText =
        data.stockAlertas?.stockBajo ?? 0;

    document.getElementById("productosSinStock").innerText =
        data.stockAlertas?.sinStock ?? 0;

    document.getElementById("solicitudesPendientes").innerText =
        data.solicitudesPendientes?.solicitudesPendientes ?? 0;

    // ================= OPERACIONES =================
    document.getElementById("ventasPagadas").innerText =
        data.operaciones?.ventasPagadas ?? 0;

    document.getElementById("enviosEntregados").innerText =
        data.operaciones?.enviosEntregados ?? 0;

    document.getElementById("devolucionesProcesadas").innerText =
        data.operaciones?.devolucionesProcesadas ?? 0;

    document.getElementById("almacenesActivos").innerText =
        data.operaciones?.almacenesActivos ?? 0;

    // ================= ACTIVIDAD =================
    const cont = document.getElementById("listaActividad");
    if (cont) cont.innerHTML = "";

    (Array.isArray(data.actividadReciente) ? data.actividadReciente : []).forEach(a => {

        const div = document.createElement("div");

        div.innerHTML = `
            <strong>${a.titulo ?? ''}</strong><br>
            <small>${a.descripcion ?? ''}</small>
        `;

        cont.appendChild(div);
    });

    // ================= STOCK BAJO =================
    cargarStockBajo(idAlmacen);
}

// ===============================
// STOCK BAJO (CORREGIDO DEFINITIVO)
// ===============================
async function cargarStockBajo(idAlmacen) {

    // 🔥 FIX CLAVE: backend espera ID o query, nunca endpoint vacío roto
    let url = `${CFG.API_URL}/inventario/stock-bajo`;

    if (idAlmacen) {
        url += `?idAlmacen=${idAlmacen}`;
    }

    const res = await authFetch(url);

    if (!res.ok) {
        console.error("Stock bajo error:", res.status);
        return;
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
        console.error("stock-bajo inválido:", data);
        return;
    }

    const tbody = document.getElementById("tablaStockBajo");
    if (!tbody) return;

    tbody.innerHTML = "";

    data.forEach(p => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.producto ?? ''}</td>
            <td>${p.almacen ?? ''}</td>
            <td>${p.stock ?? 0}</td>
            <td>${p.stockMinimo ?? 0}</td>
            <td><span class="badge bg-danger">Bajo</span></td>
        `;

        tbody.appendChild(tr);
    });
}

// ===============================
// INIT
// ===============================
window.onload = async function () {

    if (!CFG || !CFG.API_URL) {
        console.error("CONFIG no disponible");
        return;
    }

    await cargarAlmacenes();
    await cargarDashboard(null);
};